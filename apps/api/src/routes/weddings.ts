import type { FastifyInstance } from 'fastify'
import { db } from '../db'
import { users, weddings, weddingMembers, modules, tasks, activityFeed, scheduleIssues, memoryClaims } from '../db/schema'
import { eq, or, and, sql, desc } from 'drizzle-orm'
import { requireAuth, requireWeddingAccess } from '../middleware/auth'
import { generateQuestsForWedding } from '../services/quest-generator'
import { z } from 'zod'
import { differenceInDays } from 'date-fns'
import crypto from 'crypto'
import { recomputeWeddingSchedule } from '../services/schedule-store'
import { createPartnerInvite, joinWeddingByInvite } from '../services/couple-workspace'

const CULTURES = [
  'south_asian', 'chinese', 'jewish', 'korean', 'nigerian', 'mexican',
  'persian', 'filipino', 'vietnamese', 'ethiopian', 'greek', 'italian',
  'polish', 'hmong', 'armenian', 'arab',
] as const

const onboardingSchema = z.object({
  ownerDisplayName: z.string().trim().min(1).max(100).optional(),
  partnerDisplayName: z.string().trim().min(1).max(100).optional(),
  engagementDate: z.string().date().optional(),
  weddingTiming: z.enum(['date', 'season', 'open']).optional(),
  intakeClaims: z.array(z.object({
    key: z.enum(['feeling', 'date_horizon', 'place', 'guest_shape', 'support_style']),
    kind: z.enum(['fact', 'preference', 'priority']),
    value: z.string().trim().min(1).max(2_000),
  }).strict()).max(5).optional(),
  weddingDate: z.string().optional(),
  // Two-letter USPS code. Required for marriage-license rules, which are state-level.
  state: z.string().length(2).toUpperCase().optional(),
  city: z.string().optional(),
  weddingType: z
    .enum(['traditional', 'micro', 'elopement', 'destination', 'courthouse'])
    .optional(),
  weeklyCapacityHours: z.number().int().min(1).max(40).optional(),
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
        engagementDate: body.engagementDate ?? null,
        partnerDisplayName: body.partnerDisplayName ?? null,
        weddingTiming: body.weddingTiming ?? null,
        state: body.state ?? null,
        city: body.city ?? null,
        currency: 'USD',
        weddingType: body.weddingType ?? 'traditional',
        weeklyCapacityHours: body.weeklyCapacityHours ?? 5,
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

    if (body.ownerDisplayName) {
      await db.update(users).set({
        displayName: body.ownerDisplayName,
        updatedAt: new Date(),
      }).where(eq(users.id, userId))
    }

    if (body.intakeClaims?.length) {
      await db.insert(memoryClaims).values(body.intakeClaims.map(claim => ({
        weddingId: wedding!.id,
        decisionId: null,
        subjectType: 'couple' as const,
        subjectId: null,
        kind: claim.kind,
        key: `intake.${claim.key}`,
        value: claim.value,
        source: 'explicit' as const,
        confidenceBasisPoints: 10_000,
        status: 'confirmed' as const,
        evidenceMessageIds: [],
        createdBy: userId,
        supersedesId: null,
      })))
    }

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
    const { ownerDisplayName, intakeClaims: _intakeClaims, ...weddingPatch } = body

    if (ownerDisplayName) {
      const userId = (req as any).userId as string
      await db.update(users).set({ displayName: ownerDisplayName, updatedAt: new Date() })
        .where(eq(users.id, userId))
    }

    const [updated] = await db
      .update(weddings)
      .set({ ...weddingPatch, updatedAt: new Date() })
      .where(eq(weddings.id, weddingId))
      .returning()

    if (body.weddingDate !== undefined || body.weeklyCapacityHours !== undefined) {
      await recomputeWeddingSchedule(weddingId)
    }

    return reply.send(updated)
  })

  app.get('/weddings/:weddingId/dashboard', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    const wedding = (req as any).wedding
    const userId = (req as any).userId as string

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
      .orderBy(tasks.slackDays, tasks.plannedWeekStart, tasks.dueDate, tasks.sortOrder)
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

    const reminders = await db
      .select()
      .from(activityFeed)
      .where(and(
        eq(activityFeed.weddingId, wedding.id),
        eq(activityFeed.action, 'reminder_due'),
      ))
      .orderBy(desc(activityFeed.createdAt))
      .limit(3)

    const allScheduleIssues = await db.select({
      id: scheduleIssues.id,
      weddingId: scheduleIssues.weddingId,
      type: scheduleIssues.type,
      severity: scheduleIssues.severity,
      taskId: scheduleIssues.taskId,
      decisionId: scheduleIssues.decisionId,
      questKey: scheduleIssues.questKey,
      weekStart: scheduleIssues.weekStart,
      slackDays: scheduleIssues.slackDays,
      overloadMinutes: scheduleIssues.overloadMinutes,
      createdAt: scheduleIssues.createdAt,
      taskTitle: tasks.title,
    }).from(scheduleIssues)
      .leftJoin(tasks, eq(tasks.id, scheduleIssues.taskId))
      .where(eq(scheduleIssues.weddingId, wedding.id))
      .orderBy(scheduleIssues.severity, scheduleIssues.slackDays)
    const issues = allScheduleIssues.slice(0, 5)

    const memberRows = await db
      .select({
        id: weddingMembers.id,
        weddingId: weddingMembers.weddingId,
        userId: weddingMembers.userId,
        role: weddingMembers.role,
        joinedAt: weddingMembers.joinedAt,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(weddingMembers)
      .innerJoin(users, eq(users.id, weddingMembers.userId))
      .where(eq(weddingMembers.weddingId, wedding.id))
      .orderBy(weddingMembers.joinedAt)
    const currentMembership = memberRows.find(member => member.userId === userId)

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
      reminders,
      schedule: {
        blockingCount: allScheduleIssues.filter(issue => issue.severity === 'blocking').length,
        warningCount: allScheduleIssues.filter(issue => issue.severity === 'warning').length,
        issues,
      },
      couple: {
        members: memberRows.map(member => ({
          ...member,
          isCurrentUser: member.userId === userId,
        })),
        canInvitePartner: currentMembership?.role === 'owner' && memberRows.length < 2,
      },
    })
  })

  app.post('/weddings/:weddingId/invite', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    const userId = (req as any).userId as string
    const wedding = (req as any).wedding
    const result = await createPartnerInvite({
      weddingId: wedding.id,
      userId,
      webUrl: process.env['WEB_URL'] ?? 'http://localhost:3000',
    })
    if (result.status === 'forbidden') {
      return reply.status(403).send({ error: 'Only the wedding owner can invite a partner' })
    }
    if (result.status === 'full') {
      return reply.status(409).send({ error: 'This wedding already has two partners' })
    }
    return reply.send({ inviteUrl: result.inviteUrl })
  })

  app.post('/weddings/join', { preHandler: requireAuth }, async (req, reply) => {
    const userId = (req as any).userId as string
    const body = z.object({ token: z.string().trim().min(32).max(256) }).safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid or expired invite link' })
    }

    try {
      const result = await joinWeddingByInvite({ userId, token: body.data.token })

      if (result.status === 'invalid') {
        return reply.status(404).send({ error: 'Invalid or expired invite link' })
      }
      if (result.status === 'already_has_wedding') {
        return reply.status(409).send({ error: 'You already belong to a wedding plan' })
      }
      if (result.status === 'full') {
        return reply.status(409).send({ error: 'This wedding already has two partners' })
      }
      return reply.send(result.wedding)
    } catch (error) {
      req.log.error({ error }, 'Partner join failed')
      return reply.status(409).send({ error: 'This invite could not be used' })
    }
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
