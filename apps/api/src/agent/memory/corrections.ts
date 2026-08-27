import { and, desc, eq, isNull } from 'drizzle-orm'
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

/**
 * Accept an inference the assistant proposed.
 *
 * This is the deferred half of the write path: `committer.ts` stores an inferred claim
 * as `proposed` and deliberately does *not* retire whatever is currently confirmed for
 * the same `(subject, key)`. Retiring it is this function's job, because it is the
 * couple's acceptance — not the model's confidence — that makes an inference active.
 */
export async function acceptProposedClaim(input: {
  weddingId: string
  claimId: string
  userId: string
}) {
  return db.transaction(async tx => {
    const [claim] = await tx
      .select()
      .from(memoryClaims)
      .where(and(
        eq(memoryClaims.id, input.claimId),
        eq(memoryClaims.weddingId, input.weddingId),
        eq(memoryClaims.status, 'proposed'),
      ))
      .limit(1)
    if (!claim) return null

    const [current] = await tx
      .select({ id: memoryClaims.id })
      .from(memoryClaims)
      .where(and(
        eq(memoryClaims.weddingId, input.weddingId),
        eq(memoryClaims.subjectType, claim.subjectType),
        claim.subjectId
          ? eq(memoryClaims.subjectId, claim.subjectId)
          : isNull(memoryClaims.subjectId),
        eq(memoryClaims.key, claim.key),
        eq(memoryClaims.status, 'confirmed'),
      ))
      .limit(1)
    if (current) {
      await tx
        .update(memoryClaims)
        .set({ status: 'superseded' })
        .where(eq(memoryClaims.id, current.id))
    }

    const [accepted] = await tx
      .update(memoryClaims)
      .set({ status: 'confirmed', supersedesId: current?.id ?? null })
      .where(and(eq(memoryClaims.id, claim.id), eq(memoryClaims.status, 'proposed')))
      .returning()
    return accepted ?? null
  })
}

/**
 * Reject an inference. The claim is retired rather than deleted: a rejected guess is
 * the highest-value negative label this system produces, and it is the raw material
 * for measuring how often the assistant infers wrongly.
 */
export async function rejectProposedClaim(input: {
  weddingId: string
  claimId: string
}) {
  const [rejected] = await db
    .update(memoryClaims)
    .set({ status: 'superseded' })
    .where(and(
      eq(memoryClaims.id, input.claimId),
      eq(memoryClaims.weddingId, input.weddingId),
      eq(memoryClaims.status, 'proposed'),
    ))
    .returning()
  return rejected ?? null
}

/** Inferences awaiting the couple's judgement. Never enters an agent run's context. */
export async function loadProposedClaims(weddingId: string) {
  return db
    .select()
    .from(memoryClaims)
    .where(and(
      eq(memoryClaims.weddingId, weddingId),
      eq(memoryClaims.status, 'proposed'),
    ))
    .orderBy(desc(memoryClaims.createdAt))
}
