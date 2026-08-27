import type { FastifyInstance } from 'fastify'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { AgentGuardrailError, normalizedAgentError } from '../agent/errors'
import { attachMomentAsset } from '../agent/memory/assets'
import { loadMemoryProfile } from '../agent/memory/profile'
import {
  acceptProposedClaim,
  correctMemoryClaim,
  loadProposedClaims,
  rejectProposedClaim,
} from '../agent/memory/corrections'
import {
  configuredMediaUploadProvider,
  parseMediaObjectReference,
} from '../agent/providers/media-upload'
import { db } from '../db'
import {
  momentAssets,
  moments,
} from '../db/schema'
import { requireAuth, requireWeddingAccess } from '../middleware/auth'

const correctionSchema = z.object({
  value: z.unknown(),
  reason: z.string().trim().min(1).max(1_000),
}).refine(body => Object.prototype.hasOwnProperty.call(body, 'value'), {
  message: 'A corrected value is required',
})

const momentStatusSchema = z.object({
  status: z.enum(['suggested', 'saved', 'dismissed']),
})

const momentAssetSchema = z.object({
  kind: z.enum(['memory', 'before', 'after', 'reference']).default('memory'),
  uploadIntentId: z.string().uuid(),
  caption: z.string().trim().max(500).nullable().optional(),
}).strict()

async function hydrateMomentAssetUrls(
  weddingId: string,
  assets: Array<typeof momentAssets.$inferSelect>,
) {
  if (!assets.some(asset => parseMediaObjectReference(asset.url))) return assets
  const provider = configuredMediaUploadProvider()
  if (!provider) {
    throw new AgentGuardrailError(
      'MEDIA_PROVIDER_NOT_CONFIGURED',
      'Photo access is temporarily unavailable',
      true,
    )
  }
  return Promise.all(assets.map(async asset => {
    const objectKey = parseMediaObjectReference(asset.url)
    if (!objectKey) return asset
    const grant = await provider.createReadGrant({ weddingId, objectKey })
    return { ...asset, url: grant.url }
  }))
}

