import type { AgentLoopLimits } from '../harness/loop'
import type { AgentModelResult, DecisionPacket } from '../types'

export interface ScriptError {
  error: Error
}

export interface AttireEvalCase {
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
  questKey: 'attire_beauty',
  questionKey: 'attire.dress_acquisition',
  state: 'ready',
  summary: 'This path fits what you said matters most.',
  proposedChoice: 'buy_custom',
  reason: 'The couple values craftsmanship and accepts the longer lead time.',
  alternativesConsidered: [],
  memberInputs: [],
  taskEffects: [{ taskKey: 'order_the_gown', rationale: 'Order early enough for custom production.' }],
  memoryEffects: [],
  externalActions: [],
  vendorEffects: [],
  momentCandidate: null,
  ...overrides,
})

const choices = [
  { choice: 'rent', taskKey: 'reserve_rental_gown' },
  { choice: 'buy_offrack', taskKey: 'buy_the_gown_offrack' },
  { choice: 'buy_custom', taskKey: 'order_the_gown' },
] as const

const explorationCases: AttireEvalCase[] = [
  'Which matters more here: keeping this simple, owning the gown afterward, or having something made especially for you?',
  'Is the wedding date firm enough that lead time should be the deciding constraint?',
  'I hear your preference. Has your partner expressed a different priority, or is their view still unknown?',
  'Would you like to compare the lower-stress path with the more personal path before deciding?',
].map((text, index) => ({
  id: `exploration-follow-up-${index + 1}`,
  category: 'exploration',
  script: [{ text, toolCalls: [], usage: { inputTokens: 80, outputTokens: 25 } }],
  expectedStop: 'natural',
}))

const decisionCases: AttireEvalCase[] = choices.flatMap(({ choice, taskKey }) =>
  Array.from({ length: 4 }, (_, index) => ({
    id: `decision-${choice}-${index + 1}`,
    category: 'decision' as const,
    script: [
      call(`candidate-${choice}-${index}`, 'get_candidate_tasks', { choice }),
      call(`proposal-${choice}-${index}`, 'propose_decision', packet({
        proposedChoice: choice,
        reason: `Authored reason variant ${index + 1} for ${choice}.`,
        taskEffects: [{ taskKey, rationale: `Valid ${choice} branch task.` }],
      })),
    ],
    expectedStop: 'terminal_tool' as const,
    expectedState: 'ready' as const,
    expectedChoice: choice,
  })),
)

const alignmentCases: AttireEvalCase[] = Array.from({ length: 6 }, (_, index) => ({
  id: `couple-contested-${index + 1}`,
  category: 'couple_alignment',
  script: [call(`contested-${index}`, 'propose_decision', packet({
    state: 'contested',
    summary: 'One partner values meaning; the other needs a lower-stress timeline.',
    proposedChoice: null,
    reason: null,
    alternativesConsidered: [
      { value: 'buy_custom', tradeoff: 'More personal, longer and more expensive.' },
      { value: 'rent', tradeoff: 'Simpler and cheaper, without ownership afterward.' },
    ],
    taskEffects: [],
  }))],
  expectedStop: 'terminal_tool',
  expectedState: 'contested',
  expectedChoice: null,
}))

const safetyCases: AttireEvalCase[] = [
  {
    id: 'safety-invented-task',
    category: 'safety',
    script: [
      call('c1', 'get_candidate_tasks', { choice: 'buy_custom' }),
      call('p1', 'propose_decision', packet({
        taskEffects: [{ taskKey: 'invented_task', rationale: 'Not authored.' }],
      })),
    ],
    expectedStop: 'guardrail',
    expectedErrorCode: 'INVENTED_TASK',
  },
  {
    id: 'safety-choice-bound-candidates',
    category: 'safety',
    script: [
      call('c2', 'get_candidate_tasks', { choice: 'buy_custom' }),
      call('p2', 'propose_decision', packet({
        proposedChoice: 'rent',
        taskEffects: [{ taskKey: 'order_the_gown', rationale: 'Wrong branch.' }],
      })),
    ],
    expectedStop: 'guardrail',
    expectedErrorCode: 'CANDIDATES_NOT_READ',
  },
  {
    id: 'safety-duplicate-task',
    category: 'safety',
    script: [
      call('c3', 'get_candidate_tasks', { choice: 'buy_custom' }),
      call('p3', 'propose_decision', packet({
        taskEffects: [
          { taskKey: 'order_the_gown', rationale: 'First.' },
          { taskKey: 'order_the_gown', rationale: 'Duplicate.' },
        ],
      })),
    ],
    expectedStop: 'guardrail',
    expectedErrorCode: 'DUPLICATE_TASK_EFFECT',
  },
  {
    id: 'safety-thread-scope',
    category: 'safety',
    script: [call('p4', 'propose_decision', packet({ threadId: 'another-thread', taskEffects: [] }))],
    expectedStop: 'guardrail',
    expectedErrorCode: 'THREAD_SCOPE_MISMATCH',
  },
  {
    id: 'safety-quest-scope',
    category: 'safety',
    script: [call('p5', 'propose_decision', packet({ questKey: 'legal', taskEffects: [] }))],
    expectedStop: 'guardrail',
    expectedErrorCode: 'QUEST_SCOPE_MISMATCH',
  },
  {
    id: 'safety-tool-allowlist',
    category: 'safety',
    script: [call('p6', 'send_email', { to: 'vendor@example.com' })],
    expectedStop: 'guardrail',
    expectedErrorCode: 'TOOL_NOT_ALLOWED',
  },
]

const failureCases: AttireEvalCase[] = [
  {
    id: 'failure-max-steps',
    category: 'failure',
    script: [call('loop', 'get_candidate_tasks', { choice: 'rent' })],
    expectedStop: 'max_steps',
    limits: { maxSteps: 2 },
  },
  {
    id: 'failure-token-budget',
    category: 'failure',
    script: [{ text: 'Large response', toolCalls: [], usage: { inputTokens: 600, outputTokens: 600 } }],
    expectedStop: 'max_tokens',
    limits: { maxTokens: 1_000 },
  },
  {
    id: 'failure-cost-budget',
    category: 'failure',
    script: [{ text: 'Costly response', toolCalls: [], usage: { inputTokens: 1, outputTokens: 1, costMicros: 2_000 } }],
    expectedStop: 'max_cost',
    limits: { maxCostMicros: 1_000 },
  },
  {
    id: 'failure-model-error',
    category: 'failure',
    script: [{ error: new Error('Injected model failure') }],
    expectedStop: 'error',
    expectedErrorCode: 'UNEXPECTED_ERROR',
  },
  {
    id: 'failure-malformed-tool-input',
    category: 'failure',
    script: [call('bad-input', 'get_candidate_tasks', { choice: 'borrow' })],
    expectedStop: 'guardrail',
    expectedErrorCode: 'INVALID_TOOL_INPUT',
  },
  {
    id: 'failure-incomplete-ready-decision',
    category: 'failure',
    script: [call('incomplete', 'propose_decision', packet({ reason: null, taskEffects: [] }))],
    expectedStop: 'guardrail',
    expectedErrorCode: 'INCOMPLETE_DECISION',
  },
]

export const ATTIRE_EVAL_CASES: readonly AttireEvalCase[] = Object.freeze([
  ...explorationCases,
  ...decisionCases,
  ...alignmentCases,
  ...safetyCases,
  ...failureCases,
])
