import type { AgentModelResult, DecisionPacket } from '../types'
import type { QuestScopingEvalCase } from './quest-scoping-suite'

const call = (id: string, name: string, input: unknown): AgentModelResult => ({
  toolCalls: [{ id, name, input }],
  usage: { inputTokens: 100, outputTokens: 40, costMicros: 100 },
})

const packet = (overrides: Partial<DecisionPacket> = {}): DecisionPacket => ({
  schemaVersion: 1,
  threadId: 'thread-1',
  questKey: 'venue_date',
  questionKey: 'venue.date_flexibility',
  state: 'ready',
  summary: 'This path protects what matters most while keeping the search workable.',
  proposedChoice: 'preferred_window',
  reason: 'The couple wants meaningful options without fixing one day too early.',
  alternativesConsidered: [],
  memberInputs: [],
  taskEffects: [{ taskKey: 'compare_date_options', rationale: 'Compare real options before locking one.' }],
  memoryEffects: [],
  externalActions: [],
  vendorEffects: [],
  momentCandidate: null,
  ...overrides,
})

const explorationCases: QuestScopingEvalCase[] = [
  'Is the exact date meaningful, or would you move it for a place that feels unmistakably right?',
  'Would you rather pay for a venue that carries more of the work or build the environment yourselves?',
  'What would separate ceremony and reception sites add emotionally, and what guest friction would be acceptable?',
].map((text, index) => ({
  id: `venue-follow-up-${index + 1}`,
  category: 'exploration',
  script: [{ text, toolCalls: [], usage: { inputTokens: 80, outputTokens: 25 } }],
  expectedStop: 'natural',
}))

const choices = [
  { questionKey: 'venue.date_flexibility', choice: 'fixed_date', taskKey: 'confirm_fixed_date_constraints' },
  { questionKey: 'venue.date_flexibility', choice: 'preferred_window', taskKey: 'compare_date_options' },
  { questionKey: 'venue.date_flexibility', choice: 'venue_first', taskKey: 'rank_venue_before_date' },
  { questionKey: 'venue.venue_style', choice: 'full_service', taskKey: 'audit_full_service_inclusions' },
  { questionKey: 'venue.venue_style', choice: 'blank_canvas', taskKey: 'build_blank_canvas_cost_model' },
  { questionKey: 'venue.venue_style', choice: 'restaurant_hotel', taskKey: 'confirm_restaurant_buyout_terms' },
  { questionKey: 'venue.venue_style', choice: 'outdoor', taskKey: 'verify_outdoor_infrastructure' },
  { questionKey: 'venue.site_plan', choice: 'same_site', taskKey: 'confirm_room_flip_and_guest_flow' },
  { questionKey: 'venue.site_plan', choice: 'separate_sites', taskKey: 'measure_transfer_time_and_transport' },
  { questionKey: 'venue.site_plan', choice: 'undecided', taskKey: 'compare_one_site_vs_two' },
] as const

const decisionCases: QuestScopingEvalCase[] = choices.map(({ questionKey, choice, taskKey }, index) => ({
  id: `venue-decision-${questionKey}-${choice}`,
  category: 'decision',
  script: [
    call(`venue-questions-${index}`, 'get_scoping_questions', {}),
    call(`venue-candidates-${index}`, 'get_candidate_tasks', { questionKey, choice }),
    call(`venue-proposal-${index}`, 'propose_decision', packet({
      questionKey,
      proposedChoice: choice,
      reason: `Couple-specific reason for ${choice}.`,
      taskEffects: [{ taskKey, rationale: `Valid ${choice} branch task.` }],
    })),
  ],
  expectedStop: 'terminal_tool',
  expectedState: 'ready',
  expectedChoice: choice,
}))

const alignmentCases: QuestScopingEvalCase[] = Array.from({ length: 3 }, (_, index) => ({
  id: `venue-contested-${index + 1}`,
  category: 'couple_alignment',
  script: [
    call(`venue-q-contested-${index}`, 'get_scoping_questions', {}),
    call(`venue-contested-${index}`, 'propose_decision', packet({
      state: 'contested',
      summary: 'One member wants a fixed meaningful date; the other wants the venue to come first.',
      proposedChoice: null,
      reason: null,
      taskEffects: [],
    })),
  ],
  expectedStop: 'terminal_tool',
  expectedState: 'contested',
  expectedChoice: null,
}))

export const VENUE_SCOPING_EVAL_CASES: readonly QuestScopingEvalCase[] = Object.freeze([
  ...explorationCases,
  ...decisionCases,
  ...alignmentCases,
])
