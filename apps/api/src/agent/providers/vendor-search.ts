import { z } from 'zod'
import { AgentGuardrailError } from '../errors'

export const photographerStyleSchema = z.enum([
  'documentary',
  'editorial',
  'classic',
  'true_to_color',
])

export const vendorSearchQuerySchema = z.object({
  city: z.string().trim().min(1).max(120),
  state: z.string().length(2).toUpperCase(),
  style: photographerStyleSchema,
  budgetMaxCents: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(8).default(5),
}).strict()

export type VendorSearchQuery = z.infer<typeof vendorSearchQuerySchema>

const providerVendorSchema = z.object({
  providerVendorId: z.string().min(1).max(300),
  name: z.string().min(1).max(200),
  website: z.string().url().max(2_000).nullable().optional(),
  sourceUrl: z.string().url().max(2_000),
  city: z.string().max(120).nullable().optional(),
  state: z.string().max(2).nullable().optional(),
  priceLevel: z.string().max(120).nullable().optional(),
  summary: z.string().max(1_500).nullable().optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  reviewCount: z.number().int().nonnegative().nullable().optional(),
}).strict()

const gatewayResponseSchema = z.object({
  results: z.array(providerVendorSchema).max(8),
}).strict()

export type ProviderVendor = z.infer<typeof providerVendorSchema>

export interface VendorSearchProvider {
  readonly id: string
  search(query: VendorSearchQuery, signal: AbortSignal): Promise<ProviderVendor[]>
}

export type VendorProviderFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

/**
 * Stable provider-gateway contract. The gateway may use a direct directory API
 * or MCP internally; Bliss never exposes provider-specific output to the agent.
 */
export class HttpVendorSearchProvider implements VendorSearchProvider {
  readonly id: string
  private readonly endpoint: URL
  private readonly timeoutMs: number
  private readonly fetcher: VendorProviderFetch

  constructor(private readonly config: {
    endpoint: string
    token: string
    providerId?: string
    timeoutMs?: number
    fetcher?: VendorProviderFetch
  }) {
    this.id = config.providerId ?? 'vendor-provider-gateway-v1'
    try {
      this.endpoint = new URL(config.endpoint)
    } catch {
      throw new AgentGuardrailError(
        'VENDOR_PROVIDER_CONFIG_INVALID',
        'Vendor search provider endpoint is invalid',
      )
    }
    if (!['http:', 'https:'].includes(this.endpoint.protocol)) {
      throw new AgentGuardrailError(
        'VENDOR_PROVIDER_CONFIG_INVALID',
        'Vendor search provider endpoint must use HTTP or HTTPS',
      )
    }
    if (process.env['NODE_ENV'] === 'production' && this.endpoint.protocol !== 'https:') {
      throw new AgentGuardrailError(
        'VENDOR_PROVIDER_CONFIG_INVALID',
        'Vendor search provider must use HTTPS in production',
      )
    }
    if (!config.token.trim()) {
      throw new AgentGuardrailError(
        'VENDOR_PROVIDER_CONFIG_INVALID',
        'Vendor search provider token is missing',
      )
    }
    this.timeoutMs = Math.min(Math.max(config.timeoutMs ?? 8_000, 100), 30_000)
    this.fetcher = config.fetcher ?? fetch
  }

  async search(query: VendorSearchQuery, signal: AbortSignal): Promise<ProviderVendor[]> {
    const requestController = new AbortController()
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      requestController.abort(new Error('Vendor provider timed out'))
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
        body: JSON.stringify({ category: 'wedding_photographer', ...query }),
      })
      if (!response.ok) {
        throw new AgentGuardrailError(
          `VENDOR_PROVIDER_HTTP_${response.status}`,
          'Vendor search provider failed',
          response.status === 408 || response.status === 429 || response.status >= 500,
        )
      }

      const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
      if (!contentType.includes('application/json')) {
        throw new AgentGuardrailError(
          'VENDOR_PROVIDER_INVALID_RESPONSE',
          'Vendor provider returned a non-JSON response',
        )
      }
      const raw = await response.text()
      if (raw.length > 256_000) {
        throw new AgentGuardrailError(
          'VENDOR_PROVIDER_RESPONSE_TOO_LARGE',
          'Vendor provider response exceeded the safe limit',
        )
      }
      let body: unknown
      try {
        body = JSON.parse(raw)
      } catch {
        throw new AgentGuardrailError(
          'VENDOR_PROVIDER_INVALID_RESPONSE',
          'Vendor provider returned invalid JSON',
        )
      }
      const parsed = gatewayResponseSchema.safeParse(body)
      if (!parsed.success) {
        throw new AgentGuardrailError(
          'VENDOR_PROVIDER_INVALID_RESPONSE',
          'Vendor provider returned an invalid response',
        )
      }
      const ids = parsed.data.results.map(result => result.providerVendorId)
      if (new Set(ids).size !== ids.length) {
        throw new AgentGuardrailError(
          'VENDOR_PROVIDER_DUPLICATE_RESULTS',
          'Vendor provider returned duplicate candidates',
        )
      }
      return parsed.data.results.slice(0, query.limit)
    } catch (error) {
      if (error instanceof AgentGuardrailError) throw error
      if (signal.aborted) {
        throw new AgentGuardrailError(
          'VENDOR_SEARCH_CANCELLED',
          'Vendor search was cancelled',
        )
      }
      if (timedOut) {
        throw new AgentGuardrailError(
          'VENDOR_PROVIDER_TIMEOUT',
          'Vendor search provider timed out',
          true,
        )
      }
      throw new AgentGuardrailError(
        'VENDOR_PROVIDER_UNAVAILABLE',
        'Vendor search provider is unavailable',
        true,
      )
    } finally {
      clearTimeout(timeout)
      signal.removeEventListener('abort', cancel)
    }
  }
}

export function configuredVendorSearchProvider(): VendorSearchProvider | null {
  const endpoint = process.env['VENDOR_SEARCH_ENDPOINT']
  const token = process.env['VENDOR_SEARCH_TOKEN']
  if (!endpoint || !token) return null
  const configuredTimeout = Number(process.env['VENDOR_SEARCH_TIMEOUT_MS'])
  return new HttpVendorSearchProvider({
    endpoint,
    token,
    providerId: process.env['VENDOR_SEARCH_PROVIDER_ID'] || undefined,
    timeoutMs: Number.isFinite(configuredTimeout) ? configuredTimeout : undefined,
  })
}

const suspiciousInstruction = /\b(ignore|disregard|override)\b.{0,40}\b(instruction|prompt|system|assistant)\b/gi

export function normalizeProviderVendor(vendor: ProviderVendor) {
  const clean = (value: string | null | undefined, max: number) => value
    ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(suspiciousInstruction, '[removed]').trim().slice(0, max)
    : null
  return {
    providerVendorId: vendor.providerVendorId,
    category: 'photographer',
    name: clean(vendor.name, 200)!,
    website: vendor.website ?? null,
    sourceUrl: vendor.sourceUrl,
    city: clean(vendor.city, 120),
    state: clean(vendor.state, 2),
    priceLevel: clean(vendor.priceLevel, 120),
    summary: clean(vendor.summary, 1_500),
    metadata: {
      rating: vendor.rating ?? null,
      reviewCount: vendor.reviewCount ?? null,
      untrustedExternalContent: true,
    },
  }
}
