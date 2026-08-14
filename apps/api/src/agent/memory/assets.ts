import { and, eq, gt } from 'drizzle-orm'
import { db } from '../../db'
import { mediaUploadIntents, momentAssets, moments } from '../../db/schema'

export type AttachMomentAssetResult =
  | { status: 'created'; asset: typeof momentAssets.$inferSelect }
  | { status: 'moment_missing' }
  | { status: 'intent_unavailable' }

/**
 * Consumes one provider-issued upload intent and binds its controlled asset URL
 * to a Moment. The state transition and asset insert share one transaction so
 * an intent can never be attached twice, even under concurrent requests.
 */
export async function attachMomentAsset(input: {
  weddingId: string
  momentId: string
  userId: string
  uploadIntentId: string
  kind: 'memory' | 'before' | 'after' | 'reference'
  caption?: string | null
}): Promise<AttachMomentAssetResult> {
  return db.transaction(async tx => {
    const [parent] = await tx
      .select({ id: moments.id })
      .from(moments)
      .where(and(eq(moments.id, input.momentId), eq(moments.weddingId, input.weddingId)))
      .limit(1)
    if (!parent) return { status: 'moment_missing' as const }

    const now = new Date()
    const [intent] = await tx.update(mediaUploadIntents).set({
      status: 'attached',
      attachedAt: now,
    }).where(and(
      eq(mediaUploadIntents.id, input.uploadIntentId),
      eq(mediaUploadIntents.weddingId, input.weddingId),
      eq(mediaUploadIntents.createdBy, input.userId),
      eq(mediaUploadIntents.purpose, 'moment'),
      eq(mediaUploadIntents.status, 'pending'),
      gt(mediaUploadIntents.expiresAt, now),
    )).returning({ assetUrl: mediaUploadIntents.assetUrl })
    if (!intent) return { status: 'intent_unavailable' as const }

    const existing = await tx
      .select({ id: momentAssets.id })
      .from(momentAssets)
      .where(eq(momentAssets.momentId, input.momentId))
    const [asset] = await tx.insert(momentAssets).values({
      weddingId: input.weddingId,
      momentId: input.momentId,
      kind: input.kind,
      url: intent.assetUrl,
      caption: input.caption ?? null,
      sortOrder: existing.length,
    }).returning()
    return { status: 'created' as const, asset: asset! }
  })
}
