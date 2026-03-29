import { verifyToken, createClerkClient } from '@clerk/backend'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { db } from '../db'
import { users, weddings } from '../db/schema'
import { eq, or } from 'drizzle-orm'

const clerkClient = createClerkClient({ secretKey: process.env['CLERK_SECRET_KEY']! })

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  const token = authHeader.slice(7)
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env['CLERK_SECRET_KEY']!,
    })
    const clerkId = payload.sub

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1)

    if (!user) {
      // Auto-create user on first authenticated request (webhook may not have fired in dev)
      const clerkUser = await clerkClient.users.getUser(clerkId)
      const email = clerkUser.emailAddresses[0]?.emailAddress ?? ''
      const displayName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null
      const [newUser] = await db
        .insert(users)
        .values({ clerkId, email, displayName })
        .onConflictDoNothing()
        .returning()
      if (!newUser) return reply.status(401).send({ error: 'User not found' })
      ;(req as any).userId = newUser.id
      ;(req as any).clerkId = clerkId
      return
    }

    ;(req as any).userId = user.id
    ;(req as any).clerkId = clerkId
  } catch {
    return reply.status(401).send({ error: 'Invalid token' })
  }
}

export async function requireWeddingAccess(req: FastifyRequest, reply: FastifyReply) {
  const userId = (req as any).userId as string
  const weddingId = (req.params as any).weddingId as string

  if (!weddingId) return

  const [wedding] = await db
    .select()
    .from(weddings)
    .where(eq(weddings.id, weddingId))
    .limit(1)

  if (!wedding) {
    return reply.status(404).send({ error: 'Wedding not found' })
  }

  if (wedding.partnerAId !== userId && wedding.partnerBId !== userId) {
    return reply.status(403).send({ error: 'Access denied' })
  }

  ;(req as any).wedding = wedding
}
