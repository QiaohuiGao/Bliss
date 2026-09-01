import { describe, expect, it } from 'bun:test'
import type { PlanningThreadStatus } from '@bliss/types'
import { projectQuestProgress, type QuestProgressThread } from './quest-progress'

const thread = (input: Partial<QuestProgressThread> & Pick<QuestProgressThread, 'id' | 'questKey' | 'questionKey'>): QuestProgressThread => ({
  status: 'open' as PlanningThreadStatus,
  currentDecisionId: null,
  ...input,
})

describe('quest progress projection', () => {
  it('keeps an untouched quest not started', () => {
    const foundation = projectQuestProgress([]).find(quest => quest.questKey === 'foundation')
    expect(foundation?.status).toBe('not_started')
    expect(foundation?.confirmedCount).toBe(0)
    expect(foundation?.questions.every(question => question.status === 'not_started')).toBe(true)
  })

  it('projects conversation status independently from confirmation', () => {
    const foundation = projectQuestProgress([
      thread({
        id: 'thread-1',
        questKey: 'foundation',
        questionKey: 'foundation.funding_boundaries',
        status: 'contested',
      }),
    ]).find(quest => quest.questKey === 'foundation')
    expect(foundation?.status).toBe('in_progress')
    expect(foundation?.questions.find(question => question.questionKey === 'foundation.funding_boundaries')?.status).toBe('contested')
    expect(foundation?.confirmedCount).toBe(0)
  })

  it('treats a confirmed decision as confirmed even when the thread remains open', () => {
    const foundation = projectQuestProgress([
      thread({
        id: 'thread-1',
        questKey: 'foundation',
        questionKey: 'foundation.funding_boundaries',
        status: 'open',
        currentDecisionId: 'decision-1',
      }),
    ]).find(quest => quest.questKey === 'foundation')
    const question = foundation?.questions.find(item => item.questionKey === 'foundation.funding_boundaries')
    expect(question?.status).toBe('confirmed')
    expect(question?.currentDecisionId).toBe('decision-1')
  })

  it('completes a quest only after every authored question is confirmed', () => {
    const untouched = projectQuestProgress([]).find(quest => quest.questKey === 'attire_beauty')
    const completed = projectQuestProgress([
      thread({
        id: 'attire-dress-thread',
        questKey: 'attire_beauty',
        questionKey: 'attire.dress_acquisition',
        currentDecisionId: 'attire-dress-decision',
      }),
      thread({
        id: 'attire-suit-thread',
        questKey: 'attire_beauty',
        questionKey: 'attire.suit_acquisition',
        currentDecisionId: 'attire-suit-decision',
      }),
      thread({
        id: 'attire-beauty-thread',
        questKey: 'attire_beauty',
        questionKey: 'attire.beauty_approach',
        currentDecisionId: 'attire-beauty-decision',
      }),
      thread({
        id: 'attire-second-look-thread',
        questKey: 'attire_beauty',
        questionKey: 'attire.second_look',
        currentDecisionId: 'attire-second-look-decision',
      }),
    ]).find(quest => quest.questKey === 'attire_beauty')
    expect(untouched?.status).toBe('not_started')
    expect(untouched?.totalCount).toBe(4)
    expect(completed?.status).toBe('completed')
    expect(completed?.confirmedCount).toBe(completed?.totalCount)
  })

  it('does not let a question thread affect another quest', () => {
    const progress = projectQuestProgress([
      thread({
        id: 'food-thread',
        questKey: 'food_beverage',
        questionKey: 'food.service_style',
        status: 'exploring',
      }),
    ])
    expect(progress.find(quest => quest.questKey === 'food_beverage')?.status).toBe('in_progress')
    expect(progress.find(quest => quest.questKey === 'ceremony')?.status).toBe('not_started')
  })
})
