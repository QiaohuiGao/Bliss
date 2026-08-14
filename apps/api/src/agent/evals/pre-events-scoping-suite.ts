import type { AgentModelResult, DecisionPacket } from '../types'
import type { QuestScopingEvalCase } from './quest-scoping-suite'

const call = (id: string, name: string, input: unknown): AgentModelResult => ({
  toolCalls: [{ id, name, input }],
  usage: { inputTokens: 100, outputTokens: 40, costMicros: 100 },
})

const packet = (overrides: Partial<DecisionPacket> = {}): DecisionPacket => ({
  schemaVersion: 1, threadId: 'thread-1', questKey: 'pre_wedding_events',
  questionKey: 'events.lead_up', state: 'ready',
  summary: 'The surrounding celebrations now add joy without becoming inherited obligations.',
  proposedChoice: 'one_joint_gathering',
  reason: 'The couple wants one inclusive gathering rather than several separate events.',
  alternativesConsidered: [], memberInputs: [],
  taskEffects: [{ taskKey: 'plan_one_joint_pre_wedding_gathering', rationale: 'Concentrate hosting energy.' }],
  memoryEffects: [], externalActions: [], vendorEffects: [], momentCandidate: null,
  ...overrides,
})

const explorationCases: QuestScopingEvalCase[] = [
  'Which gatherings would create real joy, and which feel inherited or repetitive?',
  'Should the rehearsal end with a formal dinner, a casual meal, or clear time for people to make their own plans?',
  'Will an after-party or brunch give energy back, or take away sleep and recovery?',
].map((text, index) => ({ id: `pre-events-follow-up-${index + 1}`, category: 'exploration', script: [{ text, toolCalls: [], usage: { inputTokens: 80, outputTokens: 25 } }], expectedStop: 'natural' }))

const choices = [
  { questionKey: 'events.lead_up', choice: 'none', taskKey: 'protect_no_extra_events_boundary' },
  { questionKey: 'events.lead_up', choice: 'hosted_by_others', taskKey: 'set_boundaries_for_events_others_host' },
  { questionKey: 'events.lead_up', choice: 'one_joint_gathering', taskKey: 'plan_one_joint_pre_wedding_gathering' },
  { questionKey: 'events.lead_up', choice: 'several_events', taskKey: 'map_event_calendar_and_guest_overlap' },
  { questionKey: 'events.rehearsal_hospitality', choice: 'formal_dinner', taskKey: 'book_rehearsal_dinner' },
  { questionKey: 'events.rehearsal_hospitality', choice: 'casual_meal', taskKey: 'plan_casual_post_rehearsal_meal' },
  { questionKey: 'events.rehearsal_hospitality', choice: 'rehearsal_only', taskKey: 'communicate_rehearsal_only_plan' },
  { questionKey: 'events.closing_events', choice: 'none', taskKey: 'protect_unstructured_post_wedding_time' },
  { questionKey: 'events.closing_events', choice: 'after_party', taskKey: 'plan_after_party' },
  { questionKey: 'events.closing_events', choice: 'farewell_brunch', taskKey: 'plan_farewell_brunch' },
  { questionKey: 'events.closing_events', choice: 'both', taskKey: 'coordinate_two_closing_events_without_overlap' },
] as const

const decisionCases: QuestScopingEvalCase[] = choices.map(({ questionKey, choice, taskKey }, index) => ({
  id: `pre-events-decision-${questionKey}-${choice}`, category: 'decision',
  script: [
    call(`pre-events-questions-${index}`, 'get_scoping_questions', {}),
    call(`pre-events-candidates-${index}`, 'get_candidate_tasks', { questionKey, choice }),
    call(`pre-events-proposal-${index}`, 'propose_decision', packet({ questionKey, proposedChoice: choice, reason: `Grounded couple reason for ${choice}.`, taskEffects: [{ taskKey, rationale: `Valid ${choice} branch task.` }] })),
  ],
  expectedStop: 'terminal_tool', expectedState: 'ready', expectedChoice: choice,
}))

const alignmentCases: QuestScopingEvalCase[] = Array.from({ length: 3 }, (_, index) => ({
  id: `pre-events-contested-${index + 1}`, category: 'couple_alignment',
  script: [call(`pre-events-q-contested-${index}`, 'get_scoping_questions', {}), call(`pre-events-contested-${index}`, 'propose_decision', packet({ state: 'contested', summary: 'Both members have valid but different needs around the surrounding events.', proposedChoice: null, reason: null, taskEffects: [] }))],
  expectedStop: 'terminal_tool', expectedState: 'contested', expectedChoice: null,
}))

export const PRE_EVENTS_SCOPING_EVAL_CASES: readonly QuestScopingEvalCase[] = Object.freeze([...explorationCases, ...decisionCases, ...alignmentCases])
