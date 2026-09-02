import type {
  DecisionProposal,
  ExternalAction,
  QuestProgress,
  WorkspaceCapability,
  WorkspaceMoment,
  WorkspaceProcedurePhase,
  WorkspaceReadyAction,
  WorkspaceResourceCard,
} from '@bliss/types'
import { projectRegisteredCapabilities, workspaceWorkflowFor, type WorkspaceProjectionFacts } from './registry'

export interface WorkspaceProjectionInput {
  activeQuestionKey: string
  journey: QuestProgress[]
  proposal: DecisionProposal | null
  confirmed: boolean
  messageCount: number
  persistedActions: ExternalAction[]
  persistedMoment: {
    id: string
    status: 'suggested' | 'saved' | 'dismissed'
    title: string
    narrative: string
    sourceMessageIds: string[]
  } | null
}

export function projectWorkspaceProcedure(input: WorkspaceProjectionInput): WorkspaceProcedurePhase[] {
  const facts = projectionFacts(input)
  const stateByPhase: Record<WorkspaceProcedurePhase['key'], WorkspaceProcedurePhase['state']> = {
    understand: facts.understood ? 'done' : 'current',
    explore: facts.explored ? 'done' : facts.understood ? 'current' : 'open',
    decide: facts.confirmed ? 'done' : input.proposal ? 'current' : 'open',
    act: facts.actionsComplete ? 'done' : facts.confirmed ? 'current' : 'open',
    remember: facts.memoryComplete ? 'done' : facts.actionsComplete ? 'current' : 'open',
  }
  return workspaceWorkflowFor(input.activeQuestionKey).phases.map(phase => ({
    ...phase,
    state: stateByPhase[phase.key],
  }))
}

function projectionFacts(input: WorkspaceProjectionInput): WorkspaceProjectionFacts {
  const understood = input.messageCount > 0 || Boolean(input.proposal) || input.confirmed
  const explored = Boolean(input.proposal) || input.confirmed
  const actionsComplete = input.confirmed && (
    input.persistedActions.length === 0
    || input.persistedActions.every(action => ['succeeded', 'cancelled'].includes(action.status))
  )
  const memoryComplete = input.persistedMoment?.status === 'saved'
    || input.persistedMoment?.status === 'dismissed'

  return {
    understood,
    explored,
    confirmed: input.confirmed,
    actionsComplete,
    memoryComplete,
    vendorCandidateCount: input.proposal?.vendorEffects.length ?? 0,
  }
}

export function projectWorkspaceCapabilities(input: WorkspaceProjectionInput): WorkspaceCapability[] {
  return projectRegisteredCapabilities(input.activeQuestionKey, projectionFacts(input))
}

export function projectWorkspaceResourceCards(proposal: DecisionProposal | null): WorkspaceResourceCard[] {
  if (!proposal) return []
  const vendors: WorkspaceResourceCard[] = proposal.vendorEffects.flatMap(effect => {
    if (!effect.candidate) return []
    return [{
      type: 'vendor' as const,
      candidateId: effect.candidateId,
      name: effect.candidate.name,
      website: effect.candidate.website,
      sourceUrl: effect.candidate.sourceUrl,
      priceLevel: effect.candidate.priceLevel,
      summary: effect.candidate.summary,
      rationale: effect.rationale,
      pros: effect.pros,
      concerns: effect.concerns,
    }]
  })
  const tasks: WorkspaceResourceCard[] = proposal.taskEffects.map(effect => ({
    type: 'task_effect',
    taskKey: effect.taskKey,
    rationale: effect.rationale,
  }))
  return [...vendors, ...tasks]
}

export function projectWorkspaceReadyActions(input: WorkspaceProjectionInput): WorkspaceReadyAction[] {
  if (input.persistedActions.length > 0) {
    return input.persistedActions.map(action => ({
      source: 'persisted',
      id: action.id,
      kind: action.kind,
      payload: action.approvedPayload ?? action.payload,
      status: action.status,
    }))
  }
  return input.proposal?.externalActions.map(action => ({
    source: 'proposal_preview',
    id: null,
    kind: action.kind,
    payload: action.payload,
    status: 'preview',
  })) ?? []
}

export function projectWorkspaceMoment(input: WorkspaceProjectionInput): WorkspaceMoment | null {
  if (input.persistedMoment) {
    return {
      source: 'persisted',
      id: input.persistedMoment.id,
      status: input.persistedMoment.status,
      title: input.persistedMoment.title,
      narrative: input.persistedMoment.narrative,
      sourceMessageIds: input.persistedMoment.sourceMessageIds,
    }
  }
  if (!input.proposal?.momentCandidate) return null
  return {
    source: 'proposal_preview',
    id: null,
    status: 'preview',
    ...input.proposal.momentCandidate,
  }
}
