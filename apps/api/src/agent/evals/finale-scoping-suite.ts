import type { AgentModelResult, DecisionPacket } from '../types'
import type { QuestScopingEvalCase } from './quest-scoping-suite'

const call = (id: string, name: string, input: unknown): AgentModelResult => ({ toolCalls: [{ id, name, input }], usage: { inputTokens: 100, outputTokens: 40, costMicros: 100 } })

const packet = (overrides: Partial<DecisionPacket> = {}): DecisionPacket => ({
  schemaVersion: 1, threadId: 'thread-1', questKey: 'final_30_and_day_of',
  questionKey: 'finale.coordination_handoff', state: 'ready',
  summary: 'The final plan has a clear decision owner without making the couple the default help desk.',
  proposedChoice: 'trusted_person', reason: 'A willing trusted person can run the plan with a clear backup and boundaries.',
  alternativesConsidered: [], memberInputs: [],
  taskEffects: [{ taskKey: 'brief_trusted_day_of_lead', rationale: 'Create a real handoff.' }],
  memoryEffects: [], externalActions: [], vendorEffects: [], momentCandidate: null,
  ...overrides,
})

const explorationCases: QuestScopingEvalCase[] = [
  'Who can make a day-of call without waiting for either of you to approve it?',
  'Which spaces actually change when weather crosses a named threshold?',
  'Who takes the last box, key, rental, card, gift, and return after the music stops?',
].map((text, index) => ({ id: `finale-follow-up-${index + 1}`, category: 'exploration', script: [{ text, toolCalls: [], usage: { inputTokens: 80, outputTokens: 25 } }], expectedStop: 'natural' }))

const choices = [
  { questionKey: 'finale.coordination_handoff', choice: 'professional', taskKey: 'confirm_professional_command_chain' },
  { questionKey: 'finale.coordination_handoff', choice: 'trusted_person', taskKey: 'brief_trusted_day_of_lead' },
  { questionKey: 'finale.coordination_handoff', choice: 'couple_led', taskKey: 'reduce_and_assign_couple_led_decisions' },
  { questionKey: 'finale.weather_exposure', choice: 'indoors', taskKey: 'confirm_indoor_access_and_climate' },
  { questionKey: 'finale.weather_exposure', choice: 'outdoor_with_backup', taskKey: 'set_outdoor_weather_decision_deadline' },
  { questionKey: 'finale.weather_exposure', choice: 'mixed_spaces', taskKey: 'map_weather_plan_by_space' },
  { questionKey: 'finale.closeout_owner', choice: 'delegated', taskKey: 'confirm_delegated_closeout_manifest' },
  { questionKey: 'finale.closeout_owner', choice: 'shared_with_helpers', taskKey: 'split_closeout_shifts_with_helpers' },
  { questionKey: 'finale.closeout_owner', choice: 'couple_managed', taskKey: 'protect_couple_managed_closeout_buffer' },
] as const

const decisionCases: QuestScopingEvalCase[] = choices.map(({ questionKey, choice, taskKey }, index) => ({
  id: `finale-decision-${questionKey}-${choice}`, category: 'decision',
  script: [
    call(`finale-questions-${index}`, 'get_scoping_questions', {}),
    call(`finale-candidates-${index}`, 'get_candidate_tasks', { questionKey, choice }),
    call(`finale-proposal-${index}`, 'propose_decision', packet({ questionKey, proposedChoice: choice, reason: `Grounded couple reason for ${choice}.`, taskEffects: [{ taskKey, rationale: `Valid ${choice} branch task.` }] })),
  ], expectedStop: 'terminal_tool', expectedState: 'ready', expectedChoice: choice,
}))

const alignmentCases: QuestScopingEvalCase[] = Array.from({ length: 3 }, (_, index) => ({
  id: `finale-contested-${index + 1}`, category: 'couple_alignment',
  script: [call(`finale-q-contested-${index}`, 'get_scoping_questions', {}), call(`finale-contested-${index}`, 'propose_decision', packet({ state: 'contested', summary: 'Both members have valid but different needs around the final handoff.', proposedChoice: null, reason: null, taskEffects: [] }))],
  expectedStop: 'terminal_tool', expectedState: 'contested', expectedChoice: null,
}))

export const FINALE_SCOPING_EVAL_CASES: readonly QuestScopingEvalCase[] = Object.freeze([...explorationCases, ...decisionCases, ...alignmentCases])
