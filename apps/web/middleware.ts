import { clerkMiddleware } from '@clerk/nextjs/server'
import createIntlMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

const intlMiddleware = createIntlMiddleware(routing)

/**
 * Clerk runs first so auth context is attached, then next-intl resolves the
 * locale segment. Order matters: next-intl rewrites the pathname, and Clerk's
 * route matchers should see the original one.
 */
export default clerkMiddleware((_auth, req) => intlMiddleware(req))

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
