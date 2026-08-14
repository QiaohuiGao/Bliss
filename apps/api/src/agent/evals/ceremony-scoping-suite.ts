import type { AgentModelResult, DecisionPacket } from '../types'
import type { QuestScopingEvalCase } from './quest-scoping-suite'

const call = (id: string, name: string, input: unknown): AgentModelResult => ({
  toolCalls: [{ id, name, input }],
  usage: { inputTokens: 100, outputTokens: 40, costMicros: 100 },
})

const packet = (overrides: Partial<DecisionPacket> = {}): DecisionPacket => ({
  schemaVersion: 1,
  threadId: 'thread-1',
  questKey: 'ceremony',
  questionKey: 'ceremony.structure',
  state: 'ready',
  summary: 'The ceremony structure protects the meaning the couple wants to remember.',
  proposedChoice: 'personal_story_led',
  reason: 'The couple wants their own story and shared values to hold the ceremony together.',
  alternativesConsidered: [],
  memberInputs: [],
  taskEffects: [{ taskKey: 'interview_each_other_for_ceremony_story', rationale: 'Give the officiant specific source material.' }],
  memoryEffects: [],
  externalActions: [],
  vendorEffects: [],
  momentCandidate: null,
  ...overrides,
})

const explorationCases: QuestScopingEvalCase[] = [
  'Should the ceremony be held together by a known tradition, your relationship story, or a blend?',
  'Would your most personal promises feel better spoken publicly, privately, or with guided language?',
  'Which exact part of the ceremony, if any, should guests experience without their phones?',
].map((text, index) => ({
  id: `ceremony-follow-up-${index + 1}`,
  category: 'exploration',
  script: [{ text, toolCalls: [], usage: { inputTokens: 80, outputTokens: 25 } }],
  expectedStop: 'natural',
}))

const choices = [
  { questionKey: 'ceremony.structure', choice: 'traditional', taskKey: 'confirm_traditional_ceremony_elements' },
  { questionKey: 'ceremony.structure', choice: 'personal_story_led', taskKey: 'interview_each_other_for_ceremony_story' },
  { questionKey: 'ceremony.structure', choice: 'blended_traditions', taskKey: 'map_blended_ceremony_elements' },
  { questionKey: 'ceremony.vow_format', choice: 'personal_in_ceremony', taskKey: 'share_public_vows_for_timing' },
  { questionKey: 'ceremony.vow_format', choice: 'private_before', taskKey: 'plan_private_vow_exchange' },
  { questionKey: 'ceremony.vow_format', choice: 'guided_or_standard', taskKey: 'select_guided_vow_language' },
  { questionKey: 'ceremony.guest_photos', choice: 'fully_unplugged', taskKey: 'communicate_phone_free_ceremony' },
  { questionKey: 'ceremony.guest_photos', choice: 'vows_unplugged', taskKey: 'designate_vow_photo_boundary' },
  { questionKey: 'ceremony.guest_photos', choice: 'photos_welcome', taskKey: 'publish_respectful_guest_photo_rules' },
] as const

const decisionCases: QuestScopingEvalCase[] = choices.map(({ questionKey, choice, taskKey }, index) => ({
  id: `ceremony-decision-${questionKey}-${choice}`,
  category: 'decision',
  script: [
    call(`ceremony-questions-${index}`, 'get_scoping_questions', {}),
    call(`ceremony-candidates-${index}`, 'get_candidate_tasks', { questionKey, choice }),
    call(`ceremony-proposal-${index}`, 'propose_decision', packet({
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
  id: `ceremony-contested-${index + 1}`,
  category: 'couple_alignment',
  script: [
    call(`ceremony-q-contested-${index}`, 'get_scoping_questions', {}),
    call(`ceremony-contested-${index}`, 'propose_decision', packet({
      state: 'contested',
      summary: 'Both members have valid but different needs around the ceremony.',
      proposedChoice: null,
      reason: null,
      taskEffects: [],
    })),
  ],
  expectedStop: 'terminal_tool',
  expectedState: 'contested',
  expectedChoice: null,
}))

export const CEREMONY_SCOPING_EVAL_CASES: readonly QuestScopingEvalCase[] = Object.freeze([
  ...explorationCases,
  ...decisionCases,
  ...alignmentCases,
])
