import type { FastifyInstance } from 'fastify'
import { db } from '../db'
import { moduleCelebrations, milestones } from '../db/schema'
import { eq, sql } from 'drizzle-orm'
import { requireAuth, requireWeddingAccess } from '../middleware/auth'

export async function celebrationRoutes(app: FastifyInstance) {
  app.get('/weddings/:weddingId/celebrations/pending', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    const wedding = (req as any).wedding

    const pending = await db
      .select()
      .from(moduleCelebrations)
      .where(
        sql`${moduleCelebrations.weddingId} = ${wedding.id} and ${moduleCelebrations.shownAt} is null`
      )
      .orderBy(moduleCelebrations.completedAt)

    return reply.send(pending)
  })

  app.patch('/celebrations/:id/dismiss', {
    preHandler: [requireAuth]
  }, async (req, reply) => {
    const { id } = req.params as any

    const [updated] = await db
      .update(moduleCelebrations)
      .set({ shownAt: new Date() })
      .where(eq(moduleCelebrations.id, id))
      .returning()

    return reply.send(updated)
  })

  app.get('/weddings/:weddingId/milestones/pending', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    const wedding = (req as any).wedding

    const pending = await db
      .select()
      .from(milestones)
      .where(
        sql`${milestones.weddingId} = ${wedding.id} and ${milestones.shownAt} is null`
      )
      .orderBy(milestones.triggeredAt)

    return reply.send(pending)
  })

  app.patch('/milestones/:id/dismiss', {
    preHandler: [requireAuth]
  }, async (req, reply) => {
    const { id } = req.params as any

    const [updated] = await db
      .update(milestones)
      .set({ shownAt: new Date() })
      .where(eq(milestones.id, id))
      .returning()

    return reply.send(updated)
  })
}
