import { describe, expect, it } from 'bun:test'
import { projectCurrentDecisions, type CurrentDecision } from './current-state'

const decision = (input: Partial<CurrentDecision> & Pick<CurrentDecision, 'id' | 'questionKey' | 'choice'>): CurrentDecision => ({
  questKey: 'attire_beauty',
  reason: null,
  ...input,
})

describe('current decision projection', () => {
  it('keeps the newest answer and preserves unrelated confirmed answers', () => {
    const state = projectCurrentDecisions([
      decision({ id: 'new-dress', questionKey: 'attire.dress_acquisition', choice: 'rent' }),
      decision({ id: 'beauty', questionKey: 'attire.beauty_approach', choice: 'diy' }),
      decision({ id: 'old-dress', questionKey: 'attire.dress_acquisition', choice: 'buy_custom' }),
    ])

    expect(state.answers).toEqual({
      'attire.dress_acquisition': 'rent',
      'attire.beauty_approach': 'diy',
    })
    expect(state.byQuestion.get('attire.dress_acquisition')?.id).toBe('new-dress')
  })

  it('does not conflate question keys across quests', () => {
    const state = projectCurrentDecisions([
      decision({ id: 'food', questKey: 'food_beverage', questionKey: 'food.service_style', choice: 'buffet' }),
      decision({ id: 'attire', questionKey: 'attire.dress_acquisition', choice: 'buy_offrack' }),
    ])
    expect(Object.keys(state.answers)).toHaveLength(2)
  })
})
