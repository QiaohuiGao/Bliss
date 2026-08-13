import type { FastifyInstance } from 'fastify'
import { db } from '../db'
import { users, weddings, weddingMembers, modules, tasks } from '../db/schema'
import { eq, or, and, sql } from 'drizzle-orm'
import { requireAuth, requireWeddingAccess } from '../middleware/auth'
import { generateQuestsForWedding } from '../services/quest-generator'
import { z } from 'zod'
import { differenceInDays } from 'date-fns'
import crypto from 'crypto'

const CULTURES = [
  'south_asian', 'chinese', 'jewish', 'korean', 'nigerian', 'mexican',
  'persian', 'filipino', 'vietnamese', 'ethiopian', 'greek', 'italian',
  'polish', 'hmong', 'armenian', 'arab',
] as const

const onboardingSchema = z.object({
  weddingDate: z.string().optional(),
  // Two-letter USPS code. Required for marriage-license rules, which are state-level.
  state: z.string().length(2).toUpperCase().optional(),
  city: z.string().optional(),
  weddingType: z
    .enum(['traditional', 'micro', 'elopement', 'destination', 'courthouse'])
    .optional(),
  cultures: z.array(z.enum(CULTURES)).optional(),
  guestCountRange: z
    .enum(['under_50', '50_100', '100_150', '150_250', 'over_250'])
    .optional(),
  guestCountExact: z.number().int().min(1).max(5000).optional(),
  styles: z.array(z.string()).optional(),
  budgetTier: z.enum(['under_20k', '20k_40k', '40k_75k', 'over_75k']).optional(),
  budgetTotalCents: z.number().int().nonnegative().optional(),
  budgetMinCents: z.number().int().nonnegative().optional(),
  budgetMaxCents: z.number().int().nonnegative().optional(),
  venuePreferences: z.array(z.string()).optional(),
  hasPlanner: z.boolean().optional(),
  plannerType: z.enum(['full', 'partial', 'day_of', 'venue_only', 'none']).optional(),
  specialNeeds: z.array(z.string()).optional(),
})

export async function weddingRoutes(app: FastifyInstance) {
  app.post('/weddings', { preHandler: requireAuth }, async (req, reply) => {
    const userId = (req as any).userId as string
    const body = onboardingSchema.parse(req.body)

    const existing = await db
      .select()
      .from(weddingMembers)
      .where(eq(weddingMembers.userId, userId))
      .limit(1)

    if (existing.length > 0) {
      return reply.status(409).send({ error: 'User already has a wedding' })
    }

    const [wedding] = await db
      .insert(weddings)
      .values({
        weddingDate: body.weddingDate ?? null,
        state: body.state ?? null,
        city: body.city ?? null,
        currency: 'USD',
        weddingType: body.weddingType ?? 'traditional',
        cultures: body.cultures ?? [],
        guestCountRange: body.guestCountRange ?? null,
        guestCountExact: body.guestCountExact ?? null,
        styles: body.styles ?? [],
        budgetTier: body.budgetTier ?? null,
        budgetTotalCents: body.budgetTotalCents ?? null,
        budgetMinCents: body.budgetMinCents ?? null,
        budgetMaxCents: body.budgetMaxCents ?? null,
        venuePreferences: body.venuePreferences ?? [],
        hasPlanner: body.hasPlanner ?? false,
        plannerType: body.plannerType ?? 'none',
        specialNeeds: body.specialNeeds ?? [],
        inviteToken: crypto.randomBytes(32).toString('hex'),
      })
      .returning()

    await db.insert(weddingMembers).values({
      weddingId: wedding!.id,
      userId,
      role: 'owner',
    })

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

    await generateQuestsForWedding(wedding!.id, {
      ...body,
      locale: user?.locale ?? 'en',
    })

    return reply.status(201).send(wedding)
  })

  app.get('/weddings/:weddingId', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    return reply.send((req as any).wedding)
  })

  app.patch('/weddings/:weddingId', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    const { weddingId } = req.params as any
    const body = onboardingSchema.partial().parse(req.body)

    const [updated] = await db
      .update(weddings)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(weddings.id, weddingId))
      .returning()

    return reply.send(updated)
  })

  app.get('/weddings/:weddingId/dashboard', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    const wedding = (req as any).wedding

    const allModules = await db
      .select()
      .from(modules)
      .where(eq(modules.weddingId, wedding.id))
      .orderBy(modules.sortOrder)

    const taskStats = await db
      .select({
        weddingId: tasks.weddingId,
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${tasks.status} = 'done')::int`,
      })
      .from(tasks)
      .where(eq(tasks.weddingId, wedding.id))
      .groupBy(tasks.weddingId)

    const stats = taskStats[0] ?? { total: 0, completed: 0 }
    const totalProgress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

    const daysRemaining = wedding.weddingDate
      ? differenceInDays(new Date(wedding.weddingDate), new Date())
      : null

    const todayTasks = await db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.weddingId, wedding.id),
        eq(tasks.status, 'todo'),
      ))
      .orderBy(tasks.dueDate, tasks.sortOrder)
      .limit(5)

    const activeModules = allModules.filter(m => m.status === 'active')

    const budgetResult = await db
      .select({
        spent: sql<number>`coalesce(sum(${tasks.costCents}), 0)::int`,
      })
      .from(tasks)
      .where(and(
        eq(tasks.weddingId, wedding.id),
        sql`${tasks.costCents} is not null`,
      ))

    return reply.send({
      wedding: {
        ...wedding,
        daysRemaining,
        totalProgress,
      },
      todayTasks,
      activeModules,
      budget: {
        totalBudgetCents: (wedding.budgetMaxCents ?? 0),
        spentCents: budgetResult[0]?.spent ?? 0,
      },
    })
  })

  app.post('/weddings/:weddingId/invite', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    const wedding = (req as any).wedding
    const { email } = req.body as { email: string }
    const inviteUrl = `${process.env['WEB_URL'] ?? 'http://localhost:3000'}/join?token=${wedding.inviteToken}`
    return reply.send({ inviteUrl })
  })

  app.post('/weddings/join', { preHandler: requireAuth }, async (req, reply) => {
    const userId = (req as any).userId as string
    const { token } = req.body as { token: string }

    const [wedding] = await db
      .select()
      .from(weddings)
      .where(eq(weddings.inviteToken, token))
      .limit(1)

    if (!wedding) {
      return reply.status(404).send({ error: 'Invalid or expired invite link' })
    }

    const existingMembers = await db
      .select()
      .from(weddingMembers)
      .where(eq(weddingMembers.weddingId, wedding.id))

    if (existingMembers.length >= 2) {
      return reply.status(409).send({ error: 'This wedding already has two partners' })
    }

    await db.insert(weddingMembers).values({
      weddingId: wedding.id,
      userId,
      role: 'partner',
    })

    const [updated] = await db
      .update(weddings)
      .set({ inviteToken: null, updatedAt: new Date() })
      .where(eq(weddings.id, wedding.id))
      .returning()

    return reply.send(updated)
  })

  app.get('/me/wedding', { preHandler: requireAuth }, async (req, reply) => {
    const userId = (req as any).userId as string

    const [membership] = await db
      .select()
      .from(weddingMembers)
      .where(eq(weddingMembers.userId, userId))
      .limit(1)

    if (!membership) {
      return reply.status(404).send({ error: 'No wedding found' })
    }

    const [wedding] = await db
      .select()
      .from(weddings)
      .where(eq(weddings.id, membership.weddingId))
      .limit(1)

    return reply.send(wedding)
  })
}
