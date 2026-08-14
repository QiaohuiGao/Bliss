export interface CurrentDecision {
  id: string
  questKey: string
  questionKey: string
  choice: string
  reason: string | null
}

export interface CurrentDecisionState {
  byQuestion: Map<string, CurrentDecision>
  answers: Record<string, string>
}

/**
 * Projects append-only decision history into the one active answer per question.
 * Rows must be newest-first.
 */
export function projectCurrentDecisions(rows: readonly CurrentDecision[]): CurrentDecisionState {
  const byQuestion = new Map<string, CurrentDecision>()
  for (const row of rows) {
    if (!byQuestion.has(row.questionKey)) byQuestion.set(row.questionKey, row)
  }
  return {
    byQuestion,
    answers: Object.fromEntries(
      [...byQuestion].map(([questionKey, decision]) => [questionKey, decision.choice]),
    ),
  }
}
