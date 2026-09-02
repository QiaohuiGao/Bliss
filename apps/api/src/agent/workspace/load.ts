import type {
  DecisionProposal,
  ExternalAction,
  MemoryProfileClaim,
  PlanningThread,
  QuestWorkspaceSnapshot,
  ThreadMessage,
  WeddingMemberSummary,
} from '@bliss/types'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../../db'
import {
  decisionProposalApprovals,
  decisionProposals,
  externalActions,
  memoryClaims,
  moments,
  planningThreads,
  threadMessages,
  users,
  vendorCandidates,
  vendorSearches,
  weddingMembers,
} from '../../db/schema'
import { AgentGuardrailError } from '../errors'
import { getQuestScopingOverview } from '../packs/quest-scoping'
import { loadCurrentDecisionState } from '../proposals/current'
import { projectDecisionProposalApprovals } from '../proposals/approvals'
import { projectQuestProgress } from '../threads/quest-progress'
import {
  projectWorkspaceCapabilities,
  projectWorkspaceMoment,
  projectWorkspaceProcedure,
  projectWorkspaceReadyActions,
  projectWorkspaceResourceCards,
} from './projection'

function asJson<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T
}

async function hydrateProposalVendors(proposal: typeof decisionProposals.$inferSelect) {
  const ids = proposal.vendorEffects.map(effect => effect.candidateId)
  if (ids.length === 0) return asJson<DecisionProposal>(proposal)
  const candidates = await db.select().from(vendorCandidates).where(and(
    eq(vendorCandidates.weddingId, proposal.weddingId),
    inArray(vendorCandidates.id, ids),
  ))
  const byId = new Map(candidates.map(candidate => [candidate.id, candidate]))
  return asJson<DecisionProposal>({
    ...proposal,
    vendorEffects: proposal.vendorEffects.map(effect => ({
      ...effect,
      candidate: byId.get(effect.candidateId) ?? null,
    })),
  })
}

