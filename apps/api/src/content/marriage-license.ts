import type { MarriageLicenseRule } from '@bliss/types'

/**
 * State-level marriage license rules.
 *
 * ⚠️ THIS IS A LOOKUP TABLE ON PURPOSE.
 *
 * Marriage license rules must never be answered from model knowledge or from
 * memory. A waiting period computed wrong means the wedding cannot legally
 * happen on the planned date, and there is no recovering from that on the day.
 *
 * Everything here is presented as general information with a disclaimer, never
 * as legal advice. Counties add their own requirements on top of state law, so
 * every surface that renders this must also render `quest.legal.disclaimer`.
 *
 * Data provenance:
 * - `waitingPeriodHours` is sourced from the research in docs/US-MARKET-PLAN.md §1.1.
 * - `validityDays` is 30-90 days nationally; where a state-specific figure is not
 *   yet sourced, the entry carries `verifyWithCounty: true` and the UI must lead
 *   with "confirm with your county clerk" rather than showing a number as fact.
 *
 * TODO before launch: source `validityDays`, `witnessesRequired`, and
 * `documentsRequired` per state from each state's own government site, and drop
 * `verifyWithCounty` as each is confirmed.
 */

export interface StateLicenseRule extends MarriageLicenseRule {
  /** True while any field is a national default rather than a sourced value. */
  verifyWithCounty: boolean
}

/** States with a statutory waiting period between issuance and use. */
const WAITING_PERIOD_HOURS: Record<string, number> = {
  AK: 72, FL: 72, IN: 72, IA: 72, KS: 72, LA: 72, ME: 72, MA: 72,
  MI: 72, MS: 72, MO: 72, NH: 72, NJ: 72, OR: 72, PA: 72, TN: 72, WA: 72,
  MD: 48,
}

/**
 * Jurisdictions where online ordination is not reliably accepted. Parts of New
 * York have invalidated marriages performed by online-ordained officiants, so
 * this is flagged rather than assumed safe.
 */
const ONLINE_ORDINATION: Record<string, MarriageLicenseRule['onlineOrdinationAccepted']> = {
  NY: 'varies_by_county',
  VA: 'varies_by_county',
  TN: 'varies_by_county',
  PA: 'varies_by_county',
  AR: 'varies_by_county',
}

const ALL_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI',
  'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN',
  'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH',
  'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
  'WV', 'WI', 'WY',
] as const

export type StateCode = (typeof ALL_STATES)[number]

/** National default while per-state validity is being sourced. Deliberately conservative. */
const DEFAULT_VALIDITY_DAYS = 30

const BASE_DOCUMENTS = [
  'legal.docs.photo_id',
  'legal.docs.birth_certificate',
  'legal.docs.ssn_if_applicable',
  'legal.docs.divorce_decree_if_applicable',
]

export const MARRIAGE_LICENSE_RULES: Record<string, StateLicenseRule> =
  Object.fromEntries(
    ALL_STATES.map(state => [
      state,
      {
        state,
        waitingPeriodHours: WAITING_PERIOD_HOURS[state] ?? 0,
        validityDays: DEFAULT_VALIDITY_DAYS,
        bothPartiesMustAppear: true,
        witnessesRequired: 1,
        onlineOrdinationAccepted: ONLINE_ORDINATION[state] ?? 'yes',
        documentsRequired: BASE_DOCUMENTS,
        noteKeys: WAITING_PERIOD_HOURS[state]
          ? ['legal.note.waiting_period_cannot_be_waived']
          : [],
        verifyWithCounty: true,
      } satisfies StateLicenseRule,
    ]),
  )

export function getMarriageLicenseRule(state: string): StateLicenseRule | null {
  return MARRIAGE_LICENSE_RULES[state.toUpperCase()] ?? null
}

/**
 * The earliest date a license may be obtained so that it is both valid on the
 * wedding day and past any waiting period. Returns null when the state is
 * unknown or no date is set.
 */
export function licenseWindow(
  state: string,
  weddingDate: Date,
): { earliest: Date; latest: Date; waitingPeriodHours: number } | null {
  const rule = getMarriageLicenseRule(state)
  if (!rule) return null

  const earliest = new Date(weddingDate)
  earliest.setDate(earliest.getDate() - rule.validityDays)

  const latest = new Date(weddingDate)
  latest.setHours(latest.getHours() - rule.waitingPeriodHours)

  return { earliest, latest, waitingPeriodHours: rule.waitingPeriodHours }
}

export function isValidStateCode(value: string): value is StateCode {
  return (ALL_STATES as readonly string[]).includes(value.toUpperCase())
}

export { ALL_STATES }
