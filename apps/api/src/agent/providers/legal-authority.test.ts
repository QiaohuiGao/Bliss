import { describe, expect, it } from 'bun:test'
import {
  HttpMarriageLicenseAuthorityProvider,
  type LegalAuthorityFetch,
} from './legal-authority'

const now = () => new Date('2026-08-13T12:00:00.000Z')
const query = { state: 'NY', county: 'Kings' }

const completeRule = {
  state: 'NY',
  county: 'Kings',
  waitingPeriodHours: 24,
  validityDays: 60,
  bothPartiesMustAppear: true,
  witnessesRequired: 1,
  onlineOrdinationAccepted: 'not_verified',
  documentsRequired: ['Government-issued photo identification'],
  notes: ['Confirm the current appointment process with the issuing clerk.'],
  sources: [{
    publisher: 'New York State Department of Health',
    title: 'Marriage licenses',
    url: 'https://health.ny.gov/marriage/example',
    retrievedAt: '2026-08-10T12:00:00.000Z',
    fieldKeys: [
      'waiting_period', 'validity_window', 'appearance',
      'witnesses', 'officiant', 'documents',
    ],
  }],
  verifiedAt: '2026-08-10T12:00:00.000Z',
  expiresAt: '2026-09-10T12:00:00.000Z',
}

function response(result: unknown) {
  return new Response(JSON.stringify({ result }), {
    headers: { 'content-type': 'application/json' },
  })
}

function provider(result: unknown) {
  return new HttpMarriageLicenseAuthorityProvider({
    endpoint: 'https://legal.bliss.test/marriage-license',
    token: 'secret-token',
    now,
    fetcher: async () => response(result),
  })
}

describe('marriage-license authority boundary', () => {
  it('accepts a fresh jurisdiction-matched rule with field-level government sources', async () => {
    const result = await provider(completeRule).lookup(query, new AbortController().signal)
    expect(result).toMatchObject({
      state: 'NY',
      county: 'Kings',
      waitingPeriodHours: 24,
      validityDays: 60,
    })
  })

  it('returns no fact when the approved source system has no coverage', async () => {
    expect(await provider(null).lookup(query, new AbortController().signal)).toBeNull()
  })

  it('rejects missing field coverage and non-government sources', async () => {
    await expect(provider({
      ...completeRule,
      sources: [{ ...completeRule.sources[0], fieldKeys: ['waiting_period'] }],
    }).lookup(query, new AbortController().signal)).rejects.toMatchObject({
      code: 'LEGAL_AUTHORITY_SOURCE_INCOMPLETE',
    })

    await expect(provider({
      ...completeRule,
      sources: [{ ...completeRule.sources[0], url: 'https://wedding-blog.example/legal' }],
    }).lookup(query, new AbortController().signal)).rejects.toMatchObject({
      code: 'LEGAL_AUTHORITY_SOURCE_NOT_OFFICIAL',
    })
  })

  it('rejects stale or wrong-jurisdiction results instead of falling back', async () => {
    await expect(provider({
      ...completeRule,
      expiresAt: '2026-08-12T12:00:00.000Z',
    }).lookup(query, new AbortController().signal)).rejects.toMatchObject({
      code: 'LEGAL_AUTHORITY_DATA_STALE',
    })

    await expect(provider({
      ...completeRule,
      state: 'NJ',
    }).lookup(query, new AbortController().signal)).rejects.toMatchObject({
      code: 'LEGAL_AUTHORITY_JURISDICTION_MISMATCH',
    })
  })

  it('classifies timeout as retryable and caller cancellation as final', async () => {
    const hangingFetch: LegalAuthorityFetch = (_, init) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
    })
    const authority = new HttpMarriageLicenseAuthorityProvider({
      endpoint: 'https://legal.bliss.test/marriage-license',
      token: 'secret-token',
      timeoutMs: 100,
      now,
      fetcher: hangingFetch,
    })
    await expect(authority.lookup(query, new AbortController().signal)).rejects.toMatchObject({
      code: 'LEGAL_AUTHORITY_TIMEOUT',
      retryable: true,
    })

    const caller = new AbortController()
    const cancelled = authority.lookup(query, caller.signal)
    caller.abort(new Error('request closed'))
    await expect(cancelled).rejects.toMatchObject({
      code: 'LEGAL_AUTHORITY_CANCELLED',
      retryable: false,
    })
  })
})
