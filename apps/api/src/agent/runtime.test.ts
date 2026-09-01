import { describe, expect, it } from 'bun:test'
import { QUEST_KEYS } from '@bliss/types'
import { activeDecisionScope } from './scope'
import { QUEST_SCOPING_ARTIFACT_BUNDLES } from './artifacts/registry'

describe('active decision prompt scope', () => {
  it('injects both the permanent thread and exact authored question', () => {
    expect(activeDecisionScope({
      threadId: 'thread-1',
      questKey: 'foundation',
      questionKey: 'foundation.decision_rhythm',
      currentConfirmedChoice: null,
      conversationStatus: 'exploring',
      currentDecisionId: null,
    })).toEqual({
      threadId: 'thread-1',
      questKey: 'foundation',
      questionKey: 'foundation.decision_rhythm',
      currentConfirmedChoice: null,
      conversationStatus: 'exploring',
      currentDecisionId: null,
    })
  })
})

describe('generic question agent coverage', () => {
  it('covers every chapter in the fourteen-quest product journey', () => {
    expect(Object.keys(QUEST_SCOPING_ARTIFACT_BUNDLES)).toEqual([...QUEST_KEYS])
  })

  it('keeps the Vendor Team coverage question usable without live vendor search', () => {
    expect(QUEST_SCOPING_ARTIFACT_BUNDLES.vendor_team.packKey)
      .toBe('vendor_team:scoping')
  })
})
