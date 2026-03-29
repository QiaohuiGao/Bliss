import type { FastifyInstance } from 'fastify'
import { db } from '../db'
import { guests, weddings } from '../db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { requireAuth, requireWeddingAccess } from '../middleware/auth'
import { z } from 'zod'

const guestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  side: z.enum(['partner_a', 'partner_b', 'mutual']).default('mutual'),
  priority: z.enum(['must_invite', 'nice_to_have']).default('must_invite'),
  rsvpStatus: z.enum(['pending', 'yes', 'no']).default('pending'),
  dietaryNotes: z.string().optional().nullable(),
  plusOne: z.boolean().default(false),
})

export async function guestRoutes(app: FastifyInstance) {
  // Get all guests
  app.get('/weddings/:weddingId/guests', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    const { weddingId } = req.params as any
    const { side, rsvpStatus, priority } = req.query as any

    const conditions = [eq(guests.weddingId, weddingId)]
    if (side) conditions.push(eq(guests.side, side))
    if (rsvpStatus) conditions.push(eq(guests.rsvpStatus, rsvpStatus))
    if (priority) conditions.push(eq(guests.priority, priority))

    const guestList = await db
      .select()
      .from(guests)
      .where(and(...conditions))
      .orderBy(guests.side, guests.name)

    // Stats
    const stats = {
      total: guestList.length,
      confirmed: guestList.filter((g) => g.rsvpStatus === 'yes').length,
      declined: guestList.filter((g) => g.rsvpStatus === 'no').length,
      pending: guestList.filter((g) => g.rsvpStatus === 'pending').length,
      plusOnes: guestList.filter((g) => g.plusOne && g.rsvpStatus === 'yes').length,
    }

    return reply.send({ guests: guestList, stats })
  })

  // Add guest
  app.post('/weddings/:weddingId/guests', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    const { weddingId } = req.params as any
    const body = guestSchema.parse(req.body)

    const [guest] = await db
      .insert(guests)
      .values({ weddingId, ...body })
      .returning()

    return reply.status(201).send(guest)
  })

  // Bulk add guests
  app.post('/weddings/:weddingId/guests/bulk', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    const { weddingId } = req.params as any
    const { guests: guestList } = req.body as { guests: z.infer<typeof guestSchema>[] }

    const parsed = guestList.map((g) => guestSchema.parse(g))
    const inserted = await db
      .insert(guests)
      .values(parsed.map((g) => ({ weddingId, ...g })))
      .returning()

    return reply.status(201).send(inserted)
  })

  // Update guest
  app.patch('/guests/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as any
    const userId = (req as any).userId as string
    const body = guestSchema.partial().parse(req.body)

    const [guest] = await db.select().from(guests).where(eq(guests.id, id)).limit(1)
    if (!guest) return reply.status(404).send({ error: 'Guest not found' })

    const [wedding] = await db
      .select()
      .from(weddings)
      .where(eq(weddings.id, guest.weddingId))
      .limit(1)

    if (!wedding || (wedding.partnerAId !== userId && wedding.partnerBId !== userId)) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    const [updated] = await db
      .update(guests)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(guests.id, id))
      .returning()

    return reply.send(updated)
  })

  // Delete guest
  app.delete('/guests/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as any
    const userId = (req as any).userId as string

    const [guest] = await db.select().from(guests).where(eq(guests.id, id)).limit(1)
    if (!guest) return reply.status(404).send({ error: 'Not found' })

    const [wedding] = await db
      .select()
      .from(weddings)
      .where(eq(weddings.id, guest.weddingId))
      .limit(1)

    if (!wedding || (wedding.partnerAId !== userId && wedding.partnerBId !== userId)) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    await db.delete(guests).where(eq(guests.id, id))
    return reply.status(204).send()
  })
}
