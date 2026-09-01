import { describe, expect, it } from 'bun:test'
import { isProtectedProductPath, protectedSignInUrl } from './protected-routes'

describe('protected product routes', () => {
  it('protects every signed-in product surface with or without a locale prefix', () => {
    const routes = [
      '/actions',
      '/assistant/quest/foundation',
      '/board',
      '/dashboard',
      '/moments',
      '/onboarding',
      '/quest/foundation',
    ]

    for (const route of routes) {
      expect(isProtectedProductPath(route)).toBe(true)
      expect(isProtectedProductPath(`/en${route}`)).toBe(true)
    }
  })

  it('keeps landing, auth, invitations, assets, and APIs outside page redirects', () => {
    const routes = [
      '/',
      '/en',
      '/sign-in',
      '/sign-up',
      '/join/invite-token',
      '/api/cron/reminders',
      '/_next/static/chunk.js',
    ]

    for (const route of routes) expect(isProtectedProductPath(route)).toBe(false)
  })

  it('matches complete route segments rather than similar prefixes', () => {
    expect(isProtectedProductPath('/dashboard-preview')).toBe(false)
    expect(isProtectedProductPath('/enough/dashboard')).toBe(false)
  })

  it('returns signed-out users to the exact protected page after sign-in', () => {
    expect(protectedSignInUrl('https://bliss.example/assistant/quest/foundation?question=values')).toBe(
      'https://bliss.example/sign-in?redirect_url=https%3A%2F%2Fbliss.example%2Fassistant%2Fquest%2Ffoundation%3Fquestion%3Dvalues',
    )
  })
})
