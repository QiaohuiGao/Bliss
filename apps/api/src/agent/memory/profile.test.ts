import { describe, expect, it } from 'bun:test'
import { projectMemoryProfile, type MemoryProfileClaim } from './projection'

const claim = (
  id: string,
  subjectType: MemoryProfileClaim['subjectType'],
  subjectId: string | null,
): MemoryProfileClaim => ({
  id,
  subjectType,
  subjectId,
  kind: 'preference',
  key: `key.${id}`,
  value: id,
  source: 'explicit',
  confidenceBasisPoints: 10_000,
  createdAt: new Date('2026-08-13'),
})

describe('memory profile projection', () => {
  it('keeps wedding, couple, and attributed member memory separate', () => {
    const profile = projectMemoryProfile([
      claim('wedding', 'wedding', null),
      claim('couple', 'couple', null),
      claim('a', 'member', 'member-a'),
      claim('b', 'member', 'member-b'),
    ])
    expect(profile.wedding.map(item => item.id)).toEqual(['wedding'])
    expect(profile.couple.map(item => item.id)).toEqual(['couple'])
    expect(profile.members['member-a']?.map(item => item.id)).toEqual(['a'])
    expect(profile.members['member-b']?.map(item => item.id)).toEqual(['b'])
  })

  it('does not turn an unattributed member claim into couple memory', () => {
    const profile = projectMemoryProfile([claim('orphan', 'member', null)])
    expect(profile).toEqual({ wedding: [], couple: [], members: {}, memberNames: {} })
  })
})
