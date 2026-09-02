import type { PlanningThread, QuestProgress } from '@bliss/types'
import { QUEST_KEYS } from '@bliss/types'

export type DashboardWorkspaceEntry =
  | { kind: 'intro' }
  | { kind: 'workspace'; questKey: string; questionKey: string }

export function resolveDashboardWorkspaceEntry(
  progress: QuestProgress[],
  recentThreads: PlanningThread[],
): DashboardWorkspaceEntry {
  const questionThreads = recentThreads.filter((thread): thread is PlanningThread & { questionKey: string } => (
    Boolean(thread.questionKey)
  ))
  if (questionThreads.length === 0) return { kind: 'intro' }

  const latestActive = questionThreads.find(thread => !thread.currentDecisionId)
  if (latestActive) {
    return { kind: 'workspace', questKey: latestActive.questKey, questionKey: latestActive.questionKey }
  }

  for (const questKey of QUEST_KEYS) {
    const quest = progress.find(item => item.questKey === questKey)
    const nextQuestion = quest?.questions.find(question => question.status !== 'confirmed')
    if (nextQuestion) {
      return { kind: 'workspace', questKey, questionKey: nextQuestion.questionKey }
    }
  }

  const latest = questionThreads[0]!
  return { kind: 'workspace', questKey: latest.questKey, questionKey: latest.questionKey }
}

export function workspaceEntryPath(entry: Extract<DashboardWorkspaceEntry, { kind: 'workspace' }>) {
  return `/assistant/quest/${entry.questKey}?questionKey=${encodeURIComponent(entry.questionKey)}`
}
