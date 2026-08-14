import type { AgentModelResult, DecisionPacket } from '../types'
import type { QuestScopingEvalCase } from './quest-scoping-suite'

const call = (id: string, name: string, input: unknown): AgentModelResult => ({
  toolCalls: [{ id, name, input }],
  usage: { inputTokens: 100, outputTokens: 40, costMicros: 100 },
})

const packet = (overrides: Partial<DecisionPacket> = {}): DecisionPacket => ({
  schemaVersion: 1,
  threadId: 'thread-1',
  questKey: 'guests_stationery',
  questionKey: 'guests.plus_one_policy',
  state: 'ready',
  summary: 'The policy is clear enough to apply consistently by household.',
  proposedChoice: 'named_partners',
  reason: 'The couple wants known partners included while protecting the venue limit.',
  alternativesConsidered: [],
  memberInputs: [],
  taskEffects: [{ taskKey: 'name_established_partners', rationale: 'Invite known partners as people, not anonymous extras.' }],
  memoryEffects: [],
  externalActions: [],
  vendorEffects: [],
  momentCandidate: null,
  ...overrides,
})

const explorationCases: QuestScopingEvalCase[] = [
  'Is the plus-one question mainly about capacity, fairness, guest comfort, or family expectations?',
  'Are there children whose presence is personally important enough to be an explicit exception?',
  'Do you value the keepsake and ceremony of paper, the flexibility of digital, or a combination?',
].map((text, index) => ({
  id: `guests-follow-up-${index + 1}`,
  category: 'exploration',
  script: [{ text, toolCalls: [], usage: { inputTokens: 80, outputTokens: 25 } }],
  expectedStop: 'natural',
}))

const choices = [
  { questionKey: 'guests.plus_one_policy', choice: 'all_adults', taskKey: 'budget_open_plus_ones' },
  { questionKey: 'guests.plus_one_policy', choice: 'named_partners', taskKey: 'name_established_partners' },
  { questionKey: 'guests.plus_one_policy', choice: 'case_by_case', taskKey: 'review_plus_one_exceptions' },
  { questionKey: 'guests.plus_one_policy', choice: 'no_plus_ones', taskKey: 'word_no_plus_one_invitations' },
  { questionKey: 'guests.kids_policy', choice: 'all_kids', taskKey: 'count_children_and_plan_seating' },
  { questionKey: 'guests.kids_policy', choice: 'immediate_family_only', taskKey: 'list_kid_exceptions_by_household' },
  { questionKey: 'guests.kids_policy', choice: 'age_cutoff', taskKey: 'set_and_publish_age_cutoff' },
  { questionKey: 'guests.kids_policy', choice: 'adults_only', taskKey: 'word_adults_only_consistently' },
  { questionKey: 'guests.invitation_format', choice: 'paper_suite', taskKey: 'order_invitations' },
  { questionKey: 'guests.invitation_format', choice: 'digital_first', taskKey: 'choose_digital_invitation_platform' },
  { questionKey: 'guests.invitation_format', choice: 'hybrid', taskKey: 'build_digital_rsvp_flow' },
] as const

const decisionCases: QuestScopingEvalCase[] = choices.map(({ questionKey, choice, taskKey }, index) => ({
  id: `guests-decision-${questionKey}-${choice}`,
  category: 'decision',
  script: [
    call(`guests-questions-${index}`, 'get_scoping_questions', {}),
    call(`guests-candidates-${index}`, 'get_candidate_tasks', { questionKey, choice }),
    call(`guests-proposal-${index}`, 'propose_decision', packet({
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
  id: `guests-contested-${index + 1}`,
  category: 'couple_alignment',
  script: [
    call(`guests-q-contested-${index}`, 'get_scoping_questions', {}),
    call(`guests-contested-${index}`, 'propose_decision', packet({
      state: 'contested',
      summary: 'Both members have valid but different needs around the guest policy.',
      proposedChoice: null,
      reason: null,
      taskEffects: [],
    })),
  ],
  expectedStop: 'terminal_tool',
  expectedState: 'contested',
  expectedChoice: null,
}))

export const GUESTS_SCOPING_EVAL_CASES: readonly QuestScopingEvalCase[] = Object.freeze([
  ...explorationCases,
  ...decisionCases,
  ...alignmentCases,
])
