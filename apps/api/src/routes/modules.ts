import type { FastifyInstance } from 'fastify'
import { db } from '../db'
import { modules, subModules, tasks, taskPhotos, moduleCelebrations } from '../db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { requireAuth, requireModuleAccess, requireWeddingAccess } from '../middleware/auth'
import { differenceInDays } from 'date-fns'

export async function moduleRoutes(app: FastifyInstance) {
  // Get all modules for a wedding (master board)
  app.get('/weddings/:weddingId/modules', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    const wedding = (req as any).wedding

    const allModules = await db
      .select()
      .from(modules)
      .where(eq(modules.weddingId, wedding.id))
      .orderBy(modules.sortOrder)

    const moduleProgress = await db
      .select({
        subModuleId: tasks.subModuleId,
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${tasks.status} = 'done')::int`,
      })
      .from(tasks)
      .where(eq(tasks.weddingId, wedding.id))
      .groupBy(tasks.subModuleId)

    const subModuleToModule = await db
      .select({ id: subModules.id, moduleId: subModules.moduleId })
      .from(subModules)
      .where(
        sql`${subModules.moduleId} in (select id from modules where wedding_id = ${wedding.id})`
      )

    const smMap = new Map(subModuleToModule.map(sm => [sm.id, sm.moduleId]))

    const moduleStats = new Map<string, { total: number; completed: number }>()
    for (const row of moduleProgress) {
      const modId = smMap.get(row.subModuleId)
      if (!modId) continue
      const existing = moduleStats.get(modId) ?? { total: 0, completed: 0 }
      existing.total += row.total
      existing.completed += row.completed
      moduleStats.set(modId, existing)
    }

    const subModuleCounts = new Map<string, number>()
    for (const sm of subModuleToModule) {
      subModuleCounts.set(sm.moduleId, (subModuleCounts.get(sm.moduleId) ?? 0) + 1)
    }

    const totalTasks = Array.from(moduleStats.values()).reduce((s, v) => s + v.total, 0)
    const totalCompleted = Array.from(moduleStats.values()).reduce((s, v) => s + v.completed, 0)
    const totalProgress = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0

    const daysRemaining = wedding.weddingDate
      ? differenceInDays(new Date(wedding.weddingDate), new Date())
      : null

    const modulesWithProgress = allModules.map(m => {
      const stats = moduleStats.get(m.id) ?? { total: 0, completed: 0 }
      return {
        ...m,
        progress: {
          total: stats.total,
          completed: stats.completed,
          percentage: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
        },
        subModuleCount: subModuleCounts.get(m.id) ?? 0,
      }
    })

    return reply.send({
      totalProgress,
      daysRemaining,
      modules: modulesWithProgress,
    })
  })

  // Get module detail
  app.get('/modules/:moduleId', {
    preHandler: [requireAuth, requireModuleAccess]
  }, async (req, reply) => {
    const { moduleId } = req.params as any

    const [mod] = await db
      .select()
      .from(modules)
      .where(eq(modules.id, moduleId))
      .limit(1)

    if (!mod) return reply.status(404).send({ error: 'Module not found' })

    const subs = await db
      .select()
      .from(subModules)
      .where(eq(subModules.moduleId, moduleId))
      .orderBy(subModules.sortOrder)

    const allTasks = await db
      .select()
      .from(tasks)
      .where(sql`${tasks.subModuleId} in (select id from sub_modules where module_id = ${moduleId})`)
      .orderBy(tasks.sortOrder)

    const photoCounts = await db
      .select({
        taskId: taskPhotos.taskId,
        count: sql<number>`count(*)::int`,
      })
      .from(taskPhotos)
      .where(sql`${taskPhotos.taskId} in (select id from tasks where sub_module_id in (select id from sub_modules where module_id = ${moduleId}))`)
      .groupBy(taskPhotos.taskId)

    const photoMap = new Map(photoCounts.map(p => [p.taskId, p.count]))

    const tasksBySubModule = new Map<string, typeof allTasks>()
    for (const t of allTasks) {
      const list = tasksBySubModule.get(t.subModuleId) ?? []
      list.push(t)
      tasksBySubModule.set(t.subModuleId, list)
    }

    const totalTasks = allTasks.length
    const completedTasks = allTasks.filter(t => t.status === 'done').length

    const [celebration] = await db
      .select()
      .from(moduleCelebrations)
      .where(eq(moduleCelebrations.moduleId, moduleId))
      .limit(1)

    return reply.send({
      ...mod,
      progress: {
        total: totalTasks,
        completed: completedTasks,
        percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      },
      celebration: celebration ?? null,
      subModules: subs.map(s => ({
        ...s,
        tasks: (tasksBySubModule.get(s.id) ?? []).map(t => ({
          ...t,
          photoCount: photoMap.get(t.id) ?? 0,
        })),
      })),
    })
  })

  // Update module (deadline, status, order)
  app.patch('/modules/:moduleId', {
    preHandler: [requireAuth, requireModuleAccess]
  }, async (req, reply) => {
    const { moduleId } = req.params as any
    const body = req.body as any

    const updates: Record<string, any> = {}
    if (body.userDeadline !== undefined) updates.userDeadline = body.userDeadline
    if (body.estimatedDays !== undefined) updates.estimatedDays = body.estimatedDays
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder
    if (body.status !== undefined) updates.status = body.status

    const [updated] = await db
      .update(modules)
      .set(updates)
      .where(eq(modules.id, moduleId))
      .returning()

    return reply.send(updated)
  })

  // Unlock module manually
  app.patch('/modules/:moduleId/unlock', {
    preHandler: [requireAuth, requireModuleAccess]
  }, async (req, reply) => {
    const { moduleId } = req.params as any

    const [updated] = await db
      .update(modules)
      .set({ status: 'active', actualStartedAt: new Date() })
      .where(eq(modules.id, moduleId))
      .returning()

    return reply.send(updated)
  })

  // Start module
  app.patch('/modules/:moduleId/start', {
    preHandler: [requireAuth, requireModuleAccess]
  }, async (req, reply) => {
    const { moduleId } = req.params as any

    const [updated] = await db
      .update(modules)
      .set({ status: 'active', actualStartedAt: new Date() })
      .where(eq(modules.id, moduleId))
      .returning()

    return reply.send(updated)
  })

  // Create custom module
  app.post('/weddings/:weddingId/modules', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    const wedding = (req as any).wedding
    const body = req.body as any

    const maxOrder = await db
      .select({ max: sql<number>`coalesce(max(${modules.sortOrder}), 0)::int` })
      .from(modules)
      .where(eq(modules.weddingId, wedding.id))

    const [mod] = await db
      .insert(modules)
      .values({
        weddingId: wedding.id,
        title: body.title,
        subtitle: body.subtitle ?? null,
        sortOrder: (maxOrder[0]?.max ?? 0) + 1,
        status: 'active',
        isCustom: true,
        estimatedDays: body.estimatedDays ?? null,
        userDeadline: body.userDeadline ?? null,
      })
      .returning()

    return reply.status(201).send(mod)
  })

  // Delete module
  app.delete('/modules/:moduleId', {
    preHandler: [requireAuth, requireModuleAccess]
  }, async (req, reply) => {
    const { moduleId } = req.params as any
    await db.delete(modules).where(eq(modules.id, moduleId))
    return reply.status(204).send()
  })
}
