import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatMoney } from '@bliss/i18n'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Money formatting. Currency is a property of the wedding, not of the reader's
 * display locale, so it is passed in rather than derived.
 *
 * There is deliberately no `daysUntilText` here anymore. Countdown copy is an
 * ICU message (`board.countdown`) rendered by the component, because plural
 * rules differ per locale and string concatenation cannot express them.
 */
export function formatCents(
  cents: number,
  locale = 'en',
  currency = 'USD',
): string {
  return formatMoney(cents, locale, currency)
}

/** Whole months remaining, for switching between day and month countdown copy. */
export function monthsUntil(days: number): number {
  return Math.floor(days / 30)
}
