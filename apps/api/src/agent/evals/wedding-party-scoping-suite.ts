import type { AgentModelResult, DecisionPacket } from '../types'
import type { QuestScopingEvalCase } from './quest-scoping-suite'

const call = (id: string, name: string, input: unknown): AgentModelResult => ({
  toolCalls: [{ id, name, input }],
  usage: { inputTokens: 100, outputTokens: 40, costMicros: 100 },
})

const packet = (overrides: Partial<DecisionPacket> = {}): DecisionPacket => ({
  schemaVersion: 1,
  threadId: 'thread-1',
  questKey: 'wedding_party',
  questionKey: 'party.structure',
  state: 'ready',
  summary: 'The role can feel meaningful without inheriting expectations that do not fit this group.',
  proposedChoice: 'shared_circle',
  reason: 'The couple values closeness and flexibility more than traditional sides.',
  alternativesConsidered: [],
  memberInputs: [],
  taskEffects: [{ taskKey: 'build_one_shared_circle', rationale: 'Build the group around relationships.' }],
  memoryEffects: [],
  externalActions: [],
  vendorEffects: [],
  momentCandidate: null,
  ...overrides,
})

const explorationCases: QuestScopingEvalCase[] = [
  'Who do you genuinely want close, before thinking about sides, symmetry, or titles?',
  'Should the role be purely celebratory, include a little help, or come with clearly agreed responsibilities?',
  'How much visual coordination feels worth the cost and comfort trade-off for your people?',
].map((text, index) => ({
  id: `wedding-party-follow-up-${index + 1}`,
  category: 'exploration',
  script: [{ text, toolCalls: [], usage: { inputTokens: 80, outputTokens: 25 } }],
  expectedStop: 'natural',
}))

const choices = [
  { questionKey: 'party.structure', choice: 'traditional_sides', taskKey: 'map_traditional_party_sides' },
  { questionKey: 'party.structure', choice: 'shared_circle', taskKey: 'build_one_shared_circle' },
  { questionKey: 'party.structure', choice: 'small_vips', taskKey: 'name_small_vip_circle' },
  { questionKey: 'party.structure', choice: 'no_formal_party', taskKey: 'define_vip_roles_without_a_party' },
  { questionKey: 'party.support_level', choice: 'celebratory_only', taskKey: 'tell_party_presence_is_enough' },
  { questionKey: 'party.support_level', choice: 'light_support', taskKey: 'agree_light_support_requests' },
  { questionKey: 'party.support_level', choice: 'active_team', taskKey: 'confirm_active_team_responsibilities' },
  { questionKey: 'party.attire_direction', choice: 'matching_look', taskKey: 'order_party_attire' },
  { questionKey: 'party.attire_direction', choice: 'palette_guided', taskKey: 'share_palette_and_fit_guardrails' },
  { questionKey: 'party.attire_direction', choice: 'wear_what_you_own', taskKey: 'review_existing_outfits_for_comfort' },
  { questionKey: 'party.attire_direction', choice: 'no_group_attire', taskKey: 'confirm_no_required_outfit_purchase' },
] as const

const decisionCases: QuestScopingEvalCase[] = choices.map(({ questionKey, choice, taskKey }, index) => ({
  id: `wedding-party-decision-${questionKey}-${choice}`,
  category: 'decision',
  script: [
    call(`wedding-party-questions-${index}`, 'get_scoping_questions', {}),
    call(`wedding-party-candidates-${index}`, 'get_candidate_tasks', { questionKey, choice }),
    call(`wedding-party-proposal-${index}`, 'propose_decision', packet({
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
  id: `wedding-party-contested-${index + 1}`,
  category: 'couple_alignment',
  script: [
    call(`wedding-party-q-contested-${index}`, 'get_scoping_questions', {}),
    call(`wedding-party-contested-${index}`, 'propose_decision', packet({
      state: 'contested',
      summary: 'Both members have valid but different needs around the wedding-party role.',
      proposedChoice: null,
      reason: null,
      taskEffects: [],
    })),
  ],
  expectedStop: 'terminal_tool',
  expectedState: 'contested',
  expectedChoice: null,
}))

export const WEDDING_PARTY_SCOPING_EVAL_CASES: readonly QuestScopingEvalCase[] = Object.freeze([
  ...explorationCases,
  ...decisionCases,
  ...alignmentCases,
])
