export function activeDecisionScope(input: {
  threadId: string
  questKey: string
  questionKey: string
  currentConfirmedChoice: string | null
  conversationStatus: string
  currentDecisionId: string | null
}) {
  return input
}
