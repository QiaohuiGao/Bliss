import { describe, expect, it } from 'bun:test'
import type { PlanningThread, QuestProgress } from '@bliss/types'
import { resolveDashboardWorkspaceEntry, workspaceEntryPath } from './workspace-entry'

const thread = (overrides: Partial<PlanningThread> = {}): PlanningThread => ({
  id: 'thread-1', weddingId: 'wedding-1', questKey: 'foundation',
  questionKey: 'foundation.funding_boundaries', title: 'Question', status: 'exploring',
  openedBy: 'member-1', currentDecisionId: null,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const progress = (overrides: Partial<QuestProgress> = {}): QuestProgress => ({
  questKey: 'foundation', status: 'in_progress', confirmedCount: 0, totalCount: 1,
  questions: [{
    questionKey: 'foundation.funding_boundaries', status: 'not_started',
    threadId: null, currentDecisionId: null,
  }],
  ...overrides,
})

describe('dashboard workspace entry', () => {
  it('keeps the welcome state only before any question thread exists', () => {
    expect(resolveDashboardWorkspaceEntry([progress()], [])).toEqual({ kind: 'intro' })
  })

  it('resumes the most recently active question', () => {
    const entry = resolveDashboardWorkspaceEntry([progress()], [
      thread({ id: 'recent', questKey: 'food_beverage', questionKey: 'food.service_style' }),
      thread({ id: 'older', questKey: 'foundation', questionKey: 'foundation.funding_boundaries' }),
    ])
    expect(entry).toEqual({ kind: 'workspace', questKey: 'food_beverage', questionKey: 'food.service_style' })
    if (entry.kind === 'workspace') {
      expect(workspaceEntryPath(entry)).toBe('/assistant/quest/food_beverage?questionKey=food.service_style')
    }
  })

  it('moves to the next unfinished question after recent threads are confirmed', () => {
    expect(resolveDashboardWorkspaceEntry([
      progress({
        questKey: 'foundation', status: 'completed', confirmedCount: 1,
        questions: [{
          questionKey: 'foundation.funding_boundaries', status: 'confirmed',
          threadId: 'thread-1', currentDecisionId: 'decision-1',
        }],
      }),
      progress({
        questKey: 'venue_date',
        questions: [{
          questionKey: 'venue.date_strategy', status: 'not_started',
          threadId: null, currentDecisionId: null,
        }],
      }),
    ], [thread({ currentDecisionId: 'decision-1' })])).toEqual({
      kind: 'workspace', questKey: 'venue_date', questionKey: 'venue.date_strategy',
    })
  })
})
