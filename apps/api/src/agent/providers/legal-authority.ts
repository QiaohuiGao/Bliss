import { z } from 'zod'
import type {
  MarriageLicenseFieldKey,
  MarriageLicenseRule,
} from '@bliss/types'
import { isValidStateCode } from '../../content/marriage-license'
import { AgentGuardrailError } from '../errors'

const fieldKeySchema = z.enum([
  'waiting_period',
  'validity_window',
  'appearance',
  'witnesses',
  'officiant',
  'documents',
])

const REQUIRED_FIELD_KEYS: MarriageLicenseFieldKey[] = [
  'waiting_period',
  'validity_window',
  'appearance',
  'witnesses',
  'officiant',
  'documents',
]

export const marriageLicenseAuthorityQuerySchema = z.object({
  state: z.string().length(2).transform(value => value.toUpperCase()),
  county: z.string().trim().min(1).max(120).optional(),
}).strict().refine(query => isValidStateCode(query.state), {
  message: 'State must be a valid USPS code',
})

const authoritySourceSchema = z.object({
  publisher: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(300),
  url: z.string().url().max(2_000),
  retrievedAt: z.string().datetime({ offset: true }),
  fieldKeys: z.array(fieldKeySchema).min(1),
}).strict()

const authorityRuleSchema = z.object({
  state: z.string().length(2),
  county: z.string().trim().min(1).max(120).nullable(),
  waitingPeriodHours: z.number().int().min(0).max(30 * 24),
  validityDays: z.number().int().min(1).max(365),
  bothPartiesMustAppear: z.boolean(),
  witnessesRequired: z.number().int().min(0).max(10),
  onlineOrdinationAccepted: z.enum(['yes', 'no', 'varies_by_county', 'not_verified']),
  documentsRequired: z.array(z.string().trim().min(1).max(500)).max(30),
  notes: z.array(z.string().trim().min(1).max(1_000)).max(20),
  sources: z.array(authoritySourceSchema).min(1).max(20),
  verifiedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
}).strict()

const gatewayResponseSchema = z.object({
  result: authorityRuleSchema.nullable(),
}).strict()

export type MarriageLicenseAuthorityQuery = z.infer<typeof marriageLicenseAuthorityQuerySchema>
export type LegalAuthorityFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export interface MarriageLicenseAuthorityProvider {
  readonly id: string
  lookup(
    query: MarriageLicenseAuthorityQuery,
    signal: AbortSignal,
  ): Promise<MarriageLicenseRule | null>
}

function assertOfficialSource(url: string) {
  const parsed = new URL(url)
  const host = parsed.hostname.toLowerCase()
  if (parsed.protocol !== 'https:' || !(host === 'gov' || host.endsWith('.gov'))) {
    throw new AgentGuardrailError(
      'LEGAL_AUTHORITY_SOURCE_NOT_OFFICIAL',
      'Legal rule source is not an approved government website',
    )
  }
}

function assertCompleteCoverage(rule: MarriageLicenseRule) {
  const covered = new Set(rule.sources.flatMap(source => source.fieldKeys))
  const missing = REQUIRED_FIELD_KEYS.filter(key => !covered.has(key))
  if (missing.length > 0) {
    throw new AgentGuardrailError(
      'LEGAL_AUTHORITY_SOURCE_INCOMPLETE',
      'Legal rule is missing field-level authority coverage',
    )
  }
}

export class HttpMarriageLicenseAuthorityProvider implements MarriageLicenseAuthorityProvider {
  readonly id: string
  private readonly endpoint: URL
  private readonly timeoutMs: number
  private readonly maxAgeMs: number
  private readonly fetcher: LegalAuthorityFetch
  private readonly now: () => Date

  constructor(private readonly config: {
    endpoint: string
    token: string
    providerId?: string
    timeoutMs?: number
    maxAgeDays?: number
    fetcher?: LegalAuthorityFetch
    now?: () => Date
  }) {
    this.id = config.providerId ?? 'legal-authority-gateway-v1'
    try {
      this.endpoint = new URL(config.endpoint)
    } catch {
      throw new AgentGuardrailError(
        'LEGAL_AUTHORITY_CONFIG_INVALID',
        'Legal authority provider endpoint is invalid',
      )
    }
    if (!['http:', 'https:'].includes(this.endpoint.protocol)) {
      throw new AgentGuardrailError(
        'LEGAL_AUTHORITY_CONFIG_INVALID',
        'Legal authority provider endpoint must use HTTP or HTTPS',
      )
    }
    if (process.env['NODE_ENV'] === 'production' && this.endpoint.protocol !== 'https:') {
      throw new AgentGuardrailError(
        'LEGAL_AUTHORITY_CONFIG_INVALID',
        'Legal authority provider must use HTTPS in production',
      )
    }
    if (!config.token.trim()) {
      throw new AgentGuardrailError(
        'LEGAL_AUTHORITY_CONFIG_INVALID',
        'Legal authority provider token is missing',
      )
    }
    this.timeoutMs = Math.min(Math.max(config.timeoutMs ?? 8_000, 100), 30_000)
    this.maxAgeMs = Math.min(Math.max(config.maxAgeDays ?? 90, 1), 180) * 86_400_000
    this.fetcher = config.fetcher ?? fetch
    this.now = config.now ?? (() => new Date())
  }

