import type {
  PlanningThreadStatus,
  QuestProgress,
  QuestionProgress,
} from '@bliss/types'
import { QUEST_KEYS } from '@bliss/types'
import { PHOTOGRAPHER_QUESTION_KEY, PHOTOGRAPHER_QUEST_KEY } from '../packs/photographer'
import { getQuestScopingOverview } from '../packs/quest-scoping'

export const QUEST_PROGRESS_QUEST_KEYS = QUEST_KEYS

export type ProgressQuestKey = typeof QUEST_PROGRESS_QUEST_KEYS[number]

export interface QuestProgressThread {
  id: string
  questKey: string
  questionKey: string | null
  status: PlanningThreadStatus
  currentDecisionId: string | null
}

function questionKeysForQuest(questKey: ProgressQuestKey) {
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
