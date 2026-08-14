import { describe, expect, it } from 'bun:test'
import type { MarriageLicenseRule } from '@bliss/types'
import { isValidStateCode, licenseWindow } from './marriage-license'

const rule: MarriageLicenseRule = {
  state: 'NY',
  county: 'Kings',
  waitingPeriodHours: 24,
  validityDays: 60,
  bothPartiesMustAppear: true,
  witnessesRequired: 1,
  onlineOrdinationAccepted: 'not_verified',
  documentsRequired: ['Government-issued photo identification'],
  notes: [],
  sources: [{
    publisher: 'New York State',
    title: 'Marriage license information',
    url: 'https://health.ny.gov/example',
    retrievedAt: '2026-08-01T00:00:00.000Z',
    fieldKeys: [
      'waiting_period', 'validity_window', 'appearance',
      'witnesses', 'officiant', 'documents',
    ],
  }],
  verifiedAt: '2026-08-01T00:00:00.000Z',
  expiresAt: '2026-09-01T00:00:00.000Z',
}

describe('verified marriage-license calculations', () => {
  it('computes the window from the supplied verified rule with no hidden default', () => {
    const window = licenseWindow(rule, new Date('2027-06-15T16:00:00.000Z'))
    expect(window).toEqual({
      earliest: new Date('2027-04-16T16:00:00.000Z'),
      latest: new Date('2027-06-14T16:00:00.000Z'),
      waitingPeriodHours: 24,
    })
  })

  it('recognizes only real US state and DC codes', () => {
    expect(isValidStateCode('dc')).toBe(true)
    expect(isValidStateCode('ZZ')).toBe(false)
  })
})
