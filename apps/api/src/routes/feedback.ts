import type { FastifyInstance } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { agentFeedback, agentRuns } from '../db/schema'
import { requireAuth, requireWeddingAccess } from '../middleware/auth'

const feedbackSchema = z.object({
  runId: z.string().uuid(),
  dimension: z.enum(['understood_us', 'represented_both', 'reduced_pressure']),
  rating: z.union([z.literal(-1), z.literal(1)]),
}).strict()

export async function feedbackRoutes(app: FastifyInstance) {
  const access = { preHandler: [requireAuth, requireWeddingAccess] }

  app.post('/weddings/:weddingId/agent-feedback', access, async (req, reply) => {
    const { weddingId } = req.params as { weddingId: string }
    const userId = (req as any).userId as string
    const body = feedbackSchema.parse(req.body)
    const [run] = await db.select({ id: agentRuns.id }).from(agentRuns).where(and(
      eq(agentRuns.id, body.runId),
      eq(agentRuns.weddingId, weddingId),
    )).limit(1)
    if (!run) return reply.status(404).send({ error: 'Agent run not found' })

    const [saved] = await db.insert(agentFeedback).values({
      weddingId,
      runId: body.runId,
      userId,
      dimension: body.dimension,
      rating: body.rating,
    }).onConflictDoUpdate({
      target: [agentFeedback.runId, agentFeedback.userId, agentFeedback.dimension],
      set: { rating: body.rating, updatedAt: new Date() },
    }).returning()
    return reply.send(saved)
  })
}
