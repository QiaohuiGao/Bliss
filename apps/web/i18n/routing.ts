import { defineRouting } from 'next-intl/routing'
import { createNavigation } from 'next-intl/navigation'
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@bliss/i18n'

export const routing = defineRouting({
  locales: [...SUPPORTED_LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  // The default locale is served without a prefix (`/board`, not `/en/board`)
  // so existing URLs and their SEO survive the i18n migration.
  localePrefix: 'as-needed',
})

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
