import { z } from 'zod'
import { AgentGuardrailError } from '../errors'
import { sendEmailPayloadSchema } from '../actions/contracts'

const gatewayResponseSchema = z.object({
  messageId: z.string().trim().min(1).max(500),
  acceptedAt: z.string().datetime({ offset: true }),
  providerUrl: z.string().url().max(2_000).optional(),
}).strict()

export type SendEmailPayload = z.infer<typeof sendEmailPayloadSchema>
export type EmailProviderFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export interface EmailSendResult {
  messageId: string
  acceptedAt: string
  providerUrl?: string
}

export interface EmailSendProvider {
  readonly id: string
  /**
   * The provider must enforce at-most-once execution for `actionId` across all
   * retries. Bliss sends it as the Idempotency-Key header and request field.
   */
  send(
    payload: SendEmailPayload,
    context: { actionId: string },
    signal: AbortSignal,
  ): Promise<EmailSendResult>
}

export class HttpEmailSendProvider implements EmailSendProvider {
  readonly id: string
  private readonly endpoint: URL
  private readonly timeoutMs: number
  private readonly fetcher: EmailProviderFetch

  constructor(private readonly config: {
    endpoint: string
    token: string
    providerId?: string
    timeoutMs?: number
    fetcher?: EmailProviderFetch
  }) {
    this.id = config.providerId ?? 'email-provider-gateway-v1'
    try {
      this.endpoint = new URL(config.endpoint)
    } catch {
      throw new AgentGuardrailError(
        'EMAIL_PROVIDER_CONFIG_INVALID',
        'Email provider endpoint is invalid',
      )
    }
    if (!['http:', 'https:'].includes(this.endpoint.protocol)) {
      throw new AgentGuardrailError(
        'EMAIL_PROVIDER_CONFIG_INVALID',
        'Email provider endpoint must use HTTP or HTTPS',
      )
    }
    if (process.env['NODE_ENV'] === 'production' && this.endpoint.protocol !== 'https:') {
      throw new AgentGuardrailError(
        'EMAIL_PROVIDER_CONFIG_INVALID',
        'Email provider must use HTTPS in production',
      )
    }
    if (!config.token.trim()) {
      throw new AgentGuardrailError(
        'EMAIL_PROVIDER_CONFIG_INVALID',
        'Email provider token is missing',
      )
    }
    this.timeoutMs = Math.min(Math.max(config.timeoutMs ?? 10_000, 100), 30_000)
    this.fetcher = config.fetcher ?? fetch
  }

  async send(
    rawPayload: SendEmailPayload,
    context: { actionId: string },
    signal: AbortSignal,
  ): Promise<EmailSendResult> {
    const payload = sendEmailPayloadSchema.parse(rawPayload)
    const controller = new AbortController()
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort(new Error('Email provider timed out'))
    }, this.timeoutMs)
    const cancel = () => controller.abort(signal.reason)
    if (signal.aborted) cancel()
    else signal.addEventListener('abort', cancel, { once: true })

    try {
      const response = await this.fetcher(this.endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: `Bearer ${this.config.token}`,
          'idempotency-key': context.actionId,
        },
        body: JSON.stringify({ actionId: context.actionId, ...payload }),
      })
      if (!response.ok) {
        throw new AgentGuardrailError(
          `EMAIL_PROVIDER_HTTP_${response.status}`,
          'Email provider failed',
          response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500,
        )
      }
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
      if (!contentType.includes('application/json')) {
        throw new AgentGuardrailError(
          'EMAIL_PROVIDER_INVALID_RESPONSE',
          'Email provider returned a non-JSON response',
        )
      }
      const raw = await response.text()
      if (raw.length > 64_000) {
        throw new AgentGuardrailError(
          'EMAIL_PROVIDER_RESPONSE_TOO_LARGE',
          'Email provider response exceeded the safe limit',
        )
      }
      let body: unknown
      try {
        body = JSON.parse(raw)
      } catch {
        throw new AgentGuardrailError(
          'EMAIL_PROVIDER_INVALID_RESPONSE',
          'Email provider returned invalid JSON',
        )
      }
      const parsed = gatewayResponseSchema.safeParse(body)
      if (!parsed.success) {
        throw new AgentGuardrailError(
          'EMAIL_PROVIDER_INVALID_RESPONSE',
          'Email provider returned an invalid response',
        )
      }
      return parsed.data
    } catch (error) {
      if (error instanceof AgentGuardrailError) throw error
      if (signal.aborted) {
        throw new AgentGuardrailError('EMAIL_SEND_CANCELLED', 'Email send was cancelled')
      }
      if (timedOut) {
        throw new AgentGuardrailError('EMAIL_PROVIDER_TIMEOUT', 'Email provider timed out', true)
      }
      throw new AgentGuardrailError('EMAIL_PROVIDER_UNAVAILABLE', 'Email provider is unavailable', true)
    } finally {
      clearTimeout(timeout)
      signal.removeEventListener('abort', cancel)
    }
  }
}

export function configuredEmailSendProvider(): EmailSendProvider | null {
  const endpoint = process.env['EMAIL_SEND_ENDPOINT']
  const token = process.env['EMAIL_SEND_TOKEN']
  if (!endpoint || !token) return null
  const timeout = Number(process.env['EMAIL_SEND_TIMEOUT_MS'])
  return new HttpEmailSendProvider({
    endpoint,
    token,
    providerId: process.env['EMAIL_SEND_PROVIDER_ID'] || undefined,
    timeoutMs: Number.isFinite(timeout) ? timeout : undefined,
  })
}
