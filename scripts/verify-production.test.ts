import { describe, expect, it } from 'bun:test'
import { verifyProductionDeployment } from './verify-production'

function htmlResponse(status = 200, url?: string) {
  const response = new Response('<!doctype html><html><body>Bliss</body></html>', { status })
  if (url) Object.defineProperty(response, 'url', { value: url })
  return response
}

function webRouteResponse(url: string, init?: RequestInit) {
  const protectedRoutes = [
    '/onboarding',
    '/dashboard',
    '/assistant/quest/foundation',
    '/assistant/quest/vendor_team',
  ]
  if (init?.redirect === 'manual' && protectedRoutes.some(route => url.endsWith(route))) {
    return new Response('', {
      status: 307,
      headers: { location: `https://bliss.example/sign-in?redirect_url=${encodeURIComponent(url)}` },
    })
  }
  return htmlResponse()
}

describe('production deployment verification', () => {
  it('passes only when routes, database, capabilities, and cron boundary are healthy', async () => {
    const requested: string[] = []
    const result = await verifyProductionDeployment({
      webUrl: 'https://bliss.example',
      apiUrl: 'https://api.bliss.example',
      fetcher: (async (input, init) => {
        const url = String(input)
        requested.push(url)
        if (url.endsWith('/health')) {
          return Response.json({ status: 'ok', database: 'ok' })
        }
        if (url.endsWith('/readiness')) {
          return Response.json({
            status: 'ready',
            database: 'ok',
            capabilities: {
              agent: true,
              vendorSearch: true,
              legalAuthority: true,
              emailSend: true,
              privateMedia: true,
            },
          })
        }
        if (url.endsWith('/me/wedding') && init?.method === 'OPTIONS') {
          return new Response('', {
            status: 204,
            headers: {
              'access-control-allow-origin': 'https://bliss.example',
              'access-control-allow-credentials': 'true',
            },
          })
        }
        if (url.endsWith('/me/wedding')) return new Response('', { status: 401 })
        if (url.endsWith('/api/cron/reminders')) return new Response('', { status: 401 })
        return webRouteResponse(url, init)
      }) as typeof fetch,
    })

    expect(result).toMatchObject({
      webRoutes: 7,
      database: 'ok',
      webAuthBoundary: 'protected',
      corsBoundary: 'allowed',
      authBoundary: 'protected',
      cronBoundary: 'protected',
    })
    expect(requested).toHaveLength(12)
  })

  it('fails a partial deployment even when its liveness endpoint is healthy', async () => {
    const verification = verifyProductionDeployment({
      webUrl: 'https://bliss.example',
      apiUrl: 'https://api.bliss.example',
      fetcher: (async (input, init) => {
        const url = String(input)
        if (url.endsWith('/health')) {
          return Response.json({ status: 'ok', database: 'ok' })
        }
        if (url.endsWith('/readiness')) {
          return Response.json({
            status: 'not_ready',
            database: 'ok',
            capabilities: {
              agent: true,
              vendorSearch: false,
              legalAuthority: false,
              emailSend: false,
              privateMedia: true,
            },
          }, { status: 503 })
        }
        if (url.endsWith('/me/wedding') && init?.method === 'OPTIONS') {
          return new Response('', {
            status: 204,
            headers: {
              'access-control-allow-origin': 'https://bliss.example',
              'access-control-allow-credentials': 'true',
            },
          })
        }
        if (url.endsWith('/me/wedding')) return new Response('', { status: 401 })
        if (url.endsWith('/api/cron/reminders')) return new Response('', { status: 401 })
        return webRouteResponse(url, init)
      }) as typeof fetch,
    })

    await expect(verification).rejects.toThrow(
      'missing product capabilities: vendorSearch, legalAuthority, emailSend',
    )
  })

  it('rejects an HTML login page reached through an external deployment-protection redirect', async () => {
    const verification = verifyProductionDeployment({
      webUrl: 'https://bliss.example',
      apiUrl: 'https://api.bliss.example',
      fetcher: (async () => htmlResponse(200, 'https://vercel.com/sso-api')) as typeof fetch,
    })

    await expect(verification).rejects.toThrow(
      'redirected outside the deployed web origin',
    )
  })

  it('fails when a signed-in product route is only client-side protected', async () => {
    const verification = verifyProductionDeployment({
      webUrl: 'https://bliss.example',
      apiUrl: 'https://api.bliss.example',
      fetcher: (async () => htmlResponse()) as typeof fetch,
    })

    await expect(verification).rejects.toThrow('returned 200; expected 307')
  })

  it('fails when the API does not authorize the deployed web origin', async () => {
    const verification = verifyProductionDeployment({
      webUrl: 'https://bliss.example',
      apiUrl: 'https://api.bliss.example',
      fetcher: (async (input, init) => {
        const url = String(input)
        if (url.endsWith('/health')) {
          return Response.json({ status: 'ok', database: 'ok' })
        }
        if (url.endsWith('/readiness')) {
          return Response.json({
            status: 'ready',
            database: 'ok',
            capabilities: {
              agent: true,
              vendorSearch: true,
              legalAuthority: true,
              emailSend: true,
              privateMedia: true,
            },
          })
        }
        if (url.endsWith('/me/wedding') && init?.method === 'OPTIONS') {
          return new Response('', {
            status: 204,
            headers: {
              'access-control-allow-origin': 'https://different.example',
              'access-control-allow-credentials': 'true',
            },
          })
        }
        return webRouteResponse(url, init)
      }) as typeof fetch,
    })

    await expect(verification).rejects.toThrow(
      'API CORS response did not authorize the deployed web origin',
    )
  })

  it('requires HTTPS unless the caller explicitly verifies localhost', async () => {
    await expect(verifyProductionDeployment({
      webUrl: 'http://bliss.example',
      apiUrl: 'https://api.bliss.example',
      fetcher: (async () => htmlResponse()) as typeof fetch,
    })).rejects.toThrow('Production URL must use HTTPS')
  })
})