export async function loadQuestWorkspaceSnapshot(input: {
  wedding: typeof import('../../db/schema').weddings.$inferSelect
  userId: string
  questKey: string
  questionKey?: string
}): Promise<QuestWorkspaceSnapshot> {
  const { wedding, userId, questKey } = input
  const [current, threadRows, memberRows] = await Promise.all([
    loadCurrentDecisionState(wedding.id),
    db.select().from(planningThreads)
      .where(eq(planningThreads.weddingId, wedding.id))
      .orderBy(desc(planningThreads.updatedAt)),
    db.select({
      id: weddingMembers.id,
      weddingId: weddingMembers.weddingId,
      userId: weddingMembers.userId,
      role: weddingMembers.role,
      joinedAt: weddingMembers.joinedAt,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    }).from(weddingMembers)
      .innerJoin(users, eq(users.id, weddingMembers.userId))
      .where(eq(weddingMembers.weddingId, wedding.id))
      .orderBy(asc(weddingMembers.joinedAt)),
  ])
  const customChoices = Object.fromEntries(
    [...current.byQuestion].map(([questionKey, decision]) => [questionKey, decision.customChoice ?? null]),
  )
  const scoping = getQuestScopingOverview(questKey, current.answers, undefined, customChoices)
  const authoredKeys = new Set(scoping.questions.map(question => question.questionKey))
  if (input.questionKey && !authoredKeys.has(input.questionKey)) {
    throw new AgentGuardrailError(
      'INVALID_QUESTION',
      'The requested question is not authored for this quest',
    )
  }
  const existingQuestionKey = threadRows.find(thread => (
    thread.questKey === questKey
    && thread.questionKey
    && authoredKeys.has(thread.questionKey)
  ))?.questionKey
  const activeQuestionKey = input.questionKey ?? existingQuestionKey ?? scoping.questions[0]?.questionKey
  if (!activeQuestionKey) {
    throw new AgentGuardrailError('QUEST_NOT_SCOPABLE', 'This quest has no authored questions')
  }
  const activeThreadRow = threadRows.find(thread => (
    thread.questKey === questKey && thread.questionKey === activeQuestionKey
  )) ?? null
  const activeDecision = current.byQuestion.get(activeQuestionKey) ?? null

  const [messageRows, proposalRow, actionRows, momentRow, claimRows, candidateRows] = await Promise.all([
    activeThreadRow
      ? db.select().from(threadMessages).where(and(
          eq(threadMessages.weddingId, wedding.id),
          eq(threadMessages.threadId, activeThreadRow.id),
        )).orderBy(asc(threadMessages.createdAt))
      : Promise.resolve([]),
    activeThreadRow
      ? db.select().from(decisionProposals).where(and(
          eq(decisionProposals.weddingId, wedding.id),
          eq(decisionProposals.threadId, activeThreadRow.id),
        )).orderBy(desc(decisionProposals.version)).limit(1).then(rows => rows[0] ?? null)
      : Promise.resolve(null),
    activeDecision
      ? db.select().from(externalActions).where(and(
          eq(externalActions.weddingId, wedding.id),
          eq(externalActions.decisionId, activeDecision.id),
        )).orderBy(desc(externalActions.createdAt))
      : Promise.resolve([]),
    activeDecision
      ? db.select().from(moments).where(and(
          eq(moments.weddingId, wedding.id),
          eq(moments.decisionId, activeDecision.id),
        )).orderBy(desc(moments.createdAt)).limit(1).then(rows => rows[0] ?? null)
      : Promise.resolve(null),
    activeDecision
      ? db.select().from(memoryClaims).where(and(
          eq(memoryClaims.weddingId, wedding.id),
          eq(memoryClaims.decisionId, activeDecision.id),
          eq(memoryClaims.status, 'confirmed'),
        )).orderBy(asc(memoryClaims.createdAt))
      : Promise.resolve([]),
    activeThreadRow && activeQuestionKey === 'photo.photographer_choice'
      ? db.select({ id: vendorCandidates.id, name: vendorCandidates.name })
          .from(vendorCandidates)
          .innerJoin(vendorSearches, eq(vendorSearches.id, vendorCandidates.searchId))
          .where(and(
            eq(vendorCandidates.weddingId, wedding.id),
            eq(vendorSearches.threadId, activeThreadRow.id),
          ))
          .orderBy(asc(vendorCandidates.createdAt))
      : Promise.resolve([]),
  ])
  const proposal = proposalRow ? await hydrateProposalVendors(proposalRow) : null
  const approvals = proposal
    ? await db.select({
        userId: decisionProposalApprovals.userId,
        approvedAt: decisionProposalApprovals.updatedAt,
      }).from(decisionProposalApprovals).where(and(
        eq(decisionProposalApprovals.weddingId, wedding.id),
        eq(decisionProposalApprovals.proposalId, proposal.id),
      ))
    : []
  const members = asJson<WeddingMemberSummary[]>(memberRows.map(member => ({
    ...member,
    isCurrentUser: member.userId === userId,
  })))
  const messages = asJson<ThreadMessage[]>(messageRows.map(message => ({
    ...message,
    isCurrentUser: message.authorUserId === userId,
  })))
  const actions = asJson<ExternalAction[]>(actionRows)
  const persistedMoment = momentRow ? asJson<{
    id: string
    status: 'suggested' | 'saved' | 'dismissed'
    title: string
    narrative: string
    sourceMessageIds: string[]
  }>(momentRow) : null
  const journey = projectQuestProgress(threadRows)
  const questProgress = journey.find(item => item.questKey === questKey)
  const projectionInput = {
    activeQuestionKey,
    journey,
    proposal,
    confirmed: Boolean(activeDecision),
    messageCount: messages.filter(message => message.authorType === 'user').length,
    persistedActions: actions,
    persistedMoment,
  }
  const sourceMessageIds = [...new Set(
    proposal?.memberInputs.flatMap(member => member.sourceMessageIds) ?? [],
  )]

  const questions = scoping.questions.map(question => (
    question.questionKey === 'photo.photographer_choice'
      ? {
          ...question,
          options: candidateRows.map(candidate => ({
            value: candidate.id,
            labelI18nKey: '',
            label: candidate.name,
          })),
        }
      : question
  ))

  return {
    wedding: asJson<QuestWorkspaceSnapshot['wedding']>(wedding),
    members,
    currentUserId: userId,
    journey,
    quest: {
      questKey,
      titleI18nKey: scoping.titleI18nKey,
      subtitleI18nKey: scoping.subtitleI18nKey,
      confirmedCount: questProgress?.confirmedCount ?? 0,
      totalCount: questProgress?.totalCount ?? scoping.questions.length,
    },
    procedure: projectWorkspaceProcedure(projectionInput),
    capabilities: projectWorkspaceCapabilities(projectionInput),
    questions,
    activeQuestionKey,
    activeThread: activeThreadRow ? asJson<PlanningThread>(activeThreadRow) : null,
    messages,
    understanding: {
      memberInputs: proposal?.memberInputs ?? [],
      sharedGround: proposal?.reason ?? activeDecision?.reason ?? null,
      sourceMessageIds,
      confirmedClaims: asJson<MemoryProfileClaim[]>(claimRows),
    },
    proposal,
    memberApprovals: proposal
      ? projectDecisionProposalApprovals(proposal.id, userId, memberRows, approvals).approvals
      : members.map(member => ({
          proposalId: '',
          userId: member.userId,
          displayName: member.displayName,
          isCurrentUser: member.isCurrentUser,
          ready: false,
          approvedAt: null,
        })),
    resourceCards: projectWorkspaceResourceCards(proposal),
    readyActions: projectWorkspaceReadyActions(projectionInput),
    moment: projectWorkspaceMoment(projectionInput),
  }
}
