import { afterEach, describe, expect, test } from 'bun:test'
import { api, ApiError } from './api'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('API error contract', () => {
  test('preserves the response status for recoverable onboarding flows', async () => {
    globalThis.fetch = (async () => new Response(
      JSON.stringify({ error: 'No wedding found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )) as unknown as typeof fetch

    try {
      await api.getMyWedding('token')
      throw new Error('Expected request to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(404)
      expect((error as Error).message).toBe('No wedding found')
    }
  })
})
