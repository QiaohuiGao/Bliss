import { createHash, createHmac } from 'node:crypto'
import { AgentGuardrailError } from '../errors'

export const MEDIA_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type MediaContentType = (typeof MEDIA_CONTENT_TYPES)[number]

export interface MediaUploadRequest {
  intentId: string
  weddingId: string
  purpose: 'moment'
  contentType: MediaContentType
  sizeBytes: number
  originalFilename: string
}

export interface MediaUploadGrant {
  provider: string
  objectKey: string
  uploadUrl: string
  uploadHeaders: Record<string, string>
  expiresAt: Date
}

export interface MediaUploadProvider {
  readonly id: string
  readonly maxBytes: number
  createUploadGrant(request: MediaUploadRequest): Promise<MediaUploadGrant>
  createReadGrant(request: { weddingId: string; objectKey: string }): Promise<{
    url: string
    expiresAt: Date
  }>
  deleteObject(request: { weddingId: string; objectKey: string }): Promise<void>
}

export type MediaProviderFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

const MEDIA_OBJECT_SCHEME = 'bliss-media:'

export function mediaObjectReference(objectKey: string): string {
  return `${MEDIA_OBJECT_SCHEME}${objectKey}`
}

export function parseMediaObjectReference(reference: string): string | null {
  return reference.startsWith(MEDIA_OBJECT_SCHEME)
    ? reference.slice(MEDIA_OBJECT_SCHEME.length)
    : null
}

const extensionFor = (contentType: MediaContentType) => ({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
})[contentType]

const rfc3986 = (value: string) => encodeURIComponent(value)
  .replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)

const encodePath = (value: string) => value.split('/').map(rfc3986).join('/')
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')
const hmac = (key: Buffer | string, value: string) => createHmac('sha256', key).update(value).digest()

function signingKey(secret: string, shortDate: string, region: string) {
  const date = hmac(`AWS4${secret}`, shortDate)
  const regional = hmac(date, region)
  const service = hmac(regional, 's3')
  return hmac(service, 'aws4_request')
}

function assertHttpsInProduction(url: URL, label: string) {
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new AgentGuardrailError('MEDIA_PROVIDER_CONFIG_INVALID', `${label} must use HTTP or HTTPS`)
  }
  if (process.env['NODE_ENV'] === 'production' && url.protocol !== 'https:') {
    throw new AgentGuardrailError('MEDIA_PROVIDER_CONFIG_INVALID', `${label} must use HTTPS in production`)
  }
}

/**
 * Private S3-compatible media provider. The browser receives a short-lived PUT
 * grant; authorized Moment reads receive a separate short-lived GET grant.
 */
export class S3CompatibleMediaUploadProvider implements MediaUploadProvider {
  readonly id: string
  readonly maxBytes: number
  private readonly endpoint: URL
  private readonly expiresSeconds: number
  private readonly readExpiresSeconds: number
  private readonly deleteTimeoutMs: number
  private readonly fetcher: MediaProviderFetch
  private readonly now: () => Date

