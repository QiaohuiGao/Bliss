import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../../db'
import {
  decisionProposals,
  planningThreads,
  threadMessages,
  vendorCandidates,
  vendorSearches,
  weddingMembers,
} from '../../db/schema'
import { AgentGuardrailError } from '../errors'
import type { AgentToolContext, DecisionPacket } from '../types'

export interface StoredDecisionProposal {
  proposalId: string
  version: number
  status: 'pending'
}

export interface DecisionProposalStore {
  create(
    context: AgentToolContext,
    packet: DecisionPacket,
  ): Promise<StoredDecisionProposal>
}

const evidenceIds = (packet: DecisionPacket): string[] => Array.from(new Set([
  ...packet.memberInputs.flatMap(input => input.sourceMessageIds),
  ...packet.memoryEffects.flatMap(claim => claim.evidenceMessageIds),
  ...(packet.momentCandidate?.sourceMessageIds ?? []),
]))

export class DatabaseDecisionProposalStore implements DecisionProposalStore {
  async create(
    context: AgentToolContext,
    packet: DecisionPacket,
  ): Promise<StoredDecisionProposal> {
    return db.transaction(async tx => {
      const [thread] = await tx
        .select()
        .from(planningThreads)
        .where(and(
          eq(planningThreads.id, context.threadId),
          eq(planningThreads.weddingId, context.weddingId),
        ))
        .limit(1)

      if (!thread) {
        throw new AgentGuardrailError(
          'THREAD_NOT_FOUND',
          'The planning thread does not belong to this wedding',
        )
      }
      if (packet.threadId !== context.threadId || packet.questKey !== thread.questKey) {
        throw new AgentGuardrailError(
          'PROPOSAL_SCOPE_MISMATCH',
          'The Decision Packet does not match the active planning thread',
        )
      }

      const members = await tx
        .select({ userId: weddingMembers.userId })
        .from(weddingMembers)
        .where(eq(weddingMembers.weddingId, context.weddingId))
      const memberIds = new Set(members.map(member => member.userId))
      const claimedMemberIds = new Set(packet.memberInputs.map(input => input.memberId))
      for (const memberId of claimedMemberIds) {
        if (!memberIds.has(memberId)) {
          throw new AgentGuardrailError(
            'INVALID_MEMBER_INPUT',
            'Every represented member must belong to this wedding',
          )
        }
      }
      for (const claim of packet.memoryEffects) {
        if (claim.subjectType === 'member' && (!claim.subjectId || !memberIds.has(claim.subjectId))) {
          throw new AgentGuardrailError(
            'INVALID_MEMORY_SUBJECT',
            'Member memory can only be attached to a member of this wedding',
          )
        }
        if (claim.subjectType !== 'member' && claim.subjectId !== null) {
          throw new AgentGuardrailError(
            'INVALID_MEMORY_SUBJECT',
            'Wedding and couple memory must not name an individual subject',
          )
        }
      }

      const evidence = evidenceIds(packet)
      if (evidence.length > 0) {
        const rows = await tx
          .select({
            id: threadMessages.id,
            authorType: threadMessages.authorType,
            authorUserId: threadMessages.authorUserId,
          })
          .from(threadMessages)
          .where(and(
            eq(threadMessages.threadId, context.threadId),
            eq(threadMessages.weddingId, context.weddingId),
            inArray(threadMessages.id, evidence),
          ))
        if (rows.length !== evidence.length) {
          throw new AgentGuardrailError(
            'INVALID_MEMORY_EVIDENCE',
            'Every preference and Moment claim must cite a message from the active thread',
          )
        }
        const evidenceById = new Map(rows.map(row => [row.id, row]))
        for (const memberInput of packet.memberInputs) {
          const misattributed = memberInput.sourceMessageIds.some(messageId => {
            const message = evidenceById.get(messageId)
            return message?.authorType !== 'user' || message.authorUserId !== memberInput.memberId
          })
          if (misattributed) {
            throw new AgentGuardrailError(
              'MISATTRIBUTED_MEMBER_INPUT',
              'A member stance must cite that member\'s own message',
            )
          }
        }
      }

      const candidateIds = packet.vendorEffects.map(vendor => vendor.candidateId)
      if (new Set(candidateIds).size !== candidateIds.length) {
        throw new AgentGuardrailError('DUPLICATE_VENDOR', 'A vendor may only appear once in a proposal')
      }
      if (candidateIds.length > 0) {
        const candidates = await tx
          .select({ id: vendorCandidates.id })
          .from(vendorCandidates)
          .innerJoin(vendorSearches, eq(vendorSearches.id, vendorCandidates.searchId))
          .where(and(
            eq(vendorCandidates.weddingId, context.weddingId),
            eq(vendorSearches.threadId, context.threadId),
            inArray(vendorCandidates.id, candidateIds),
          ))
        if (candidates.length !== candidateIds.length) {
          throw new AgentGuardrailError(
            'INVALID_VENDOR_CANDIDATE',
            'Every shortlisted vendor must come from this planning thread search',
          )
        }
      }

      const [latest] = await tx
        .select({ version: decisionProposals.version })
        .from(decisionProposals)
        .where(eq(decisionProposals.threadId, context.threadId))
        .orderBy(desc(decisionProposals.version))
        .limit(1)
      const version = (latest?.version ?? 0) + 1

      await tx
        .update(decisionProposals)
        .set({ status: 'superseded' })
        .where(and(
          eq(decisionProposals.threadId, context.threadId),
          eq(decisionProposals.status, 'pending'),
        ))

      const [created] = await tx
        .insert(decisionProposals)
        .values({
          weddingId: context.weddingId,
          threadId: context.threadId,
          agentRunId: context.runId,
          schemaVersion: packet.schemaVersion,
          version,
          questKey: packet.questKey,
          questionKey: packet.questionKey,
          state: packet.state,
          summary: packet.summary,
          proposedChoice: packet.proposedChoice,
          reason: packet.reason,
          alternativesConsidered: packet.alternativesConsidered,
          memberInputs: packet.memberInputs,
          taskEffects: packet.taskEffects,
          memoryEffects: packet.memoryEffects,
          externalActions: packet.externalActions,
          vendorEffects: packet.vendorEffects,
          momentCandidate: packet.momentCandidate,
        })
        .returning({ id: decisionProposals.id })

      await tx
        .update(planningThreads)
        .set({
          status: packet.state === 'contested' ? 'contested' : 'ready',
          updatedAt: new Date(),
        })
        .where(eq(planningThreads.id, context.threadId))

      return { proposalId: created!.id, version, status: 'pending' as const }
    })
  }
}
