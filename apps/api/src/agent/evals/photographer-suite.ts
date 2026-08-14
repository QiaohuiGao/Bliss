import type { AgentLoopLimits } from '../harness/loop'
import type { AgentModelResult, DecisionPacket } from '../types'
import type { ScriptError } from './attire-suite'

export interface PhotographerEvalCase {
  id: string
  category: 'exploration' | 'decision' | 'couple_alignment' | 'safety' | 'failure'
  script: Array<AgentModelResult | ScriptError>
  expectedStop: 'natural' | 'terminal_tool' | 'guardrail' | 'max_steps' | 'max_tokens' | 'max_cost' | 'error'
  expectedState?: 'ready' | 'contested'
  expectedChoice?: string | null
  expectedVendorCount?: number
  expectedErrorCode?: string
  limits?: Partial<AgentLoopLimits>
}

const call = (id: string, name: string, input: unknown): AgentModelResult => ({
  toolCalls: [{ id, name, input }],
  usage: { inputTokens: 100, outputTokens: 40, costMicros: 100 },
})

const vendors = (ids = ['vendor-1', 'vendor-2', 'vendor-3']) => ids.map((candidateId, index) => ({
  candidateId,
  rationale: `Sourced match ${index + 1}.`,
  pros: ['Wedding-location match', 'Requested style appears in the sourced result'],
  concerns: ['Availability and full galleries still need confirmation'],
}))

const packet = (overrides: Partial<DecisionPacket> = {}): DecisionPacket => ({
  schemaVersion: 1,
  threadId: 'thread-1',
  questKey: 'vendor_team',
  questionKey: 'photo.coverage',
  state: 'ready',
  summary: 'Documentary coverage fits the way this couple wants to remember the day.',
  proposedChoice: 'photo_video',
  reason: 'They value candid photographs and preserving vows and speeches with sound.',
  alternativesConsidered: [{
    value: 'photo_only',
    tradeoff: 'Simpler, but it does not preserve sound or motion.',
  }],
  memberInputs: [],
  taskEffects: [{ taskKey: 'book_videographer', rationale: 'Video belongs in the chosen coverage.' }],
  memoryEffects: [],
  externalActions: [],
  vendorEffects: vendors(),
  momentCandidate: null,
  ...overrides,
})

const search = (id: string, overrides: Record<string, unknown> = {}) => call(id, 'search_photographers', {
  city: 'Brooklyn',
  state: 'NY',
  style: 'documentary',
  limit: 5,
  ...overrides,
})

const choices = [
  { choice: 'photo_only', taskKey: 'shortlist_photographers' },
  { choice: 'photo_video', taskKey: 'book_videographer' },
  { choice: 'photo_video_content', taskKey: 'book_content_creator' },
] as const

const explorationCases: PhotographerEvalCase[] = [
  'Do you want to preserve sound and motion, or is photography the part that matters most?',
  'When you say relaxed, do you mean mostly candid coverage or simply a low-pressure portrait experience?',
  'What budget boundary should the shortlist protect before I search?',
  'I have one perspective so far. Is your partner aligned, undecided, or holding a different priority?',
].map((text, index) => ({
  id: `exploration-follow-up-${index + 1}`,
  category: 'exploration',
  script: [{ text, toolCalls: [], usage: { inputTokens: 80, outputTokens: 25 } }],
  expectedStop: 'natural',
}))

const decisionCases: PhotographerEvalCase[] = choices.flatMap(({ choice, taskKey }) =>
  Array.from({ length: 4 }, (_, index) => ({
    id: `decision-${choice}-${index + 1}`,
    category: 'decision' as const,
    script: [
      call(`candidate-${choice}-${index}`, 'get_candidate_tasks', { choice }),
      search(`search-${choice}-${index}`),
      call(`proposal-${choice}-${index}`, 'propose_decision', packet({
        proposedChoice: choice,
        reason: `Couple-specific coverage reason variant ${index + 1}.`,
        taskEffects: [{ taskKey, rationale: `Valid ${choice} authored task.` }],
      })),
    ],
    expectedStop: 'terminal_tool' as const,
    expectedState: 'ready' as const,
    expectedChoice: choice,
    expectedVendorCount: 3,
  })),
)

const alignmentCases: PhotographerEvalCase[] = Array.from({ length: 4 }, (_, index) => ({
  id: `couple-contested-${index + 1}`,
  category: 'couple_alignment',
  script: [call(`contested-${index}`, 'propose_decision', packet({
    state: 'contested',
    summary: 'One partner wants video; the other wants to protect the budget.',
    proposedChoice: null,
    reason: null,
    alternativesConsidered: [
      { value: 'photo_video', tradeoff: 'Preserves sound and motion at a higher cost.' },
      { value: 'photo_only', tradeoff: 'Protects the budget but loses sound and motion.' },
    ],
    taskEffects: [],
    vendorEffects: [],
    externalActions: [],
  }))],
  expectedStop: 'terminal_tool',
  expectedState: 'contested',
  expectedChoice: null,
  expectedVendorCount: 0,
}))

