import type {
  WorkspaceCapability,
  WorkspaceCapabilityKey,
  WorkspaceProcedurePhaseKey,
} from '@bliss/types'

export interface WorkspaceProjectionFacts {
  understood: boolean
  explored: boolean
  confirmed: boolean
  actionsComplete: boolean
  memoryComplete: boolean
  vendorCandidateCount: number
}

interface WorkflowDefinition {
  phases: Array<{
    key: WorkspaceProcedurePhaseKey
    titleI18nKey: string
  }>
  capabilities: Array<{
    key: WorkspaceCapabilityKey
    icon: string
    titleI18nKey: string
    bodyI18nKey: string
    promptI18nKey: string
    enabled: (facts: WorkspaceProjectionFacts) => boolean
  }>
}

const defaultPhases: WorkflowDefinition['phases'] = [
  { key: 'understand', titleI18nKey: 'workspace.cycle.understand' },
  { key: 'explore', titleI18nKey: 'workspace.cycle.explore' },
  { key: 'decide', titleI18nKey: 'workspace.cycle.decide' },
  { key: 'act', titleI18nKey: 'workspace.cycle.act' },
  { key: 'remember', titleI18nKey: 'workspace.cycle.remember' },
]

const defaultCapabilities: WorkflowDefinition['capabilities'] = [
  capability('context', '⌕', () => true),
  capability('compare', '≍', facts => !facts.confirmed),
  capability('next', '→', facts => facts.understood),
  capability('remember', '◇', facts => facts.confirmed || facts.explored),
]

const photographerChoice: WorkflowDefinition = {
  phases: [
    { key: 'understand', titleI18nKey: 'workspace.workflow.photographerChoice.understand' },
    { key: 'explore', titleI18nKey: 'workspace.workflow.photographerChoice.explore' },
    { key: 'decide', titleI18nKey: 'workspace.workflow.photographerChoice.decide' },
    { key: 'act', titleI18nKey: 'workspace.workflow.photographerChoice.act' },
    { key: 'remember', titleI18nKey: 'workspace.workflow.photographerChoice.remember' },
  ],
  capabilities: [
    capability('findVendors', '⌕', facts => !facts.confirmed),
    capability('compareVendors', '≍', facts => facts.vendorCandidateCount > 1 && !facts.confirmed),
    capability('draftInquiry', '→', facts => facts.vendorCandidateCount > 0),
    capability('planInterviews', '◇', facts => facts.vendorCandidateCount > 0),
  ],
}

const defaultWorkflow: WorkflowDefinition = {
  phases: defaultPhases,
  capabilities: defaultCapabilities,
}

function capability(
  key: WorkspaceCapabilityKey,
  icon: string,
  enabled: (facts: WorkspaceProjectionFacts) => boolean,
): WorkflowDefinition['capabilities'][number] {
  return {
    key,
    icon,
    titleI18nKey: `workspace.capabilities.${key}.title`,
    bodyI18nKey: `workspace.capabilities.${key}.body`,
    promptI18nKey: `workspace.capabilities.${key}.prompt`,
    enabled,
  }
}

export function workspaceWorkflowFor(questionKey: string): WorkflowDefinition {
  return questionKey === 'photo.photographer_choice' ? photographerChoice : defaultWorkflow
}

export function projectRegisteredCapabilities(
  questionKey: string,
  facts: WorkspaceProjectionFacts,
): WorkspaceCapability[] {
  return workspaceWorkflowFor(questionKey).capabilities.map(item => ({
    key: item.key,
    icon: item.icon,
    titleI18nKey: item.titleI18nKey,
    bodyI18nKey: item.bodyI18nKey,
    promptI18nKey: item.promptI18nKey,
    enabled: item.enabled(facts),
  }))
}
