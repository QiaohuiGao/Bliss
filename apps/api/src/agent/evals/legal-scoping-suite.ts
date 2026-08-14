import type { AgentModelResult, DecisionPacket } from '../types'
import type { QuestScopingEvalCase } from './quest-scoping-suite'

const call = (id: string, name: string, input: unknown): AgentModelResult => ({
  toolCalls: [{ id, name, input }],
  usage: { inputTokens: 100, outputTokens: 40, costMicros: 100 },
})

const packet = (overrides: Partial<DecisionPacket> = {}): DecisionPacket => ({
  schemaVersion: 1,
  threadId: 'thread-1',
  questKey: 'legal',
  questionKey: 'legal.name_plan',
  state: 'ready',
  summary: 'The paperwork plan now reflects the couple\'s actual name choice.',
  proposedChoice: 'keep_names',
  reason: 'Neither partner wants marriage to trigger a legal name-change project.',
  alternativesConsidered: [],
  memberInputs: [],
  taskEffects: [{ taskKey: 'confirm_no_name_change_workflow', rationale: 'Remove an inherited assumption.' }],
  memoryEffects: [],
  externalActions: [],
  vendorEffects: [],
  momentCandidate: null,
  ...overrides,
})

const explorationCases: QuestScopingEvalCase[] = [
  'Does the clerk checklist need to account for prior-marriage or foreign-issued records?',
  'Is either partner freely choosing a legal name change, or are both keeping their names?',
  'Does an immigration timeline call for qualified counsel, without sharing case identifiers here?',
].map((text, index) => ({
  id: `legal-follow-up-${index + 1}`,
  category: 'exploration',
  script: [{ text, toolCalls: [], usage: { inputTokens: 80, outputTokens: 25 } }],
  expectedStop: 'natural',
}))

const choices = [
  { questionKey: 'legal.document_context', choice: 'standard_documents', taskKey: 'confirm_standard_document_set_with_clerk' },
  { questionKey: 'legal.document_context', choice: 'prior_marriage_records', taskKey: 'collect_prior_marriage_records_for_clerk' },
  { questionKey: 'legal.document_context', choice: 'foreign_documents', taskKey: 'confirm_foreign_document_acceptance_with_clerk' },
  { questionKey: 'legal.name_plan', choice: 'keep_names', taskKey: 'confirm_no_name_change_workflow' },
  { questionKey: 'legal.name_plan', choice: 'one_partner_changes', taskKey: 'map_one_partner_name_change_accounts' },
  { questionKey: 'legal.name_plan', choice: 'both_change_or_new_name', taskKey: 'map_both_partner_name_change_accounts' },
  { questionKey: 'legal.immigration_context', choice: 'none', taskKey: null },
  { questionKey: 'legal.immigration_context', choice: 'k1_or_fiance_visa', taskKey: 'note_k1_ninety_day_window' },
  { questionKey: 'legal.immigration_context', choice: 'other_status_or_unsure', taskKey: 'prepare_questions_for_immigration_counsel' },
] as const

const decisionCases: QuestScopingEvalCase[] = choices.map(({ questionKey, choice, taskKey }, index) => ({
  id: `legal-decision-${questionKey}-${choice}`,
  category: 'decision',
  script: [
    call(`legal-questions-${index}`, 'get_scoping_questions', {}),
    call(`legal-candidates-${index}`, 'get_candidate_tasks', { questionKey, choice }),
    call(`legal-proposal-${index}`, 'propose_decision', packet({
      questionKey,
      proposedChoice: choice,
      reason: `Grounded couple workflow reason for ${choice}; legal rules remain subject to official verification.`,
      taskEffects: taskKey ? [{ taskKey, rationale: `Valid ${choice} workflow task.` }] : [],
    })),
  ],
  expectedStop: 'terminal_tool',
  expectedState: 'ready',
  expectedChoice: choice,
}))

const alignmentCases: QuestScopingEvalCase[] = Array.from({ length: 3 }, (_, index) => ({
  id: `legal-contested-${index + 1}`,
  category: 'couple_alignment',
  script: [
    call(`legal-q-contested-${index}`, 'get_scoping_questions', {}),
    call(`legal-contested-${index}`, 'propose_decision', packet({
      state: 'contested',
      summary: 'The members have different preferences about a personal paperwork choice.',
      proposedChoice: null,
      reason: null,
      taskEffects: [],
    })),
  ],
  expectedStop: 'terminal_tool',
  expectedState: 'contested',
  expectedChoice: null,
}))

export const LEGAL_SCOPING_EVAL_CASES: readonly QuestScopingEvalCase[] = Object.freeze([
  ...explorationCases,
  ...decisionCases,
  ...alignmentCases,
])