export async function memoryRoutes(app: FastifyInstance) {
  const access = { preHandler: [requireAuth, requireWeddingAccess] }

  app.get('/weddings/:weddingId/memory', access, async (req, reply) => {
    const { weddingId } = req.params as { weddingId: string }
    return reply.send(await loadMemoryProfile(weddingId))
  })

  // Inferences the assistant has not had confirmed. Deliberately a separate endpoint
  // from `GET /memory`: that projection is what agent runs retrieve, and an unaccepted
  // guess must not reach a prompt.
  app.get('/weddings/:weddingId/memory/proposed', access, async (req, reply) => {
    const { weddingId } = req.params as { weddingId: string }
    return reply.send(await loadProposedClaims(weddingId))
  })

  app.post('/weddings/:weddingId/memory/:claimId/accept', access, async (req, reply) => {
    const { weddingId, claimId } = req.params as { weddingId: string; claimId: string }
    const userId = (req as any).userId as string
    const accepted = await acceptProposedClaim({ weddingId, claimId, userId })
    if (!accepted) {
      return reply.status(409).send({ error: 'Memory claim is missing or is no longer proposed' })
    }
    return reply.send(accepted)
  })

  app.post('/weddings/:weddingId/memory/:claimId/reject', access, async (req, reply) => {
    const { weddingId, claimId } = req.params as { weddingId: string; claimId: string }
    const rejected = await rejectProposedClaim({ weddingId, claimId })
    if (!rejected) {
      return reply.status(409).send({ error: 'Memory claim is missing or is no longer proposed' })
    }
    return reply.send(rejected)
  })

  app.post('/weddings/:weddingId/memory/:claimId/correct', access, async (req, reply) => {
    const { weddingId, claimId } = req.params as { weddingId: string; claimId: string }
    const userId = (req as any).userId as string
    const body = correctionSchema.parse(req.body)

    const corrected = await correctMemoryClaim({
      weddingId,
      claimId,
      userId,
      value: body.value,
      reason: body.reason,
    })

    if (!corrected) {
      return reply.status(409).send({ error: 'Memory claim is missing or has already changed' })
    }
    return reply.send(corrected)
  })

  app.get('/weddings/:weddingId/moments', access, async (req, reply) => {
    const { weddingId } = req.params as { weddingId: string }
    const rows = await db
      .select()
      .from(moments)
      .where(eq(moments.weddingId, weddingId))
      .orderBy(desc(moments.createdAt))
    const storedAssets = rows.length
      ? await db
          .select()
          .from(momentAssets)
          .where(inArray(momentAssets.momentId, rows.map(moment => moment.id)))
          .orderBy(asc(momentAssets.sortOrder), asc(momentAssets.createdAt))
      : []
    let assets
    try {
      assets = await hydrateMomentAssetUrls(weddingId, storedAssets)
    } catch (error) {
      const normalized = normalizedAgentError(error)
      req.log.error({ error: normalized, weddingId }, 'Moment media read grant failed')
      return reply.status(503).send({ error: normalized.message, ...normalized })
    }
    const byMoment = new Map<string, typeof assets>()
    for (const asset of assets) {
      const list = byMoment.get(asset.momentId) ?? []
      list.push(asset)
      byMoment.set(asset.momentId, list)
    }
    return reply.send(rows.map(moment => ({
      ...moment,
      assets: byMoment.get(moment.id) ?? [],
    })))
  })

  app.patch('/weddings/:weddingId/moments/:momentId', access, async (req, reply) => {
    const { weddingId, momentId } = req.params as { weddingId: string; momentId: string }
    const userId = (req as any).userId as string
    const { status } = momentStatusSchema.parse(req.body)
    const [updated] = await db
      .update(moments)
      .set({
        status,
        savedBy: status === 'saved' ? userId : null,
        savedAt: status === 'saved' ? new Date() : null,
      })
      .where(and(eq(moments.id, momentId), eq(moments.weddingId, weddingId)))
      .returning()
    if (!updated) return reply.status(404).send({ error: 'Moment not found' })
    return reply.send(updated)
  })

  app.post('/weddings/:weddingId/moments/:momentId/assets', access, async (req, reply) => {
    const { weddingId, momentId } = req.params as { weddingId: string; momentId: string }
    const userId = (req as any).userId as string
    const body = momentAssetSchema.parse(req.body)
    const result = await attachMomentAsset({
      weddingId,
      momentId,
      userId,
      uploadIntentId: body.uploadIntentId,
      kind: body.kind,
      caption: body.caption,
    })
    if (result.status === 'moment_missing') {
      return reply.status(404).send({ error: 'Moment not found' })
    }
    if (result.status === 'intent_unavailable') {
      return reply.status(409).send({
        error: 'Upload intent is expired, already used, or belongs to another wedding',
        code: 'MEDIA_UPLOAD_INTENT_UNAVAILABLE',
      })
    }
    try {
      const [asset] = await hydrateMomentAssetUrls(weddingId, [result.asset])
      return reply.status(201).send(asset)
    } catch (error) {
      const normalized = normalizedAgentError(error)
      req.log.error({ error: normalized, weddingId }, 'Moment media read grant failed')
      return reply.status(503).send({ error: normalized.message, ...normalized })
    }
  })

  app.delete('/weddings/:weddingId/moment-assets/:assetId', access, async (req, reply) => {
    const { weddingId, assetId } = req.params as { weddingId: string; assetId: string }
    const [asset] = await db.select({ url: momentAssets.url }).from(momentAssets)
      .where(and(eq(momentAssets.id, assetId), eq(momentAssets.weddingId, weddingId)))
      .limit(1)
    if (!asset) return reply.status(404).send({ error: 'Moment asset not found' })

    const objectKey = parseMediaObjectReference(asset.url)
    if (objectKey) {
      try {
        const provider = configuredMediaUploadProvider()
        if (!provider) {
          throw new AgentGuardrailError(
            'MEDIA_PROVIDER_NOT_CONFIGURED',
            'Photo deletion is temporarily unavailable',
            true,
          )
        }
        await provider.deleteObject({ weddingId, objectKey })
      } catch (error) {
        const normalized = normalizedAgentError(error)
        req.log.error({ error: normalized, weddingId, assetId }, 'Moment media deletion failed')
        return reply.status(503).send({ error: normalized.message, ...normalized })
      }
    }
    const [deleted] = await db
      .delete(momentAssets)
      .where(and(eq(momentAssets.id, assetId), eq(momentAssets.weddingId, weddingId)))
      .returning({ id: momentAssets.id })
    if (!deleted) return reply.status(404).send({ error: 'Moment asset not found' })
    return reply.status(204).send()
  })
}
