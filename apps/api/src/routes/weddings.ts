import type { FastifyInstance } from 'fastify'
import { db } from '../db'
import { users, weddings, tasks, budgetItems, celebrations } from '../db/schema'
import { eq, or, and, sql } from 'drizzle-orm'
import { requireAuth, requireWeddingAccess } from '../middleware/auth'
import { generateTasksForWedding } from '../db/seed'
import { z } from 'zod'
import { differenceInDays } from 'date-fns'
import crypto from 'crypto'
import sgMail from '@sendgrid/mail'
import type { OnboardingPayload } from '@bliss/types'

const onboardingSchema = z.object({
  vibeTags: z.array(z.string()).min(1),
  priorityTags: z.array(z.string()).min(1),
  guestCountMode: z.enum(['micro', 'intimate', 'classic', 'grand']),
  planningStyle: z.enum(['full_diy', 'mixed', 'vendor_led', 'full_service']),
  timelineMode: z.enum(['fast', 'medium', 'comfortable', 'relaxed']),
  locationMode: z.enum(['urban', 'suburban', 'rural']),
  weddingDate: z.string().optional(),
  partnerAName: z.string().optional(),
  partnerBName: z.string().optional(),
})

export async function weddingRoutes(app: FastifyInstance) {
  // Create wedding (onboarding completion)
  app.post('/weddings', { preHandler: requireAuth }, async (req, reply) => {
    const userId = (req as any).userId as string
    const body = onboardingSchema.parse(req.body)

    // Check if user already has a wedding
    const existing = await db
      .select()
      .from(weddings)
      .where(or(eq(weddings.partnerAId, userId), eq(weddings.partnerBId, userId)))
      .limit(1)

    if (existing.length > 0) {
      return reply.status(409).send({ error: 'User already has a wedding' })
    }

    const [wedding] = await db
      .insert(weddings)
      .values({
        partnerAId: userId,
        guestCountMode: body.guestCountMode,
        planningStyle: body.planningStyle,
        timelineMode: body.timelineMode,
        locationMode: body.locationMode,
        vibeTags: body.vibeTags,
        priorityTags: body.priorityTags,
        weddingDate: body.weddingDate ? new Date(body.weddingDate) : null,
        partnerAName: body.partnerAName ?? null,
        partnerBName: body.partnerBName ?? null,
        inviteToken: crypto.randomBytes(32).toString('hex'),
      })
      .returning()

    await generateTasksForWedding(wedding!.id, body.planningStyle)

    return reply.status(201).send(wedding)
  })

  // Get wedding
  app.get('/weddings/:weddingId', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    return reply.send((req as any).wedding)
  })

  // Update wedding
  app.patch('/weddings/:weddingId', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    const { weddingId } = req.params as any
    const updates = req.body as Partial<OnboardingPayload>

    const [updated] = await db
      .update(weddings)
      .set({
        ...updates,
        weddingDate: updates.weddingDate ? new Date(updates.weddingDate) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(weddings.id, weddingId))
      .returning()

    return reply.send(updated)
  })

  // Dashboard
  app.get('/weddings/:weddingId/dashboard', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    const wedding = (req as any).wedding
    const userId = (req as any).userId as string

    const [partnerA] = await db
      .select()
      .from(users)
      .where(eq(users.id, wedding.partnerAId))
      .limit(1)

    const partnerB = wedding.partnerBId
      ? (await db.select().from(users).where(eq(users.id, wedding.partnerBId)).limit(1))[0] ?? null
      : null

    // Next 3 pending tasks in current stage
    const nextTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.weddingId, wedding.id),
          eq(tasks.stage, wedding.currentStage),
          eq(tasks.status, 'pending')
        )
      )
      .orderBy(tasks.sortOrder)
      .limit(3)

    // Stage progress
    const stageData = await db
      .select({
        stage: tasks.stage,
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where status = 'complete')::int`,
        deliverableTotal: sql<number>`count(*) filter (where is_deliverable = true)::int`,
        deliverableCompleted: sql<number>`count(*) filter (where is_deliverable = true and status = 'complete')::int`,
      })
      .from(tasks)
      .where(eq(tasks.weddingId, wedding.id))
      .groupBy(tasks.stage)
      .orderBy(tasks.stage)

    const STAGE_TITLES = [
      '', 'Foundation', 'Venue & Date', 'Core Vendors',
      'Guests & Logistics', 'Details & Design', 'Final Countdown', 'Post-Wedding'
    ]

    const stageProgress = Array.from({ length: 7 }, (_, i) => {
      const s = i + 1
      const data = stageData.find((d) => d.stage === s)
      return {
        stage: s,
        title: STAGE_TITLES[s]!,
        completedDeliverables: data?.deliverableCompleted ?? 0,
        totalDeliverables: data?.deliverableTotal ?? 0,
        isUnlocked: s <= wedding.currentStage,
        isComplete: s < wedding.currentStage,
      }
    })

    // Days until wedding
    const daysUntilWedding = wedding.weddingDate
      ? differenceInDays(new Date(wedding.weddingDate), new Date())
      : null

    // Budget snapshot (only after stage 2)
    let budgetSnapshot = null
    if (wedding.currentStage >= 2) {
      const [budget] = await db
        .select({
          totalEstimated: sql<number>`coalesce(sum(estimated_cents), 0)::int`,
          totalActual: sql<number>`coalesce(sum(actual_cents), 0)::int`,
        })
        .from(budgetItems)
        .where(eq(budgetItems.weddingId, wedding.id))

      budgetSnapshot = {
        totalEstimatedCents: budget?.totalEstimated ?? 0,
        totalActualCents: budget?.totalActual ?? 0,
      }
    }

    // Pending celebration
    const [pendingCelebration] = await db
      .select()
      .from(celebrations)
      .where(
        and(
          eq(celebrations.weddingId, wedding.id),
          sql`shown_at is null`
        )
      )
      .orderBy(celebrations.createdAt)
      .limit(1)

    // Stress check-in due (weekly)
    const [lastCheckIn] = await db
      .select()
      .from(celebrations) // reusing pattern; actually from stressCheckIns
      .limit(1)

    const stressCheckInDue = true // simplified for now — computed in service

    return reply.send({
      wedding,
      partnerA,
      partnerB,
      nextTasks,
      stageProgress,
      daysUntilWedding,
      budgetSnapshot,
      pendingCelebration: pendingCelebration ?? null,
      stressCheckInDue,
    })
  })

  // Invite partner
  app.post('/weddings/:weddingId/invite', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    const wedding = (req as any).wedding
    const { email, partnerName } = req.body as { email: string; partnerName: string }

    const inviteUrl = `${process.env['WEB_URL']}/join?token=${wedding.inviteToken}`

    sgMail.setApiKey(process.env['SENDGRID_API_KEY']!)
    await sgMail.send({
      to: email,
      from: process.env['SENDGRID_FROM_EMAIL']!,
      subject: `${wedding.partnerAName ?? 'Your partner'} invited you to plan your wedding on Bliss`,
      html: `
        <p>Hi ${partnerName},</p>
        <p>${wedding.partnerAName ?? 'Your partner'} has started planning your wedding on Bliss — a calm, step-by-step wedding planning app.</p>
        <p><a href="${inviteUrl}">Join their wedding plan →</a></p>
        <p>Bliss guides you through every stage of planning, one clear step at a time.</p>
      `,
    })

    return reply.send({ sent: true })
  })

  // Join via invite token
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

    if (wedding.partnerBId) {
      return reply.status(409).send({ error: 'This wedding already has two partners' })
    }

    const [updated] = await db
      .update(weddings)
      .set({ partnerBId: userId, inviteToken: null, updatedAt: new Date() })
      .where(eq(weddings.id, wedding.id))
      .returning()

    return reply.send(updated)
  })

  // My wedding (helper for frontend)
  app.get('/me/wedding', { preHandler: requireAuth }, async (req, reply) => {
    const userId = (req as any).userId as string

    const [wedding] = await db
      .select()
      .from(weddings)
      .where(or(eq(weddings.partnerAId, userId), eq(weddings.partnerBId, userId)))
      .limit(1)

    if (!wedding) {
      return reply.status(404).send({ error: 'No wedding found' })
    }

    return reply.send(wedding)
  })
}
