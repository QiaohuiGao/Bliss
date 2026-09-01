export interface ProductionVerificationInput {
  webUrl: string
  apiUrl: string
  allowInsecureLocalhost?: boolean
  fetcher?: typeof fetch
}

export interface ProductionVerificationResult {
  webRoutes: number
  database: 'ok'
  capabilities: Record<string, boolean>
  webAuthBoundary: 'protected'
  corsBoundary: 'allowed'
  authBoundary: 'protected'
  cronBoundary: 'protected'
}

function normalizedBaseUrl(value: string, allowInsecureLocalhost = false) {
  const url = new URL(value)
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (url.protocol !== 'https:' && !(allowInsecureLocalhost && isLocalhost)) {
    throw new Error(`Production URL must use HTTPS: ${url.origin}`)
  }
  return url.toString().replace(/\/$/, '')
}

async function expectStatus(
  fetcher: typeof fetch,
  url: string,
  expectedStatus: number,
  init?: RequestInit,
) {
  const response = await fetcher(url, {
    ...init,
    redirect: init?.redirect ?? 'manual',
    signal: AbortSignal.timeout(10_000),
  })
  if (response.status !== expectedStatus) {
    throw new Error(`${url} returned ${response.status}; expected ${expectedStatus}`)
  }
  return response
}

export async function verifyProductionDeployment(
  input: ProductionVerificationInput,
): Promise<ProductionVerificationResult> {
  const fetcher = input.fetcher ?? fetch
  const webUrl = normalizedBaseUrl(input.webUrl, input.allowInsecureLocalhost)
  const apiUrl = normalizedBaseUrl(input.apiUrl, input.allowInsecureLocalhost)
  const webOrigin = new URL(webUrl).origin
  const publicWebRoutes = [
    '/',
    '/sign-up',
    '/sign-in',
  ]
  const protectedWebRoutes = [
    '/onboarding',
    '/dashboard',
    '/assistant/quest/foundation',
    '/assistant/quest/vendor_team',
  ]

  for (const route of publicWebRoutes) {
    const response = await expectStatus(fetcher, `${webUrl}${route}`, 200, {
      redirect: 'follow',
    })
    if (response.url && new URL(response.url).origin !== webOrigin) {
      throw new Error(`${webUrl}${route} redirected outside the deployed web origin`)
    }
    const html = await response.text()
    if (!html.toLowerCase().includes('<!doctype html')) {
      throw new Error(`${webUrl}${route} did not return an HTML document`)
    }
  }

  for (const route of protectedWebRoutes) {
    const response = await expectStatus(fetcher, `${webUrl}${route}`, 307)
    const location = response.headers.get('location')
    if (!location) throw new Error(`${webUrl}${route} did not redirect signed-out users`)
    const redirectUrl = new URL(location, webUrl)
    if (
      redirectUrl.origin !== webOrigin
      || redirectUrl.pathname !== '/sign-in'
      || redirectUrl.searchParams.get('redirect_url') !== `${webUrl}${route}`
    ) {
      throw new Error(`${webUrl}${route} did not redirect to the deployed sign-in page`)
    }
  }

  const healthResponse = await expectStatus(fetcher, `${apiUrl}/health`, 200)
  const health = await healthResponse.json() as {
    status?: string
    database?: string
  }
  if (health.status !== 'ok' || health.database !== 'ok') {
    throw new Error('API health response did not report a usable database')
  }

  const corsResponse = await expectStatus(fetcher, `${apiUrl}/me/wedding`, 204, {
    method: 'OPTIONS',
    headers: {
      origin: webOrigin,
      'access-control-request-method': 'GET',
      'access-control-request-headers': 'authorization',
    },
  })
  if (
    corsResponse.headers.get('access-control-allow-origin') !== webOrigin
    || corsResponse.headers.get('access-control-allow-credentials') !== 'true'
  ) {
    throw new Error('API CORS response did not authorize the deployed web origin')
  }

  await expectStatus(fetcher, `${apiUrl}/me/wedding`, 401)
  await expectStatus(fetcher, `${webUrl}/api/cron/reminders`, 401)

  const readinessUrl = `${apiUrl}/readiness`
  const readinessResponse = await fetcher(readinessUrl, {
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  })
  const readiness = await readinessResponse.json() as {
    status?: string
    database?: string
    capabilities?: Record<string, boolean>
  }
  if (readinessResponse.status !== 200) {
    const missing = readiness.capabilities
      ? Object.entries(readiness.capabilities)
          .filter(([, available]) => available !== true)
          .map(([capability]) => capability)
      : []
    const detail = missing.length > 0
      ? `; missing product capabilities: ${missing.join(', ')}`
      : ''
    throw new Error(`${readinessUrl} returned ${readinessResponse.status}; expected 200${detail}`)
  }
  if (
    readiness.status !== 'ready'
    || readiness.database !== 'ok'
    || !readiness.capabilities
    || Object.values(readiness.capabilities).some(value => value !== true)
  ) {
    throw new Error('API readiness response did not report every product capability')
  }

  return {
    webRoutes: publicWebRoutes.length + protectedWebRoutes.length,
    database: 'ok',
    capabilities: readiness.capabilities,
    webAuthBoundary: 'protected',
    corsBoundary: 'allowed',
    authBoundary: 'protected',
    cronBoundary: 'protected',
  }
}

if (import.meta.main) {
  const webUrl = process.env['PRODUCTION_WEB_URL']
  const apiUrl = process.env['PRODUCTION_API_URL']
  if (!webUrl || !apiUrl) {
    throw new Error('PRODUCTION_WEB_URL and PRODUCTION_API_URL are required')
  }
  const result = await verifyProductionDeployment({
    webUrl,
    apiUrl,
    allowInsecureLocalhost: process.env['ALLOW_INSECURE_LOCALHOST'] === '1',
  })
  console.log('PASS: production deployment verification')
  console.log(`  web routes: ${result.webRoutes}`)
  console.log(`  capabilities: ${Object.keys(result.capabilities).length}`)
  console.log(`  web auth boundary: ${result.webAuthBoundary}`)
  console.log(`  CORS boundary: ${result.corsBoundary}`)
  console.log(`  auth boundary: ${result.authBoundary}`)
  console.log(`  cron boundary: ${result.cronBoundary}`)
}