  constructor(private readonly config: {
    endpoint: string
    bucket: string
    region: string
    accessKeyId: string
    secretAccessKey: string
    providerId?: string
    keyPrefix?: string
    maxBytes?: number
    expiresSeconds?: number
    readExpiresSeconds?: number
    deleteTimeoutMs?: number
    fetcher?: MediaProviderFetch
    now?: () => Date
  }) {
    this.id = config.providerId ?? 's3-compatible-media-v1'
    try {
      this.endpoint = new URL(config.endpoint)
    } catch {
      throw new AgentGuardrailError('MEDIA_PROVIDER_CONFIG_INVALID', 'Media provider URL is invalid')
    }
    assertHttpsInProduction(this.endpoint, 'Media upload endpoint')
    if (this.endpoint.search || this.endpoint.hash) {
      throw new AgentGuardrailError('MEDIA_PROVIDER_CONFIG_INVALID', 'Media provider URL cannot contain query or hash values')
    }
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(config.bucket)) {
      throw new AgentGuardrailError('MEDIA_PROVIDER_CONFIG_INVALID', 'Media bucket name is invalid')
    }
    if (!config.region.trim() || !config.accessKeyId.trim() || !config.secretAccessKey.trim()) {
      throw new AgentGuardrailError('MEDIA_PROVIDER_CONFIG_INVALID', 'Media provider credentials are incomplete')
    }
    this.maxBytes = Math.min(Math.max(config.maxBytes ?? 10 * 1024 * 1024, 1_000_000), 25 * 1024 * 1024)
    this.expiresSeconds = Math.min(Math.max(config.expiresSeconds ?? 900, 60), 3_600)
    this.readExpiresSeconds = Math.min(Math.max(config.readExpiresSeconds ?? 300, 60), 900)
    this.deleteTimeoutMs = Math.min(Math.max(config.deleteTimeoutMs ?? 8_000, 100), 30_000)
    this.fetcher = config.fetcher ?? fetch
    this.now = config.now ?? (() => new Date())
  }

  private presign(input: {
    method: 'DELETE' | 'GET' | 'PUT'
    objectKey: string
    contentType?: MediaContentType
    expiresSeconds: number
  }) {
    const now = this.now()
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const shortDate = amzDate.slice(0, 8)
    const scope = `${shortDate}/${this.config.region}/s3/aws4_request`
    const endpointPrefix = this.endpoint.pathname.replace(/\/$/, '')
    const canonicalUri = `${endpointPrefix}/${encodePath(this.config.bucket)}/${encodePath(input.objectKey)}`
    const credential = `${this.config.accessKeyId}/${scope}`
    const signedHeaders = input.contentType ? 'content-type;host;if-none-match' : 'host'
    const query = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': credential,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(input.expiresSeconds),
      'X-Amz-SignedHeaders': signedHeaders,
    })
    const canonicalQuery = [...query.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${rfc3986(key)}=${rfc3986(value)}`)
      .join('&')
    const canonicalHeaders = input.contentType
      ? `content-type:${input.contentType}\nhost:${this.endpoint.host}\nif-none-match:*\n`
      : `host:${this.endpoint.host}\n`
    const canonicalRequest = [
      input.method,
      canonicalUri,
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      'UNSIGNED-PAYLOAD',
    ].join('\n')
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      sha256(canonicalRequest),
    ].join('\n')
    const signature = createHmac(
      'sha256',
      signingKey(this.config.secretAccessKey, shortDate, this.config.region),
    ).update(stringToSign).digest('hex')
    const url = new URL(canonicalUri, this.endpoint)
    url.search = `${canonicalQuery}&X-Amz-Signature=${signature}`
    return {
      url: url.toString(),
      expiresAt: new Date(now.getTime() + input.expiresSeconds * 1_000),
    }
  }

  async createUploadGrant(request: MediaUploadRequest): Promise<MediaUploadGrant> {
    if (!MEDIA_CONTENT_TYPES.includes(request.contentType)) {
      throw new AgentGuardrailError('MEDIA_TYPE_NOT_ALLOWED', 'Choose a JPEG, PNG, or WebP image')
    }
    if (request.sizeBytes < 1 || request.sizeBytes > this.maxBytes) {
      throw new AgentGuardrailError('MEDIA_SIZE_NOT_ALLOWED', 'Image exceeds the upload size limit')
    }
    const prefix = (this.config.keyPrefix ?? 'bliss').replace(/^\/+|\/+$/g, '')
    const objectKey = [
      prefix,
      'weddings',
      request.weddingId,
      request.purpose,
      `${request.intentId}.${extensionFor(request.contentType)}`,
    ].filter(Boolean).join('/')

    const signed = this.presign({
      method: 'PUT',
      objectKey,
      contentType: request.contentType,
      expiresSeconds: this.expiresSeconds,
    })
    return {
      provider: this.id,
      objectKey,
      uploadUrl: signed.url,
      // Conditional creation prevents the same grant from overwriting an
      // already attached memory during its short validity window.
      uploadHeaders: {
        'content-type': request.contentType,
        'if-none-match': '*',
      },
      expiresAt: signed.expiresAt,
    }
  }

  async createReadGrant(request: { weddingId: string; objectKey: string }) {
    this.assertObjectScope(request)
    return this.presign({
      method: 'GET',
      objectKey: request.objectKey,
      expiresSeconds: this.readExpiresSeconds,
    })
  }

  private assertObjectScope(request: { weddingId: string; objectKey: string }) {
    const prefix = (this.config.keyPrefix ?? 'bliss').replace(/^\/+|\/+$/g, '')
    const requiredPrefix = [prefix, 'weddings', request.weddingId, 'moment']
      .filter(Boolean)
      .join('/') + '/'
    if (!request.objectKey.startsWith(requiredPrefix) || request.objectKey.includes('..')) {
      throw new AgentGuardrailError('MEDIA_OBJECT_OUT_OF_SCOPE', 'Media object is outside this wedding')
    }
  }

  async deleteObject(request: { weddingId: string; objectKey: string }): Promise<void> {
    this.assertObjectScope(request)
    const grant = this.presign({
      method: 'DELETE',
      objectKey: request.objectKey,
      expiresSeconds: 60,
    })
    const controller = new AbortController()
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort(new Error('Media delete timed out'))
    }, this.deleteTimeoutMs)
    try {
      const response = await this.fetcher(grant.url, {
        method: 'DELETE',
        signal: controller.signal,
      })
      if (!response.ok && response.status !== 404) {
        throw new AgentGuardrailError(
          `MEDIA_DELETE_HTTP_${response.status}`,
          'Photo storage deletion failed',
          response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500,
        )
      }
    } catch (error) {
      if (error instanceof AgentGuardrailError) throw error
      throw new AgentGuardrailError(
        timedOut ? 'MEDIA_DELETE_TIMEOUT' : 'MEDIA_DELETE_UNAVAILABLE',
        timedOut ? 'Photo storage deletion timed out' : 'Photo storage deletion is unavailable',
        true,
      )
    } finally {
      clearTimeout(timeout)
    }
  }
}

export function configuredMediaUploadProvider(): MediaUploadProvider | null {
  const endpoint = process.env['MEDIA_S3_ENDPOINT']
  const bucket = process.env['MEDIA_S3_BUCKET']
  const region = process.env['MEDIA_S3_REGION']
  const accessKeyId = process.env['MEDIA_S3_ACCESS_KEY_ID']
  const secretAccessKey = process.env['MEDIA_S3_SECRET_ACCESS_KEY']
  if (!endpoint || !bucket || !region || !accessKeyId || !secretAccessKey) {
    return null
  }
  const maxBytes = Number(process.env['MEDIA_UPLOAD_MAX_BYTES'])
  const expiresSeconds = Number(process.env['MEDIA_UPLOAD_EXPIRES_SECONDS'])
  const readExpiresSeconds = Number(process.env['MEDIA_READ_EXPIRES_SECONDS'])
  const deleteTimeoutMs = Number(process.env['MEDIA_DELETE_TIMEOUT_MS'])
  return new S3CompatibleMediaUploadProvider({
    endpoint,
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    providerId: process.env['MEDIA_UPLOAD_PROVIDER_ID'] || undefined,
    keyPrefix: process.env['MEDIA_S3_KEY_PREFIX'] || undefined,
    maxBytes: Number.isFinite(maxBytes) ? maxBytes : undefined,
    expiresSeconds: Number.isFinite(expiresSeconds) ? expiresSeconds : undefined,
    readExpiresSeconds: Number.isFinite(readExpiresSeconds) ? readExpiresSeconds : undefined,
    deleteTimeoutMs: Number.isFinite(deleteTimeoutMs) ? deleteTimeoutMs : undefined,
  })
}
