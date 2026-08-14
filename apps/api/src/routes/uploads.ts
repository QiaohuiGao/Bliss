import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { normalizedAgentError } from '../agent/errors'
import { cleanupExpiredMediaUploads } from '../agent/memory/media-cleanup'
import {
  configuredMediaUploadProvider,
  mediaObjectReference,
  MEDIA_CONTENT_TYPES,
} from '../agent/providers/media-upload'
import { db } from '../db'
import { mediaUploadIntents } from '../db/schema'
import { requireAuth, requireWeddingAccess } from '../middleware/auth'

const uploadIntentSchema = z.object({
  purpose: z.literal('moment'),
  contentType: z.enum(MEDIA_CONTENT_TYPES),
  sizeBytes: z.number().int().positive(),
  originalFilename: z.string().trim().min(1).max(255),
}).strict()

export async function uploadRoutes(app: FastifyInstance) {
  const access = { preHandler: [requireAuth, requireWeddingAccess] }

  app.post('/weddings/:weddingId/uploads/intents', access, async (req, reply) => {
    const { weddingId } = req.params as { weddingId: string }
    const userId = (req as any).userId as string
    const parsed = uploadIntentSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Choose a valid JPEG, PNG, or WebP image',
        code: 'MEDIA_UPLOAD_INPUT_INVALID',
      })
    }
    let provider
    try {
      provider = configuredMediaUploadProvider()
    } catch (error) {
      const normalized = normalizedAgentError(error)
      req.log.error({ error: normalized }, 'Media upload provider configuration is invalid')
      return reply.status(503).send({ error: normalized.message, ...normalized })
    }
    if (!provider) {
      return reply.status(503).send({
        error: 'Photo uploads are not configured',
        code: 'MEDIA_PROVIDER_NOT_CONFIGURED',
      })
    }
    if (parsed.data.sizeBytes > provider.maxBytes) {
      return reply.status(413).send({
        error: 'Image exceeds the upload size limit',
        code: 'MEDIA_SIZE_NOT_ALLOWED',
        maxBytes: provider.maxBytes,
      })
    }

    const id = crypto.randomUUID()
    try {
      const grant = await provider.createUploadGrant({
        intentId: id,
        weddingId,
        ...parsed.data,
      })
      await db.insert(mediaUploadIntents).values({
        id,
        weddingId,
        createdBy: userId,
        provider: grant.provider,
        purpose: parsed.data.purpose,
        contentType: parsed.data.contentType,
        sizeBytes: parsed.data.sizeBytes,
        originalFilename: parsed.data.originalFilename
          .replace(/[\u0000-\u001f\u007f]/g, ' '),
        objectKey: grant.objectKey,
        // Kept opaque at rest. Read URLs are signed only after wedding access
        // is checked; the bucket itself remains private.
        assetUrl: mediaObjectReference(grant.objectKey),
        expiresAt: grant.expiresAt,
      })
      return reply.status(201).send({
        id,
        provider: grant.provider,
        purpose: parsed.data.purpose,
        contentType: parsed.data.contentType,
        sizeBytes: parsed.data.sizeBytes,
        uploadUrl: grant.uploadUrl,
        uploadHeaders: grant.uploadHeaders,
        expiresAt: grant.expiresAt,
      })
    } catch (error) {
      const normalized = normalizedAgentError(error)
      req.log.error({ error: normalized, weddingId }, 'Media upload intent failed')
      return reply.status(normalized.retryable ? 503 : 422).send({
        error: normalized.message,
        ...normalized,
      })
    }
  })

  app.post('/internal/cron/media-uploads', async (req, reply) => {
    const secret = process.env['CRON_SECRET']
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    try {
      const provider = configuredMediaUploadProvider()
      if (!provider) {
        return reply.status(503).send({
          error: 'Photo uploads are not configured',
          code: 'MEDIA_PROVIDER_NOT_CONFIGURED',
        })
      }
      const result = await cleanupExpiredMediaUploads(provider)
      return reply.send({
        cleaned: result.cleaned.length,
        failed: result.failed.length,
        intentIds: result.cleaned,
      })
    } catch (error) {
      const normalized = normalizedAgentError(error)
      req.log.error({ error: normalized }, 'Media upload cleanup failed')
      return reply.status(500).send({ error: normalized.message, ...normalized })
    }
  })
}
