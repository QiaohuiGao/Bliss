/**
 * Locale metadata. Adding a locale should be: create the folder, add one entry
 * here, translate. No other file should need to change — that is the acceptance
 * criterion for this package. See docs/I18N.md.
 */

export const SUPPORTED_LOCALES = ['en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

/**
 * The default locale is served without a URL prefix (`/board`, not `/en/board`)
 * to preserve existing URLs and SEO.
 */
export const LOCALE_PREFIX = 'as-needed' as const

/** Right-to-left locales. Empty today; wired now so Arabic/Hebrew stay cheap later. */
export const RTL_LOCALES: readonly string[] = ['ar', 'he', 'fa', 'ur']

export function isRtl(locale: string): boolean {
  return RTL_LOCALES.includes(locale.split('-')[0]!)
}

export function dirFor(locale: string): 'ltr' | 'rtl' {
  return isRtl(locale) ? 'rtl' : 'ltr'
}

/**
 * Fallback chain, e.g. `es-MX` -> `es` -> `en`. `en` is the guaranteed backstop,
 * so a missing key degrades to English rather than to a raw key name.
 */
export function fallbackChain(locale: string): string[] {
  const chain: string[] = []
  const parts = locale.split('-')
  for (let i = parts.length; i > 0; i--) chain.push(parts.slice(0, i).join('-'))
  if (!chain.includes(DEFAULT_LOCALE)) chain.push(DEFAULT_LOCALE)
  return chain
}

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/** Resolve an `Accept-Language` header down to a supported locale. */
export function resolveLocale(acceptLanguage?: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE
  const candidates = acceptLanguage
    .split(',')
    .map(part => {
      const [tag, q] = part.trim().split(';q=')
      return { tag: tag!.trim(), q: q ? Number(q) : 1 }
    })
    .sort((a, b) => b.q - a.q)

  for (const { tag } of candidates) {
    for (const candidate of fallbackChain(tag)) {
      if (isSupportedLocale(candidate)) return candidate
    }
  }
  return DEFAULT_LOCALE
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Currency is a property of the wedding, not of the reader. A Spanish-speaking
 * couple marrying in Texas sees `$34,200`, never `34.200 €`.
 */
export function formatMoney(cents: number, locale: string, currency = 'USD'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

export function formatDate(
  date: Date | string,
  locale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale, options).format(d)
}

/** Never hand-build relative time strings — pluralization differs per locale. */
export function formatRelativeDays(days: number, locale: string): string {
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(days, 'day')
}

export const NAMESPACES = [
  'common',
  'onboarding',
  'board',
  'quest',
  'errors',
  'glossary',
  'assistant',
  'moments',
  'actions',
  'photographer',
] as const

export type Namespace = (typeof NAMESPACES)[number]
