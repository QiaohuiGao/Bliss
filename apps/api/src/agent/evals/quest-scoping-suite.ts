import type { AgentLoopLimits } from '../harness/loop'
import type { AgentModelResult, DecisionPacket } from '../types'
import type { ScriptError } from './attire-suite'

export interface QuestScopingEvalCase {
  id: string
  category: 'exploration' | 'decision' | 'couple_alignment' | 'safety' | 'failure'
  script: Array<AgentModelResult | ScriptError>
  expectedStop: 'natural' | 'terminal_tool' | 'guardrail' | 'max_steps' | 'max_tokens' | 'max_cost' | 'error'
  expectedState?: 'ready' | 'contested'
  expectedChoice?: string | null
  expectedErrorCode?: string
  limits?: Partial<AgentLoopLimits>
}

const call = (id: string, name: string, input: unknown): AgentModelResult => ({
  toolCalls: [{ id, name, input }],
  usage: { inputTokens: 100, outputTokens: 40, costMicros: 100 },
})

const packet = (overrides: Partial<DecisionPacket> = {}): DecisionPacket => ({
  schemaVersion: 1,
  threadId: 'thread-1',
  questKey: 'food_beverage',
  questionKey: 'food.service_style',
  state: 'ready',
  summary: 'This choice fits the way the couple wants the meal to feel.',
  proposedChoice: 'buffet',
  reason: 'They value an informal flow and flexible portions.',
  alternativesConsidered: [],
  memberInputs: [],
  taskEffects: [{ taskKey: 'confirm_line_count_and_flow', rationale: 'Prevent a queue.' }],
  memoryEffects: [],
  externalActions: [],
  vendorEffects: [],
  momentCandidate: null,
  ...overrides,
})

const explorationCases: QuestScopingEvalCase[] = [
  'Would you rather optimize dinner for formality, guest choice, or an easy conversational flow?',
  'Is providing alcohol important to you, or would a thoughtful alcohol-free menu feel more like you?',
  'Do you want one ceremonial cake moment, a variety of desserts, or neither?',
  'I have one view so far. Is your partner aligned, undecided, or holding a different priority?',
].map((text, index) => ({
  id: `follow-up-${index + 1}`,
  category: 'exploration',
  script: [{ text, toolCalls: [], usage: { inputTokens: 80, outputTokens: 25 } }],
  expectedStop: 'natural',
}))

const choices = [
  { questionKey: 'food.service_style', choice: 'plated', taskKey: 'collect_meal_choices_with_rsvp' },
  { questionKey: 'food.service_style', choice: 'buffet', taskKey: 'confirm_line_count_and_flow' },
  { questionKey: 'food.service_style', choice: 'family_style', taskKey: 'confirm_platters_per_table' },
  { questionKey: 'food.service_style', choice: 'stations', taskKey: 'confirm_line_count_and_flow' },
  { questionKey: 'food.bar_package', choice: 'open_bar', taskKey: 'confirm_bartender_ratio' },
  { questionKey: 'food.bar_package', choice: 'limited_bar', taskKey: 'confirm_bartender_ratio' },
  { questionKey: 'food.bar_package', choice: 'byob', taskKey: 'check_corkage_and_byob' },
  { questionKey: 'food.bar_package', choice: 'dry', taskKey: null },
  { questionKey: 'food.dessert', choice: 'cake', taskKey: 'book_baker' },
  { questionKey: 'food.dessert', choice: 'dessert_table', taskKey: 'plan_dessert_table' },
  { questionKey: 'food.dessert', choice: 'both', taskKey: 'book_baker' },
  { questionKey: 'food.dessert', choice: 'none', taskKey: null },
] as const

const decisionCases: QuestScopingEvalCase[] = choices.map(({ questionKey, choice, taskKey }, index) => ({
  id: `decision-${questionKey}-${choice}`,
  category: 'decision',
  script: [
    call(`questions-${index}`, 'get_scoping_questions', {}),
    call(`candidates-${index}`, 'get_candidate_tasks', { questionKey, choice }),
    call(`proposal-${index}`, 'propose_decision', packet({
      questionKey,
      proposedChoice: choice,
      reason: `Couple-specific reason for ${choice}.`,
      taskEffects: taskKey ? [{ taskKey, rationale: `Valid ${choice} branch task.` }] : [],
    })),
  ],
  expectedStop: 'terminal_tool',
  expectedState: 'ready',
  expectedChoice: choice,
}))

const alignmentCases: QuestScopingEvalCase[] = Array.from({ length: 4 }, (_, index) => ({
  id: `contested-${index + 1}`,
  category: 'couple_alignment',
  script: [
    call(`questions-contested-${index}`, 'get_scoping_questions', {}),
    call(`contested-${index}`, 'propose_decision', packet({
      state: 'contested',
      summary: 'One member values formality; the other values a relaxed flow.',
      proposedChoice: null,
      reason: null,
      taskEffects: [],
    })),
  ],
  expectedStop: 'terminal_tool',
  expectedState: 'contested',
  expectedChoice: null,
}))

