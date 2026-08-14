import { and, desc, eq } from 'drizzle-orm'
import { db } from '../../db'
import { memoryClaims, planningThreads, threadMessages } from '../../db/schema'

export async function correctMemoryClaim(input: {
  weddingId: string
  claimId: string
  userId: string
  value: unknown
  reason: string
}) {
  return db.transaction(async tx => {
    const [claim] = await tx
      .select()
      .from(memoryClaims)
      .where(and(
        eq(memoryClaims.id, input.claimId),
        eq(memoryClaims.weddingId, input.weddingId),
        eq(memoryClaims.status, 'confirmed'),
      ))
      .limit(1)
    if (!claim) return null

    let [memoryThread] = await tx
      .select({ id: planningThreads.id })
      .from(planningThreads)
      .where(and(
        eq(planningThreads.weddingId, input.weddingId),
        eq(planningThreads.questKey, 'memory_profile'),
      ))
      .orderBy(desc(planningThreads.updatedAt))
      .limit(1)
    if (!memoryThread) {
      ;[memoryThread] = await tx.insert(planningThreads).values({
        weddingId: input.weddingId,
        questKey: 'memory_profile',
        title: 'Memory corrections',
        openedBy: input.userId,
      }).returning({ id: planningThreads.id })
    }

    const [evidence] = await tx.insert(threadMessages).values({
      weddingId: input.weddingId,
      threadId: memoryThread!.id,
      authorType: 'user',
      authorUserId: input.userId,
      content: input.reason,
      metadata: { kind: 'memory_correction', claimId: input.claimId },
    }).returning({ id: threadMessages.id })

    const [superseded] = await tx
      .update(memoryClaims)
      .set({ status: 'superseded' })
      .where(and(
        eq(memoryClaims.id, claim.id),
        eq(memoryClaims.status, 'confirmed'),
      ))
      .returning({ id: memoryClaims.id })
    if (!superseded) return null

    const [replacement] = await tx.insert(memoryClaims).values({
      weddingId: input.weddingId,
      decisionId: null,
      subjectType: claim.subjectType,
      subjectId: claim.subjectId,
      kind: claim.kind,
      key: claim.key,
      value: input.value,
      source: 'explicit',
      confidenceBasisPoints: 10_000,
      status: 'confirmed',
      evidenceMessageIds: [evidence!.id],
      createdBy: input.userId,
      supersedesId: claim.id,
    }).returning()
    return replacement
  })
}
