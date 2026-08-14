import { verifyToken, createClerkClient } from '@clerk/backend'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { db } from '../db'
import {
  milestones,
  moduleCelebrations,
  modules,
  subModules,
  taskPhotos,
  tasks,
  users,
  weddings,
  weddingMembers,
} from '../db/schema'
import { and, eq } from 'drizzle-orm'

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
    .where(and(
      eq(weddingMembers.userId, userId),
      eq(weddingMembers.weddingId, weddingId),
    ))
    .limit(1)

  if (isMember.length === 0) {
    return reply.status(403).send({ error: 'Access denied' })
  }

  ;(req as any).wedding = wedding
}

async function resourceAccess(
  req: FastifyRequest,
  reply: FastifyReply,
  weddingId: string | null | undefined,
) {
  if (!weddingId) return reply.status(404).send({ error: 'Resource not found' })
  if (isDev) return
  const userId = (req as any).userId as string
  const [membership] = await db.select({ id: weddingMembers.id }).from(weddingMembers).where(and(
    eq(weddingMembers.weddingId, weddingId),
    eq(weddingMembers.userId, userId),
  )).limit(1)
  if (!membership) return reply.status(404).send({ error: 'Resource not found' })
}

export async function requireModuleAccess(req: FastifyRequest, reply: FastifyReply) {
  const { moduleId } = req.params as { moduleId: string }
  const [resource] = await db.select({ weddingId: modules.weddingId }).from(modules)
    .where(eq(modules.id, moduleId)).limit(1)
  return resourceAccess(req, reply, resource?.weddingId)
}

export async function requireSubModuleAccess(req: FastifyRequest, reply: FastifyReply) {
  const { subModuleId } = req.params as { subModuleId: string }
  const [resource] = await db.select({ weddingId: modules.weddingId }).from(subModules)
    .innerJoin(modules, eq(modules.id, subModules.moduleId))
    .where(eq(subModules.id, subModuleId)).limit(1)
  return resourceAccess(req, reply, resource?.weddingId)
}

export async function requireTaskAccess(req: FastifyRequest, reply: FastifyReply) {
  const { taskId } = req.params as { taskId: string }
  const [resource] = await db.select({ weddingId: tasks.weddingId }).from(tasks)
    .where(eq(tasks.id, taskId)).limit(1)
  return resourceAccess(req, reply, resource?.weddingId)
}

export async function requirePhotoAccess(req: FastifyRequest, reply: FastifyReply) {
  const { photoId } = req.params as { photoId: string }
  const [resource] = await db.select({ weddingId: tasks.weddingId }).from(taskPhotos)
    .innerJoin(tasks, eq(tasks.id, taskPhotos.taskId))
    .where(eq(taskPhotos.id, photoId)).limit(1)
  return resourceAccess(req, reply, resource?.weddingId)
}

export async function requireCelebrationAccess(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string }
  const [resource] = await db.select({ weddingId: moduleCelebrations.weddingId })
    .from(moduleCelebrations).where(eq(moduleCelebrations.id, id)).limit(1)
  return resourceAccess(req, reply, resource?.weddingId)
}

export async function requireMilestoneAccess(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string }
  const [resource] = await db.select({ weddingId: milestones.weddingId })
    .from(milestones).where(eq(milestones.id, id)).limit(1)
  return resourceAccess(req, reply, resource?.weddingId)
}
