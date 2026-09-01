import { SUPPORTED_LOCALES } from '@bliss/i18n'

const PROTECTED_PRODUCT_SEGMENTS = new Set([
  'actions',
  'assistant',
  'board',
  'dashboard',
  'moments',
  'onboarding',
  'quest',
])

export function isProtectedProductPath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  const first = segments[0]
  const routeIndex = first && (SUPPORTED_LOCALES as readonly string[]).includes(first) ? 1 : 0
  const routeSegment = segments[routeIndex]
  return routeSegment ? PROTECTED_PRODUCT_SEGMENTS.has(routeSegment) : false
}

export function protectedSignInUrl(requestUrl: string) {
  const requested = new URL(requestUrl)
  const signIn = new URL('/sign-in', requested.origin)
  signIn.searchParams.set('redirect_url', requested.toString())
  return signIn.toString()
}
