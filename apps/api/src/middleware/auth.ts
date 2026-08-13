import { verifyToken, createClerkClient } from '@clerk/backend'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { db } from '../db'
import { users, weddings, weddingMembers } from '../db/schema'
import { eq } from 'drizzle-orm'

const isDev = process.env['NODE_ENV'] !== 'production'
const DEV_USER_ID = 'dev-user-001'
const DEV_CLERK_ID = 'dev_clerk_001'

const clerkClient = createClerkClient({ secretKey: process.env['CLERK_SECRET_KEY']! })

async function ensureDevUser(): Promise<string> {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, DEV_CLERK_ID))
    .limit(1)

  if (existing) return existing.id

  const [created] = await db
    .insert(users)
    .values({
      clerkId: DEV_CLERK_ID,
      email: 'dev@bliss.app',
      displayName: 'Dev User',
    })
    .onConflictDoNothing()
    .returning()

  return created!.id
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  // Dev mode: skip auth, use a dev user
  if (isDev) {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ') || authHeader === 'Bearer dev') {
      const userId = await ensureDevUser()
      ;(req as any).userId = userId
      ;(req as any).clerkId = DEV_CLERK_ID
      return
    }
  }

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

  // Dev mode: skip membership check
  if (isDev) {
    ;(req as any).wedding = wedding
    return
  }

  const isMember = await db
    .select()
    .from(weddingMembers)
    .where(eq(weddingMembers.userId, userId))
    .limit(1)

  if (isMember.length === 0 || isMember[0]!.weddingId !== weddingId) {
    return reply.status(403).send({ error: 'Access denied' })
  }

  ;(req as any).wedding = wedding
}
