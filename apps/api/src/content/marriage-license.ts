import type { MarriageLicenseRule } from '@bliss/types'

/**
 * Legal facts never have national fallbacks in Bliss.
 *
 * A MarriageLicenseRule may enter the system only through the authority provider
 * in `agent/providers/legal-authority.ts`. That adapter requires fresh official
 * sources for every factual field. If coverage is missing or stale, the product
 * asks the couple to verify with the issuing office and performs no calculation.
 */

export const ALL_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI',
  'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN',
  'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH',
  'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
  'WV', 'WI', 'WY',
] as const

export type StateCode = (typeof ALL_STATES)[number]

export function isValidStateCode(value: string): value is StateCode {
  return (ALL_STATES as readonly string[]).includes(value.toUpperCase())
}

/**
 * Computes a planning window only from an already verified authority result.
 * The provider rejects expired results before this function can be called.
 */
export function licenseWindow(
  rule: MarriageLicenseRule,
  weddingDate: Date,
): { earliest: Date; latest: Date; waitingPeriodHours: number } {
  const earliest = new Date(weddingDate)
  earliest.setUTCDate(earliest.getUTCDate() - rule.validityDays)

  const latest = new Date(weddingDate)
  latest.setUTCHours(latest.getUTCHours() - rule.waitingPeriodHours)

  return { earliest, latest, waitingPeriodHours: rule.waitingPeriodHours }
}
