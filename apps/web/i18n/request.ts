import { getRequestConfig } from 'next-intl/server'
import type { AbstractIntlMessages as Messages } from 'next-intl'
import { loadAllMessages, DEFAULT_LOCALE, isSupportedLocale } from '@bliss/i18n'

/**
 * Server-side message loading. Catalogs live in `packages/i18n` and are shared
 * with the mobile app and the API, so there is exactly one source of truth for
 * every string.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = requested && isSupportedLocale(requested) ? requested : DEFAULT_LOCALE

  // Currency is deliberately not configured here: it belongs to the wedding,
  // not to the reader's display locale.
  return {
    locale,
    messages: loadAllMessages(locale) as Messages,
  }
})
