import { describe, expect, it } from 'bun:test'
import {
  HttpEmailSendProvider,
  type EmailProviderFetch,
} from './email-send'

const payload = {
  subject: 'Photography availability',
  body: 'Are you available on October 16?',
  recipients: ['studio@example.com'],
  replyTo: 'couple@example.com',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('email send provider boundary', () => {
  it('uses the action ID as the provider idempotency key', async () => {
    let request: Request | undefined
    const provider = new HttpEmailSendProvider({
      endpoint: 'https://providers.bliss.test/email/send',
      token: 'secret-token',
      fetcher: async (input, init) => {
        request = input instanceof Request
          ? new Request(input, init)
          : new Request(input.toString(), init)
        return jsonResponse({
          messageId: 'message-1',
          acceptedAt: '2026-08-13T12:00:00.000Z',
        })
      },
    })

    const result = await provider.send(
      payload,
      { actionId: 'action-1' },
      new AbortController().signal,
    )

    expect(result.messageId).toBe('message-1')
    expect(request?.headers.get('idempotency-key')).toBe('action-1')
    expect(request?.headers.get('authorization')).toBe('Bearer secret-token')
    expect(await request?.json()).toEqual({ actionId: 'action-1', ...payload })
  })

  it('classifies throttling and server errors as safe to retry', async () => {
    for (const status of [429, 503]) {
      const provider = new HttpEmailSendProvider({
        endpoint: 'https://providers.bliss.test/email/send',
        token: 'secret-token',
        fetcher: async () => new Response('private provider error', { status }),
      })
      await expect(provider.send(
        payload,
        { actionId: `action-${status}` },
        new AbortController().signal,
      )).rejects.toMatchObject({
        code: `EMAIL_PROVIDER_HTTP_${status}`,
        retryable: true,
        message: 'Email provider failed',
      })
    }
  })

  it('rejects malformed success responses without guessing delivery', async () => {
    const provider = new HttpEmailSendProvider({
      endpoint: 'https://providers.bliss.test/email/send',
      token: 'secret-token',
      fetcher: async () => jsonResponse({ accepted: true }),
    })
    await expect(provider.send(
      payload,
      { actionId: 'action-malformed' },
      new AbortController().signal,
    )).rejects.toMatchObject({
      code: 'EMAIL_PROVIDER_INVALID_RESPONSE',
      retryable: false,
    })
  })

  it('distinguishes retryable provider timeout from caller cancellation', async () => {
    const hangingFetch: EmailProviderFetch = (_, init) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
    })
    const provider = new HttpEmailSendProvider({
      endpoint: 'https://providers.bliss.test/email/send',
      token: 'secret-token',
      timeoutMs: 100,
      fetcher: hangingFetch,
    })
    await expect(provider.send(
      payload,
      { actionId: 'action-timeout' },
      new AbortController().signal,
    )).rejects.toMatchObject({ code: 'EMAIL_PROVIDER_TIMEOUT', retryable: true })

    const caller = new AbortController()
    const cancelled = provider.send(payload, { actionId: 'action-cancelled' }, caller.signal)
    caller.abort(new Error('request closed'))
    await expect(cancelled).rejects.toMatchObject({ code: 'EMAIL_SEND_CANCELLED', retryable: false })
  })
})
