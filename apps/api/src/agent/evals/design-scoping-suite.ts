import type { AgentModelResult, DecisionPacket } from '../types'
import type { QuestScopingEvalCase } from './quest-scoping-suite'

const call = (id: string, name: string, input: unknown): AgentModelResult => ({
  toolCalls: [{ id, name, input }],
  usage: { inputTokens: 100, outputTokens: 40, costMicros: 100 },
})

const packet = (overrides: Partial<DecisionPacket> = {}): DecisionPacket => ({
  schemaVersion: 1,
  threadId: 'thread-1',
  questKey: 'design_flowers',
  questionKey: 'design.scope',
  state: 'ready',
  summary: 'The design plan now concentrates effort where it changes the feeling of the day.',
  proposedChoice: 'focal_moments',
  reason: 'The couple prefers a few memorable visual moments over decorating every surface.',
  alternativesConsidered: [],
  memberInputs: [],
  taskEffects: [{ taskKey: 'choose_focal_design_moments', rationale: 'Concentrate the design budget.' }],
  memoryEffects: [],
  externalActions: [],
  vendorEffects: [],
  momentCandidate: null,
  ...overrides,
})

const explorationCases: QuestScopingEvalCase[] = [
  'Which two or three spaces most need to carry the atmosphere you care about?',
  'Is the floral feeling more important than exact stems, or are flowers not the main material at all?',
  'Who will physically deliver, place, repack, and remove every design element?',
].map((text, index) => ({
  id: `design-follow-up-${index + 1}`,
  category: 'exploration',
  script: [{ text, toolCalls: [], usage: { inputTokens: 80, outputTokens: 25 } }],
  expectedStop: 'natural',
}))

const choices = [
  { questionKey: 'design.scope', choice: 'immersive', taskKey: 'map_immersive_design_zones' },
  { questionKey: 'design.scope', choice: 'focal_moments', taskKey: 'choose_focal_design_moments' },
  { questionKey: 'design.scope', choice: 'minimal', taskKey: 'write_minimal_design_rules' },
  { questionKey: 'design.floral_approach', choice: 'fresh_full_service', taskKey: 'write_fresh_floral_brief' },
  { questionKey: 'design.floral_approach', choice: 'seasonal_flexible', taskKey: 'approve_seasonal_substitution_rules' },
  { questionKey: 'design.floral_approach', choice: 'low_flower_reusable', taskKey: 'design_low_flower_reuse_plan' },
  { questionKey: 'design.floral_approach', choice: 'non_floral', taskKey: 'design_non_floral_tablescape' },
  { questionKey: 'design.production_owner', choice: 'full_service_team', taskKey: 'confirm_full_service_install_plan' },
  { questionKey: 'design.production_owner', choice: 'split_vendor_diy', taskKey: 'write_vendor_diy_responsibility_matrix' },
  { questionKey: 'design.production_owner', choice: 'couple_diy', taskKey: 'build_full_diy_setup_plan' },
] as const

const decisionCases: QuestScopingEvalCase[] = choices.map(({ questionKey, choice, taskKey }, index) => ({
  id: `design-decision-${questionKey}-${choice}`,
  category: 'decision',
  script: [
    call(`design-questions-${index}`, 'get_scoping_questions', {}),
    call(`design-candidates-${index}`, 'get_candidate_tasks', { questionKey, choice }),
    call(`design-proposal-${index}`, 'propose_decision', packet({
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
  id: `design-contested-${index + 1}`,
  category: 'couple_alignment',
  script: [
    call(`design-q-contested-${index}`, 'get_scoping_questions', {}),
    call(`design-contested-${index}`, 'propose_decision', packet({
      state: 'contested',
      summary: 'Both members have valid but different design priorities.',
      proposedChoice: null,
      reason: null,
      taskEffects: [],
    })),
  ],
  expectedStop: 'terminal_tool',
  expectedState: 'contested',
  expectedChoice: null,
}))

export const DESIGN_SCOPING_EVAL_CASES: readonly QuestScopingEvalCase[] = Object.freeze([
  ...explorationCases,
  ...decisionCases,
  ...alignmentCases,
])
