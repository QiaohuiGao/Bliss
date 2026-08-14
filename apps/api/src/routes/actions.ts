import type { FastifyInstance } from 'fastify'
import { and, desc, eq } from 'drizzle-orm'
import { ExternalActionApprover } from '../agent/actions/approver'
import { ExternalActionWorker } from '../agent/actions/action-worker'
import { fireDueReminders } from '../agent/actions/reminder-worker'
import { normalizedAgentError } from '../agent/errors'
import { configuredEmailSendProvider } from '../agent/providers/email-send'
import { db } from '../db'
import { externalActions } from '../db/schema'
import { requireAuth, requireWeddingAccess } from '../middleware/auth'

export async function actionRoutes(app: FastifyInstance) {
  const access = { preHandler: [requireAuth, requireWeddingAccess] }

  app.get('/weddings/:weddingId/actions', access, async (req, reply) => {
    const { weddingId } = req.params as { weddingId: string }
    const actions = await db
      .select()
      .from(externalActions)
      .where(eq(externalActions.weddingId, weddingId))
      .orderBy(desc(externalActions.createdAt))
    return reply.send(actions)
  })

  app.post('/weddings/:weddingId/actions/:actionId/approve', access, async (req, reply) => {
    const { weddingId, actionId } = req.params as { weddingId: string; actionId: string }
    const userId = (req as any).userId as string
    const idempotencyKey = req.headers['idempotency-key']
    if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
      return reply.status(400).send({ error: 'Idempotency-Key header is required' })
    }
    try {
      return reply.send(await new ExternalActionApprover().approve({
        actionId,
        weddingId,
        userId,
        idempotencyKey,
      }))
    } catch (error) {
      const normalized = normalizedAgentError(error)
      const status = normalized.code.includes('PROVIDER')
        ? 503
        : normalized.code === 'UNEXPECTED_ERROR'
          ? 500
          : 409
      return reply.status(status).send({
        error: normalized.message,
        ...normalized,
      })
    }
  })

  app.post('/weddings/:weddingId/actions/:actionId/cancel', access, async (req, reply) => {
    const { weddingId, actionId } = req.params as { weddingId: string; actionId: string }
    const [cancelled] = await db
      .update(externalActions)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(
        eq(externalActions.id, actionId),
        eq(externalActions.weddingId, weddingId),
        eq(externalActions.status, 'draft'),
      ))
      .returning()
    if (!cancelled) return reply.status(409).send({ error: 'Only a draft action can be cancelled' })
    return reply.send(cancelled)
  })

  app.post('/internal/cron/reminders', async (req, reply) => {
    const secret = process.env['CRON_SECRET']
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const firedIds = await fireDueReminders()
    return reply.send({ fired: firedIds.length, triggerIds: firedIds })
  })

  app.post('/internal/cron/external-actions', async (req, reply) => {
    const secret = process.env['CRON_SECRET']
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    try {
      const provider = configuredEmailSendProvider()
      if (!provider) {
        return reply.status(503).send({
          error: 'Email sending is not configured',
          code: 'EMAIL_PROVIDER_NOT_CONFIGURED',
        })
      }
      const result = await new ExternalActionWorker(provider).runDue()
      return reply.send({
        processed: result.processed.length,
        actions: result.processed,
      })
    } catch (error) {
      const normalized = normalizedAgentError(error)
      req.log.error({ error: normalized }, 'External action worker failed')
      return reply.status(500).send({ error: normalized.message, ...normalized })
    }
  })
}
