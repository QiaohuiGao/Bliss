import type { AgentModelResult, DecisionPacket } from '../types'
import type { QuestScopingEvalCase } from './quest-scoping-suite'

const call = (id: string, name: string, input: unknown): AgentModelResult => ({
  toolCalls: [{ id, name, input }],
  usage: { inputTokens: 100, outputTokens: 40, costMicros: 100 },
})

const packet = (overrides: Partial<DecisionPacket> = {}): DecisionPacket => ({
  schemaVersion: 1,
  threadId: 'thread-1',
  questKey: 'registry_rings_honeymoon',
  questionKey: 'life.registry_style',
  state: 'ready',
  summary: 'The gifting plan now reflects what the couple is comfortable receiving.',
  proposedChoice: 'objects_and_funds',
  reason: 'The couple needs a few lasting objects and values help toward shared experiences.',
  alternativesConsidered: [],
  memberInputs: [],
  taskEffects: [{ taskKey: 'audit_home_and_life_needs', rationale: 'Build the registry from real needs.' }],
  memoryEffects: [],
  externalActions: [],
  vendorEffects: [],
  momentCandidate: null,
  ...overrides,
})

const explorationCases: QuestScopingEvalCase[] = [
  'Do your rings need to be newly chosen, custom designed, or carry an existing family story?',
  'Would guests be best guided toward objects, funds, both, or a genuine no-gifts message?',
  'Would rest, cost, or work make a delayed trip or mini-moon feel better than leaving immediately?',
].map((text, index) => ({
  id: `life-follow-up-${index + 1}`,
  category: 'exploration',
  script: [{ text, toolCalls: [], usage: { inputTokens: 80, outputTokens: 25 } }],
  expectedStop: 'natural',
}))

const choices = [
  { questionKey: 'life.ring_plan', choice: 'ready_made', taskKey: 'confirm_ready_made_stock_and_sizing' },
  { questionKey: 'life.ring_plan', choice: 'custom_made', taskKey: 'approve_custom_ring_design' },
  { questionKey: 'life.ring_plan', choice: 'heirloom_existing', taskKey: 'assess_heirloom_resize_and_restoration' },
  { questionKey: 'life.registry_style', choice: 'objects', taskKey: 'audit_home_and_life_needs' },
  { questionKey: 'life.registry_style', choice: 'objects_and_funds', taskKey: 'write_specific_fund_descriptions' },
  { questionKey: 'life.registry_style', choice: 'funds_only', taskKey: 'write_specific_fund_descriptions' },
  { questionKey: 'life.registry_style', choice: 'no_registry', taskKey: 'publish_no_gifts_message' },
  { questionKey: 'life.honeymoon_timing', choice: 'immediate_trip', taskKey: 'protect_post_wedding_departure_buffer' },
  { questionKey: 'life.honeymoon_timing', choice: 'delayed_trip', taskKey: 'set_delayed_trip_savings_timeline' },
  { questionKey: 'life.honeymoon_timing', choice: 'mini_moon', taskKey: 'plan_simple_mini_moon' },
  { questionKey: 'life.honeymoon_timing', choice: 'later_undecided', taskKey: 'park_honeymoon_without_pressure' },
] as const

const decisionCases: QuestScopingEvalCase[] = choices.map(({ questionKey, choice, taskKey }, index) => ({
  id: `life-decision-${questionKey}-${choice}`,
  category: 'decision',
  script: [
    call(`life-questions-${index}`, 'get_scoping_questions', {}),
    call(`life-candidates-${index}`, 'get_candidate_tasks', { questionKey, choice }),
    call(`life-proposal-${index}`, 'propose_decision', packet({
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
  id: `life-contested-${index + 1}`,
  category: 'couple_alignment',
  script: [
    call(`life-q-contested-${index}`, 'get_scoping_questions', {}),
    call(`life-contested-${index}`, 'propose_decision', packet({
      state: 'contested',
      summary: 'Both members have valid but different needs around this shared-life choice.',
      proposedChoice: null,
      reason: null,
      taskEffects: [],
    })),
  ],
  expectedStop: 'terminal_tool',
  expectedState: 'contested',
  expectedChoice: null,
}))

export const LIFE_SCOPING_EVAL_CASES: readonly QuestScopingEvalCase[] = Object.freeze([
  ...explorationCases,
  ...decisionCases,
  ...alignmentCases,
])
