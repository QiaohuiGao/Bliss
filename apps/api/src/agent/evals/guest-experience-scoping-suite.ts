import type { AgentModelResult, DecisionPacket } from '../types'
import type { QuestScopingEvalCase } from './quest-scoping-suite'

const call = (id: string, name: string, input: unknown): AgentModelResult => ({
  toolCalls: [{ id, name, input }],
  usage: { inputTokens: 100, outputTokens: 40, costMicros: 100 },
})

const packet = (overrides: Partial<DecisionPacket> = {}): DecisionPacket => ({
  schemaVersion: 1,
  threadId: 'thread-1',
  questKey: 'guest_experience',
  questionKey: 'travel.guest_mix',
  state: 'ready',
  summary: 'The hospitality plan now matches the help guests will actually need.',
  proposedChoice: 'domestic_travelers',
  reason: 'Many households are traveling and need clear, affordable lodging options.',
  alternativesConsidered: [],
  memberInputs: [],
  taskEffects: [{ taskKey: 'estimate_domestic_room_demand', rationale: 'Size lodging support from real demand.' }],
  memoryEffects: [],
  externalActions: [],
  vendorEffects: [],
  momentCandidate: null,
  ...overrides,
})

const explorationCases: QuestScopingEvalCase[] = [
  'How many households are local, traveling domestically, or crossing a border?',
  'What will the last trip of the night look like for guests who cannot safely walk or drive?',
  'Would excellent information feel more caring than adding another event to the weekend?',
].map((text, index) => ({
  id: `guest-experience-follow-up-${index + 1}`,
  category: 'exploration',
  script: [{ text, toolCalls: [], usage: { inputTokens: 80, outputTokens: 25 } }],
  expectedStop: 'natural',
}))

const choices = [
  { questionKey: 'travel.guest_mix', choice: 'mostly_local', taskKey: 'confirm_lodging_help_not_needed' },
  { questionKey: 'travel.guest_mix', choice: 'domestic_travelers', taskKey: 'estimate_domestic_room_demand' },
  { questionKey: 'travel.guest_mix', choice: 'international_travelers', taskKey: 'map_international_arrival_needs' },
  { questionKey: 'travel.mobility_plan', choice: 'walkable_transit', taskKey: 'publish_walkable_route_and_accessibility' },
  { questionKey: 'travel.mobility_plan', choice: 'guest_self_transport', taskKey: 'publish_parking_and_ride_details' },
  { questionKey: 'travel.mobility_plan', choice: 'hosted_shuttles', taskKey: 'arrange_shuttles' },
  { questionKey: 'travel.mobility_plan', choice: 'mixed_access', taskKey: 'map_transport_by_guest_need' },
  { questionKey: 'travel.welcome_level', choice: 'guide_only', taskKey: 'send_concise_arrival_guide' },
  { questionKey: 'travel.welcome_level', choice: 'casual_gathering', taskKey: 'plan_drop_in_welcome' },
  { questionKey: 'travel.welcome_level', choice: 'hosted_event', taskKey: 'plan_welcome_party' },
] as const

const decisionCases: QuestScopingEvalCase[] = choices.map(({ questionKey, choice, taskKey }, index) => ({
  id: `guest-experience-decision-${questionKey}-${choice}`,
  category: 'decision',
  script: [
    call(`guest-experience-questions-${index}`, 'get_scoping_questions', {}),
    call(`guest-experience-candidates-${index}`, 'get_candidate_tasks', { questionKey, choice }),
    call(`guest-experience-proposal-${index}`, 'propose_decision', packet({
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
  id: `guest-experience-contested-${index + 1}`,
  category: 'couple_alignment',
  script: [
    call(`guest-experience-q-contested-${index}`, 'get_scoping_questions', {}),
    call(`guest-experience-contested-${index}`, 'propose_decision', packet({
      state: 'contested',
      summary: 'Both members have valid but different hospitality priorities.',
      proposedChoice: null,
      reason: null,
      taskEffects: [],
    })),
  ],
  expectedStop: 'terminal_tool',
  expectedState: 'contested',
  expectedChoice: null,
}))

export const GUEST_EXPERIENCE_SCOPING_EVAL_CASES: readonly QuestScopingEvalCase[] = Object.freeze([
  ...explorationCases,
  ...decisionCases,
  ...alignmentCases,
])
