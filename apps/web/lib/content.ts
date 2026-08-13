'use client'

import { useLocale } from 'next-intl'
import { translate } from '@bliss/i18n'

/**
 * Renders database-generated content (`quest.*` and `culture.*` keys) in the
 * reader's locale.
 *
 * Module, sub-module, and task rows store an `i18nKey` alongside a rendered
 * `title`. The key is the source of truth: the stored title is frozen at
 * generation time and is only a fallback and a search field. User-authored rows
 * have a null key and must be rendered verbatim, never translated.
 */
export function useContent() {
  const locale = useLocale()

  return function content(
    i18nKey: string | null,
    fallback: string,
    params?: Record<string, string | number | Date>,
  ): string {
    if (!i18nKey) return fallback
    const rendered = translate(locale, i18nKey, params)
    // translate() echoes the key when it is missing from the catalog.
    return rendered === i18nKey ? fallback : rendered
  }
}
