import { describe, expect, it } from 'bun:test'
import { planClaimWrite, type ClaimSource } from './write-policy'

describe('planClaimWrite', () => {
  it('activates what the couple said or chose', () => {
    for (const source of ['explicit', 'decision'] as ClaimSource[]) {
      expect(planClaimWrite(source)).toEqual({ status: 'confirmed', supersedesCurrent: true })
    }
  })

  it('holds an inference for acceptance', () => {
    expect(planClaimWrite('inferred')).toEqual({ status: 'proposed', supersedesCurrent: false })
  })

  it('never retires confirmed memory on the strength of an inference', () => {
    // The load-bearing half: a proposal that superseded would delete something the
    // couple confirmed in favour of a guess they have not seen.
    expect(planClaimWrite('inferred').supersedesCurrent).toBe(false)
  })
})
