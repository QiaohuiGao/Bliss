import type { FastifyInstance } from 'fastify'
import { db } from '../db'
import { tasks, weddings, celebrations } from '../db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { requireAuth, requireWeddingAccess } from '../middleware/auth'
import celebrationContent from '../content/celebrations.json'

async function checkAndTriggerCelebration(weddingId: string, task: typeof tasks.$inferSelect) {
  // Milestone celebration
  if (task.celebrationTrigger && task.status === 'complete') {
    await db.insert(celebrations).values({
      weddingId,
      triggerKey: task.celebrationTrigger,
    }).onConflictDoNothing()
  }

  // Batch of 3 celebration
  const recentlyCompleted = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.weddingId, weddingId),
        eq(tasks.stage, task.stage),
        eq(tasks.status, 'complete')
      )
    )

  if (recentlyCompleted.length > 0 && recentlyCompleted.length % 3 === 0) {
    await db.insert(celebrations).values({
      weddingId,
      triggerKey: 'task_batch_3',
    })
  }
}

async function checkStageUnlock(weddingId: string, stage: number) {
  const [wedding] = await db
    .select()
    .from(weddings)
    .where(eq(weddings.id, weddingId))
    .limit(1)

  if (!wedding || wedding.currentStage !== stage) return

  // Check all deliverables in current stage are complete
  const deliverables = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.weddingId, weddingId),
        eq(tasks.stage, stage),
        eq(tasks.isDeliverable, true)
      )
    )

  const allComplete = deliverables.length > 0 && deliverables.every((t) => t.status === 'complete')

  if (allComplete && stage < 7) {
    await db
      .update(weddings)
      .set({ currentStage: stage + 1, updatedAt: new Date() })
      .where(eq(weddings.id, weddingId))

    // Stage complete celebration
    await db.insert(celebrations).values({
      weddingId,
      triggerKey: `stage_${stage}_complete` as any,
    })
  }
}

export async function taskRoutes(app: FastifyInstance) {
  // Get all tasks for a wedding (optionally filtered by stage)
  app.get('/weddings/:weddingId/tasks', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    const { weddingId } = req.params as any
    const { stage, status } = req.query as any

    let query = db
      .select()
      .from(tasks)
      .where(eq(tasks.weddingId, weddingId))
      .$dynamic()

    const conditions = [eq(tasks.weddingId, weddingId)]
    if (stage) conditions.push(eq(tasks.stage, parseInt(stage)))
    if (status) conditions.push(eq(tasks.status, status))

    const result = await db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(asc(tasks.stage), asc(tasks.sortOrder))

    return reply.send(result)
  })

  // Get a single task
  app.get('/tasks/:taskId', { preHandler: requireAuth }, async (req, reply) => {
    const { taskId } = req.params as any
    const userId = (req as any).userId as string

    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1)
    if (!task) return reply.status(404).send({ error: 'Task not found' })

    // Verify access via wedding
    const [wedding] = await db
      .select()
      .from(weddings)
      .where(eq(weddings.id, task.weddingId))
      .limit(1)

    if (!wedding || (wedding.partnerAId !== userId && wedding.partnerBId !== userId)) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    return reply.send(task)
  })

  // Update task status
  app.patch('/tasks/:taskId', { preHandler: requireAuth }, async (req, reply) => {
    const { taskId } = req.params as any
    const userId = (req as any).userId as string
    const { status, assignedTo } = req.body as { status?: string; assignedTo?: string }

    const [existing] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1)
    if (!existing) return reply.status(404).send({ error: 'Task not found' })

    // Verify access
    const [wedding] = await db
      .select()
      .from(weddings)
      .where(eq(weddings.id, existing.weddingId))
      .limit(1)

    if (!wedding || (wedding.partnerAId !== userId && wedding.partnerBId !== userId)) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    const updates: Partial<typeof tasks.$inferInsert> = {}
    if (status) {
      updates.status = status as any
      if (status === 'complete') {
        updates.completedAt = new Date()
      } else {
        updates.completedAt = null
      }
    }
    if (assignedTo !== undefined) updates.assignedTo = assignedTo

    const [updated] = await db
      .update(tasks)
      .set(updates)
      .where(eq(tasks.id, taskId))
      .returning()

    // Trigger celebration and stage unlock checks
    if (status === 'complete') {
      await checkAndTriggerCelebration(existing.weddingId, updated!)
      await checkStageUnlock(existing.weddingId, existing.stage)
    }

    return reply.send(updated)
  })

  // Get stage overview (all 7 stages with task counts)
  app.get('/weddings/:weddingId/stages', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    const { weddingId } = req.params as any
    const wedding = (req as any).wedding

    const allTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.weddingId, weddingId))
      .orderBy(asc(tasks.stage), asc(tasks.sortOrder))

    const STAGE_META = [
      { stage: 1, title: 'Foundation', timeframe: '12–18 months out' },
      { stage: 2, title: 'Venue & Date', timeframe: '12–14 months out' },
      { stage: 3, title: 'Core Vendors', timeframe: '10–12 months out' },
      { stage: 4, title: 'Guests & Logistics', timeframe: '6–9 months out' },
      { stage: 5, title: 'Details & Design', timeframe: '3–6 months out' },
      { stage: 6, title: 'Final Countdown', timeframe: '1–4 weeks out' },
      { stage: 7, title: 'Post-Wedding', timeframe: 'Week after' },
    ]

    const stages = STAGE_META.map(({ stage, title, timeframe }) => {
      const stageTasks = allTasks.filter((t) => t.stage === stage)
      const deliverables = stageTasks.filter((t) => t.isDeliverable)
      return {
        stage,
        title,
        timeframe,
        isUnlocked: stage <= wedding.currentStage,
        isComplete: stage < wedding.currentStage,
        tasks: stageTasks,
        completedDeliverables: deliverables.filter((t) => t.status === 'complete').length,
        totalDeliverables: deliverables.length,
        completedTasks: stageTasks.filter((t) => t.status === 'complete').length,
        totalTasks: stageTasks.length,
      }
    })

    return reply.send(stages)
  })
}
