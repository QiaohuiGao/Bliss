import type {
  PlanningThreadStatus,
  QuestProgress,
  QuestionProgress,
} from '@bliss/types'
import { ATTIRE_QUESTION_KEY, ATTIRE_QUEST_KEY } from '../packs/attire'
import { PHOTOGRAPHER_QUESTION_KEY, PHOTOGRAPHER_QUEST_KEY } from '../packs/photographer'
import { getQuestScopingOverview } from '../packs/quest-scoping'

export const QUEST_PROGRESS_QUEST_KEYS = [
  'foundation',
  'venue_date',
  'vendor_team',
  'wedding_party',
  'attire_beauty',
  'guests_stationery',
  'guest_experience',
  'food_beverage',
  'design_flowers',
  'ceremony',
  'registry_rings_honeymoon',
  'legal',
  'pre_wedding_events',
  'final_30_and_day_of',
] as const

export type ProgressQuestKey = typeof QUEST_PROGRESS_QUEST_KEYS[number]

export interface QuestProgressThread {
  id: string
  questKey: string
  questionKey: string | null
  status: PlanningThreadStatus
  currentDecisionId: string | null
}

function questionKeysForQuest(questKey: ProgressQuestKey) {
  if (questKey === ATTIRE_QUEST_KEY) return [ATTIRE_QUESTION_KEY]
  if (questKey === PHOTOGRAPHER_QUEST_KEY) return [PHOTOGRAPHER_QUESTION_KEY]
  return getQuestScopingOverview(questKey, {}).questions.map(question => question.questionKey)
}

function projectQuestion(
  questionKey: string,
  threadsByQuestion: Map<string, QuestProgressThread>,
): QuestionProgress {
  const thread = threadsByQuestion.get(questionKey)
  if (!thread) {
    return {
      questionKey,
      status: 'not_started',
      threadId: null,
      currentDecisionId: null,
    }
  }
  return {
    questionKey,
    status: thread.currentDecisionId ? 'confirmed' : thread.status,
    threadId: thread.id,
    currentDecisionId: thread.currentDecisionId,
  }
}

export function projectQuestProgress(threads: QuestProgressThread[]): QuestProgress[] {
  const threadsByQuest = new Map<string, Map<string, QuestProgressThread>>()
  for (const thread of threads) {
    if (!thread.questionKey) continue
    const byQuestion = threadsByQuest.get(thread.questKey) ?? new Map<string, QuestProgressThread>()
    byQuestion.set(thread.questionKey, thread)
    threadsByQuest.set(thread.questKey, byQuestion)
  }

  return QUEST_PROGRESS_QUEST_KEYS.map(questKey => {
    const questionKeys = questionKeysForQuest(questKey)
    const threadsForQuest = threadsByQuest.get(questKey) ?? new Map<string, QuestProgressThread>()
    const questions = questionKeys.map(questionKey => projectQuestion(questionKey, threadsForQuest))
    const confirmedCount = questions.filter(question => question.status === 'confirmed').length
    const hasStarted = questions.some(question => question.status !== 'not_started')
    return {
      questKey,
      status: confirmedCount === questions.length
        ? 'completed'
        : hasStarted
          ? 'in_progress'
          : 'not_started',
      confirmedCount,
      totalCount: questions.length,
      questions,
    }
  })
}
