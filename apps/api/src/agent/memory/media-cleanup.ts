import { and, eq, lte } from 'drizzle-orm'
import { db } from '../../db'
import { mediaUploadIntents } from '../../db/schema'
import type { MediaUploadProvider } from '../providers/media-upload'

export async function cleanupExpiredMediaUploads(
  provider: MediaUploadProvider,
  now = new Date(),
  limit = 100,
) {
  const expired = await db.select({
    id: mediaUploadIntents.id,
    weddingId: mediaUploadIntents.weddingId,
    objectKey: mediaUploadIntents.objectKey,
  }).from(mediaUploadIntents).where(and(
    eq(mediaUploadIntents.status, 'pending'),
    lte(mediaUploadIntents.expiresAt, now),
  )).limit(Math.min(Math.max(limit, 1), 500))

  const cleaned: string[] = []
  const failed: Array<{ id: string; error: string }> = []
  for (const intent of expired) {
    try {
      // DELETE is idempotent, including when the browser never completed PUT.
      await provider.deleteObject({
        weddingId: intent.weddingId,
        objectKey: intent.objectKey,
      })
      const [marked] = await db.update(mediaUploadIntents).set({ status: 'expired' })
        .where(and(
          eq(mediaUploadIntents.id, intent.id),
          eq(mediaUploadIntents.status, 'pending'),
        ))
        .returning({ id: mediaUploadIntents.id })
      if (marked) cleaned.push(marked.id)
    } catch (error) {
      failed.push({
        id: intent.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return { cleaned, failed }
}
