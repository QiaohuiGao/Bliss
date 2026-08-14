import type { AgentModelResult, DecisionPacket } from '../types'
import type { QuestScopingEvalCase } from './quest-scoping-suite'

const call = (id: string, name: string, input: unknown): AgentModelResult => ({
  toolCalls: [{ id, name, input }],
  usage: { inputTokens: 100, outputTokens: 40, costMicros: 100 },
})

const packet = (overrides: Partial<DecisionPacket> = {}): DecisionPacket => ({
  schemaVersion: 1,
  threadId: 'thread-1',
  questKey: 'foundation',
  questionKey: 'foundation.funding_boundaries',
  state: 'ready',
  summary: 'The couple made the money and decision boundary explicit.',
  proposedChoice: 'still_unclear',
  reason: 'They need a clear contribution conversation before treating family money as available.',
  alternativesConsidered: [],
  memberInputs: [],
  taskEffects: [{ taskKey: 'clarify_family_contributions', rationale: 'Turn a vague promise into a usable answer.' }],
  memoryEffects: [],
  externalActions: [],
  vendorEffects: [],
  momentCandidate: null,
  ...overrides,
})

const explorationCases: QuestScopingEvalCase[] = [
  'Has anyone offered money, and did they say what they expect to influence in return?',
  'When two good choices compete, what would make the wedding still feel unmistakably yours?',
  'Which decisions should always require two yeses, even if one person owns the research?',
].map((text, index) => ({
  id: `foundation-follow-up-${index + 1}`,
  category: 'exploration',
  script: [{ text, toolCalls: [], usage: { inputTokens: 80, outputTokens: 25 } }],
  expectedStop: 'natural',
}))

const choices = [
  { questionKey: 'foundation.funding_boundaries', choice: 'couple_funded', taskKey: 'write_couple_funded_guardrails' },
  { questionKey: 'foundation.funding_boundaries', choice: 'family_gift', taskKey: 'confirm_family_gift_boundaries' },
  { questionKey: 'foundation.funding_boundaries', choice: 'family_with_input', taskKey: 'write_family_input_boundaries' },
  { questionKey: 'foundation.funding_boundaries', choice: 'still_unclear', taskKey: 'clarify_family_contributions' },
  { questionKey: 'foundation.tradeoff_anchor', choice: 'guest_experience', taskKey: 'define_guest_experience_anchor' },
  { questionKey: 'foundation.tradeoff_anchor', choice: 'atmosphere_design', taskKey: 'define_atmosphere_anchor' },
  { questionKey: 'foundation.tradeoff_anchor', choice: 'food_celebration', taskKey: 'define_food_party_anchor' },
  { questionKey: 'foundation.tradeoff_anchor', choice: 'meaning_tradition', taskKey: 'define_meaning_tradition_anchor' },
  { questionKey: 'foundation.tradeoff_anchor', choice: 'low_stress', taskKey: 'define_low_stress_anchor' },
  { questionKey: 'foundation.decision_rhythm', choice: 'domain_owners', taskKey: 'map_domain_owners' },
  { questionKey: 'foundation.decision_rhythm', choice: 'shared_big_decisions', taskKey: 'define_two_yes_decisions' },
  { questionKey: 'foundation.decision_rhythm', choice: 'weekly_checkin', taskKey: 'schedule_weekly_planning_checkin' },
  { questionKey: 'foundation.decision_rhythm', choice: 'needs_structure', taskKey: 'write_decision_protocol' },
] as const

const decisionCases: QuestScopingEvalCase[] = choices.map(({ questionKey, choice, taskKey }, index) => ({
  id: `foundation-decision-${questionKey}-${choice}`,
  category: 'decision',
  script: [
    call(`foundation-questions-${index}`, 'get_scoping_questions', {}),
    call(`foundation-candidates-${index}`, 'get_candidate_tasks', { questionKey, choice }),
    call(`foundation-proposal-${index}`, 'propose_decision', packet({
      questionKey,
      proposedChoice: choice,
      reason: `Grounded couple reason for ${choice}.`,
      taskEffects: [{ taskKey, rationale: `Valid ${choice} branch task.` }],
    })),
  ],
  expectedStop: 'terminal_tool',
  expectedState: 'ready',
  expectedChoice: choice,
}))

const alignmentCases: QuestScopingEvalCase[] = Array.from({ length: 3 }, (_, index) => ({
  id: `foundation-contested-${index + 1}`,
  category: 'couple_alignment',
  script: [
    call(`foundation-q-contested-${index}`, 'get_scoping_questions', {}),
    call(`foundation-contested-${index}`, 'propose_decision', packet({
      state: 'contested',
      summary: 'The members want different boundaries, and both underlying needs remain visible.',
      proposedChoice: null,
      reason: null,
      taskEffects: [],
    })),
  ],
  expectedStop: 'terminal_tool',
  expectedState: 'contested',
  expectedChoice: null,
}))

export const FOUNDATION_SCOPING_EVAL_CASES: readonly QuestScopingEvalCase[] = Object.freeze([
  ...explorationCases,
  ...decisionCases,
  ...alignmentCases,
])