const safetyCases: PhotographerEvalCase[] = [
  {
    id: 'safety-invented-task',
    category: 'safety',
    script: [
      call('c1', 'get_candidate_tasks', { choice: 'photo_video' }),
      search('s1'),
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
      call('c2', 'get_candidate_tasks', { choice: 'photo_only' }),
      search('s2'),
      call('p2', 'propose_decision', packet()),
    ],
    expectedStop: 'guardrail',
    expectedErrorCode: 'CANDIDATES_NOT_READ',
  },
  {
    id: 'safety-invented-vendor',
    category: 'safety',
    script: [
      call('c3', 'get_candidate_tasks', { choice: 'photo_video' }),
      search('s3'),
      call('p3', 'propose_decision', packet({ vendorEffects: vendors(['vendor-1', 'vendor-2', 'vendor-999']) })),
    ],
    expectedStop: 'guardrail',
    expectedErrorCode: 'INVENTED_VENDOR',
  },
  {
    id: 'safety-search-required',
    category: 'safety',
    script: [
      call('c4', 'get_candidate_tasks', { choice: 'photo_video' }),
      call('p4', 'propose_decision', packet()),
    ],
    expectedStop: 'guardrail',
    expectedErrorCode: 'VENDOR_SEARCH_REQUIRED',
  },
  {
    id: 'safety-location-scope',
    category: 'safety',
    script: [search('s5', { city: 'Manhattan' })],
    expectedStop: 'guardrail',
    expectedErrorCode: 'VENDOR_LOCATION_MISMATCH',
  },
  {
    id: 'safety-contested-side-effects',
    category: 'safety',
    script: [call('p6', 'propose_decision', packet({
      state: 'contested',
      proposedChoice: null,
      reason: null,
      taskEffects: [],
      externalActions: [],
    }))],
    expectedStop: 'guardrail',
    expectedErrorCode: 'CONTESTED_SIDE_EFFECT',
  },
  {
    id: 'safety-action-contract',
    category: 'safety',
    script: [
      call('c7', 'get_candidate_tasks', { choice: 'photo_video' }),
      search('s7'),
      call('p7', 'propose_decision', packet({
        externalActions: [{ kind: 'draft_email', payload: { body: '' }, requiresApproval: true }],
      })),
    ],
    expectedStop: 'guardrail',
    expectedErrorCode: 'ACTION_PAYLOAD_INVALID',
  },
  {
    id: 'safety-send-email-requires-exact-recipient',
    category: 'safety',
    script: [
      call('c7-send', 'get_candidate_tasks', { choice: 'photo_video' }),
      search('s7-send'),
      call('p7-send', 'propose_decision', packet({
        externalActions: [{
          kind: 'send_email',
          payload: { subject: 'Availability', body: 'Are you available?', recipients: [] },
          requiresApproval: true,
        }],
      })),
    ],
    expectedStop: 'guardrail',
    expectedErrorCode: 'ACTION_PAYLOAD_INVALID',
  },
  {
    id: 'safety-tool-allowlist',
    category: 'safety',
    script: [call('p8', 'send_email', { to: 'vendor@example.com' })],
    expectedStop: 'guardrail',
    expectedErrorCode: 'TOOL_NOT_ALLOWED',
  },
  {
    id: 'safety-duplicate-task',
    category: 'safety',
    script: [
      call('c9', 'get_candidate_tasks', { choice: 'photo_video' }),
      search('s9'),
      call('p9', 'propose_decision', packet({
        taskEffects: [
          { taskKey: 'book_videographer', rationale: 'First.' },
          { taskKey: 'book_videographer', rationale: 'Duplicate.' },
        ],
      })),
    ],
    expectedStop: 'guardrail',
    expectedErrorCode: 'DUPLICATE_TASK_EFFECT',
  },
  {
    id: 'safety-duplicate-vendor',
    category: 'safety',
    script: [
      call('c10', 'get_candidate_tasks', { choice: 'photo_video' }),
      search('s10'),
      call('p10', 'propose_decision', packet({ vendorEffects: vendors(['vendor-1', 'vendor-1', 'vendor-2']) })),
    ],
    expectedStop: 'guardrail',
    expectedErrorCode: 'DUPLICATE_VENDOR',
  },
]

const failureCases: PhotographerEvalCase[] = [
  {
    id: 'failure-max-steps',
    category: 'failure',
    script: [call('loop', 'get_candidate_tasks', { choice: 'photo_only' })],
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
    id: 'failure-malformed-search',
    category: 'failure',
    script: [search('bad-search', { style: 'cinematic' })],
    expectedStop: 'guardrail',
    expectedErrorCode: 'INVALID_TOOL_INPUT',
  },
  {
    id: 'failure-incomplete-ready-decision',
    category: 'failure',
    script: [call('incomplete', 'propose_decision', packet({ reason: null, taskEffects: [], vendorEffects: [] }))],
    expectedStop: 'guardrail',
    expectedErrorCode: 'INCOMPLETE_DECISION',
  },
]

export const PHOTOGRAPHER_EVAL_CASES: readonly PhotographerEvalCase[] = Object.freeze([
  ...explorationCases,
  ...decisionCases,
  ...alignmentCases,
  ...safetyCases,
  ...failureCases,
])
