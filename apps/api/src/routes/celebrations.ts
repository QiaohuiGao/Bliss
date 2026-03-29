import type { FastifyInstance } from 'fastify'
import { db } from '../db'
import { celebrations } from '../db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { requireAuth, requireWeddingAccess } from '../middleware/auth'
import celebrationContent from '../content/celebrations.json'

export async function celebrationRoutes(app: FastifyInstance) {
  // Get pending (unshown) celebrations
  app.get('/weddings/:weddingId/celebrations', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    const { weddingId } = req.params as any

    const pending = await db
      .select()
      .from(celebrations)
      .where(
        and(
          eq(celebrations.weddingId, weddingId),
          isNull(celebrations.shownAt)
        )
      )
      .orderBy(celebrations.createdAt)

    const enriched = pending.map((c) => ({
      ...c,
      content: (celebrationContent as Record<string, any>)[c.triggerKey] ?? null,
    }))

    return reply.send(enriched)
  })

  // Dismiss celebration (mark as shown)
  app.patch('/celebrations/:id/dismiss', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as any
    const userId = (req as any).userId as string

    const [updated] = await db
      .update(celebrations)
      .set({ shownAt: new Date() })
      .where(eq(celebrations.id, id))
      .returning()

    return reply.send(updated)
  })
}