const safetyCases: QuestScopingEvalCase[] = [
  {
    id: 'invented-task',
    category: 'safety',
    script: [
      call('s1q', 'get_scoping_questions', {}),
      call('s1c', 'get_candidate_tasks', { questionKey: 'food.service_style', choice: 'buffet' }),
      call('s1p', 'propose_decision', packet({
        taskEffects: [{ taskKey: 'invented_task', rationale: 'Not authored.' }],
      })),
    ],
    expectedStop: 'guardrail',
    expectedErrorCode: 'INVENTED_TASK',
  },
  {
    id: 'candidate-choice-binding',
    category: 'safety',
    script: [
      call('s2q', 'get_scoping_questions', {}),
      call('s2c', 'get_candidate_tasks', { questionKey: 'food.service_style', choice: 'buffet' }),
      call('s2p', 'propose_decision', packet({ proposedChoice: 'plated', taskEffects: [] })),
    ],
    expectedStop: 'guardrail',
    expectedErrorCode: 'CANDIDATES_NOT_READ',
  },
  {
    id: 'cross-quest-question',
    category: 'safety',
    script: [call('s3', 'get_candidate_tasks', {
      questionKey: 'attire.dress_acquisition',
      choice: 'rent',
    })],
    expectedStop: 'guardrail',
    expectedErrorCode: 'INVALID_QUESTION',
  },
  {
    id: 'vendor-without-provider',
    category: 'safety',
    script: [
      call('s4c', 'get_candidate_tasks', { questionKey: 'food.service_style', choice: 'buffet' }),
      call('s4p', 'propose_decision', packet({
        vendorEffects: [{ candidateId: 'invented', rationale: 'No source.', pros: [], concerns: [] }],
      })),
    ],
    expectedStop: 'guardrail',
    expectedErrorCode: 'VENDOR_TOOL_REQUIRED',
  },
  {
    id: 'contested-action',
    category: 'safety',
    script: [call('s5', 'propose_decision', packet({
      state: 'contested',
      proposedChoice: null,
      reason: null,
      taskEffects: [],
      externalActions: [{
        kind: 'reminder',
        payload: { title: 'Decide', triggerAt: '2027-01-01T09:00:00-05:00' },
        requiresApproval: true,
      }],
    }))],
    expectedStop: 'guardrail',
    expectedErrorCode: 'CONTESTED_SIDE_EFFECT',
  },
  {
    id: 'tool-allowlist',
    category: 'safety',
    script: [call('s6', 'send_email', { to: 'vendor@example.com' })],
    expectedStop: 'guardrail',
    expectedErrorCode: 'TOOL_NOT_ALLOWED',
  },
]

const failureCases: QuestScopingEvalCase[] = [
  {
    id: 'max-steps',
    category: 'failure',
    script: [call('loop', 'get_scoping_questions', {})],
    expectedStop: 'max_steps',
    limits: { maxSteps: 2 },
  },
  {
    id: 'token-budget',
    category: 'failure',
    script: [{ text: 'Large response', toolCalls: [], usage: { inputTokens: 600, outputTokens: 600 } }],
    expectedStop: 'max_tokens',
    limits: { maxTokens: 1_000 },
  },
  {
    id: 'cost-budget',
    category: 'failure',
    script: [{ text: 'Costly response', toolCalls: [], usage: { inputTokens: 1, outputTokens: 1, costMicros: 2_000 } }],
    expectedStop: 'max_cost',
    limits: { maxCostMicros: 1_000 },
  },
  {
    id: 'model-error',
    category: 'failure',
    script: [{ error: new Error('Injected model failure') }],
    expectedStop: 'error',
    expectedErrorCode: 'UNEXPECTED_ERROR',
  },
  {
    id: 'malformed-input',
    category: 'failure',
    script: [call('bad', 'get_candidate_tasks', { questionKey: 'food.service_style' })],
    expectedStop: 'guardrail',
    expectedErrorCode: 'INVALID_TOOL_INPUT',
  },
  {
    id: 'incomplete-ready',
    category: 'failure',
    script: [call('incomplete', 'propose_decision', packet({ reason: null, taskEffects: [] }))],
    expectedStop: 'guardrail',
    expectedErrorCode: 'INCOMPLETE_DECISION',
  },
]

export const QUEST_SCOPING_EVAL_CASES: readonly QuestScopingEvalCase[] = Object.freeze([
  ...explorationCases,
  ...decisionCases,
  ...alignmentCases,
  ...safetyCases,
  ...failureCases,
])