  async lookup(
    rawQuery: MarriageLicenseAuthorityQuery,
    signal: AbortSignal,
  ): Promise<MarriageLicenseRule | null> {
    const query = marriageLicenseAuthorityQuerySchema.parse(rawQuery)
    const requestController = new AbortController()
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      requestController.abort(new Error('Legal authority provider timed out'))
    }, this.timeoutMs)
    const cancel = () => requestController.abort(signal.reason)
    if (signal.aborted) cancel()
    else signal.addEventListener('abort', cancel, { once: true })

    try {
      const response = await this.fetcher(this.endpoint, {
        method: 'POST',
        signal: requestController.signal,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: `Bearer ${this.config.token}`,
        },
        body: JSON.stringify(query),
      })
      if (!response.ok) {
        throw new AgentGuardrailError(
          `LEGAL_AUTHORITY_HTTP_${response.status}`,
          'Legal authority provider failed',
          response.status === 408 || response.status === 429 || response.status >= 500,
        )
      }
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
      if (!contentType.includes('application/json')) {
        throw new AgentGuardrailError(
          'LEGAL_AUTHORITY_INVALID_RESPONSE',
          'Legal authority provider returned a non-JSON response',
        )
      }
      const raw = await response.text()
      if (raw.length > 128_000) {
        throw new AgentGuardrailError(
          'LEGAL_AUTHORITY_RESPONSE_TOO_LARGE',
          'Legal authority response exceeded the safe limit',
        )
      }
      let body: unknown
      try {
        body = JSON.parse(raw)
      } catch {
        throw new AgentGuardrailError(
          'LEGAL_AUTHORITY_INVALID_RESPONSE',
          'Legal authority provider returned invalid JSON',
        )
      }
      const parsed = gatewayResponseSchema.safeParse(body)
      if (!parsed.success) {
        throw new AgentGuardrailError(
          'LEGAL_AUTHORITY_INVALID_RESPONSE',
          'Legal authority provider returned an invalid response',
        )
      }
      const rule = parsed.data.result
      if (!rule) return null
      if (rule.state.toUpperCase() !== query.state) {
        throw new AgentGuardrailError(
          'LEGAL_AUTHORITY_JURISDICTION_MISMATCH',
          'Legal authority result did not match the requested state',
        )
      }
      if (query.county && rule.county?.toLowerCase() !== query.county.toLowerCase()) {
        throw new AgentGuardrailError(
          'LEGAL_AUTHORITY_JURISDICTION_MISMATCH',
          'Legal authority result did not match the requested county',
        )
      }
      rule.sources.forEach(source => assertOfficialSource(source.url))
      assertCompleteCoverage(rule)

      const now = this.now().getTime()
      const verifiedAt = new Date(rule.verifiedAt).getTime()
      const expiresAt = new Date(rule.expiresAt).getTime()
      if (verifiedAt > now + 5 * 60_000 || now - verifiedAt > this.maxAgeMs || expiresAt <= now) {
        throw new AgentGuardrailError(
          'LEGAL_AUTHORITY_DATA_STALE',
          'Legal authority data must be refreshed before use',
        )
      }
      return { ...rule, state: rule.state.toUpperCase() }
    } catch (error) {
      if (error instanceof AgentGuardrailError) throw error
      if (signal.aborted) {
        throw new AgentGuardrailError('LEGAL_AUTHORITY_CANCELLED', 'Legal lookup was cancelled')
      }
      if (timedOut) {
        throw new AgentGuardrailError(
          'LEGAL_AUTHORITY_TIMEOUT',
          'Legal authority provider timed out',
          true,
        )
      }
      throw new AgentGuardrailError(
        'LEGAL_AUTHORITY_UNAVAILABLE',
        'Legal authority provider is unavailable',
        true,
      )
    } finally {
      clearTimeout(timeout)
      signal.removeEventListener('abort', cancel)
    }
  }
}

export function configuredMarriageLicenseAuthorityProvider(): MarriageLicenseAuthorityProvider | null {
  const endpoint = process.env['LEGAL_AUTHORITY_ENDPOINT']
  const token = process.env['LEGAL_AUTHORITY_TOKEN']
  if (!endpoint || !token) return null
  const timeout = Number(process.env['LEGAL_AUTHORITY_TIMEOUT_MS'])
  const maxAgeDays = Number(process.env['LEGAL_AUTHORITY_MAX_AGE_DAYS'])
  return new HttpMarriageLicenseAuthorityProvider({
    endpoint,
    token,
    providerId: process.env['LEGAL_AUTHORITY_PROVIDER_ID'] || undefined,
    timeoutMs: Number.isFinite(timeout) ? timeout : undefined,
    maxAgeDays: Number.isFinite(maxAgeDays) ? maxAgeDays : undefined,
  })
}
