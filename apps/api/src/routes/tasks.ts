import type { FastifyInstance } from 'fastify'
import { db } from '../db'
import { tasks, taskPhotos, taskVendors, subModules, modules, moduleCelebrations } from '../db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth'
import { differenceInDays } from 'date-fns'

async function checkModuleCompletion(moduleId: string) {
  const allTasks = await db
    .select({ status: tasks.status, isOptional: tasks.isOptional })
    .from(tasks)
    .where(
      sql`${tasks.subModuleId} in (select id from sub_modules where module_id = ${moduleId})`
    )

  const requiredTasks = allTasks.filter(t => !t.isOptional)
  const allRequiredDone = requiredTasks.every(t => t.status === 'done' || t.status === 'skipped')

  if (allRequiredDone && requiredTasks.length > 0) {
    const [mod] = await db
      .select()
      .from(modules)
      .where(eq(modules.id, moduleId))
      .limit(1)

    if (mod && mod.status !== 'completed') {
      await db
        .update(modules)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(modules.id, moduleId))

      const completedCount = allTasks.filter(t => t.status === 'done').length
      const daysTaken = mod.actualStartedAt
        ? differenceInDays(new Date(), mod.actualStartedAt)
        : null

      await db.insert(moduleCelebrations).values({
        moduleId,
        weddingId: mod.weddingId,
        daysTaken,
        tasksCompleted: completedCount,
        photosUploaded: 0,
        // Store the key, not rendered copy: two partners may read this in
        // different languages. The module's i18nKey ends in `.title`.
        encouragementKey: mod.i18nKey
          ? mod.i18nKey.replace(/\.title$/, '.celebration')
          : null,
        encouragementParams: null,
      })

      // Auto-unlock dependent modules
      const dependents = await db
        .select()
        .from(modules)
        .where(and(
          eq(modules.weddingId, mod.weddingId),
          eq(modules.status, 'locked'),
        ))

      for (const dep of dependents) {
        const prereqs = (dep.prerequisites as string[]) ?? []
        if (!prereqs.includes(mod.templateKey ?? '')) continue

        const prereqModules = await db
          .select()
          .from(modules)
          .where(and(
            eq(modules.weddingId, mod.weddingId),
            sql`${modules.templateKey} = any(${sql.raw(`ARRAY[${prereqs.map(p => `'${p}'`).join(',')}]`)})`
          ))

        if (prereqModules.every(m => m.status === 'completed')) {
          await db
            .update(modules)
            .set({ status: 'active' })
            .where(eq(modules.id, dep.id))
        }
      }
    }
  }
}

export async function taskRoutes(app: FastifyInstance) {
  app.patch('/tasks/:taskId', {
    preHandler: [requireAuth]
  }, async (req, reply) => {
    const { taskId } = req.params as any
    const body = req.body as any

    const updates: Record<string, any> = {}
    if (body.status !== undefined) {
      updates.status = body.status
      updates.completedAt = body.status === 'done' ? new Date() : null
    }
    if (body.rating !== undefined) updates.rating = body.rating
    if (body.notes !== undefined) updates.notes = body.notes
    if (body.costCents !== undefined) updates.costCents = body.costCents
    if (body.costCategory !== undefined) updates.costCategory = body.costCategory
    if (body.assigneeId !== undefined) updates.assigneeId = body.assigneeId
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate
    if (body.title !== undefined) updates.title = body.title

    const [updated] = await db
      .update(tasks)
      .set(updates)
      .where(eq(tasks.id, taskId))
      .returning()

    if (!updated) return reply.status(404).send({ error: 'Task not found' })

    if (body.status === 'done' || body.status === 'skipped') {
      const [sub] = await db
        .select()
        .from(subModules)
        .where(eq(subModules.id, updated.subModuleId))
        .limit(1)
      if (sub) {
        await checkModuleCompletion(sub.moduleId)
      }
    }

    return reply.send(updated)
  })

  app.post('/sub-modules/:subModuleId/tasks', {
    preHandler: [requireAuth]
  }, async (req, reply) => {
    const { subModuleId } = req.params as any
    const body = req.body as any

    const [sub] = await db
      .select()
      .from(subModules)
      .where(eq(subModules.id, subModuleId))
      .limit(1)

    if (!sub) return reply.status(404).send({ error: 'SubModule not found' })

    const [mod] = await db
      .select()
      .from(modules)
      .where(eq(modules.id, sub.moduleId))
      .limit(1)

    const maxOrder = await db
      .select({ max: sql<number>`coalesce(max(${tasks.sortOrder}), 0)::int` })
      .from(tasks)
      .where(eq(tasks.subModuleId, subModuleId))

    const [task] = await db
      .insert(tasks)
      .values({
        subModuleId,
        weddingId: mod!.weddingId,
        title: body.title,
        description: body.description ?? null,
        sortOrder: (maxOrder[0]?.max ?? 0) + 1,
        isOptional: body.isOptional ?? false,
      })
      .returning()

    return reply.status(201).send(task)
  })

  app.delete('/tasks/:taskId', {
    preHandler: [requireAuth]
  }, async (req, reply) => {
    const { taskId } = req.params as any
    await db.delete(tasks).where(eq(tasks.id, taskId))
    return reply.status(204).send()
  })

  app.get('/tasks/:taskId/photos', {
    preHandler: [requireAuth]
  }, async (req, reply) => {
    const { taskId } = req.params as any
    const photos = await db
      .select()
      .from(taskPhotos)
      .where(eq(taskPhotos.taskId, taskId))
      .orderBy(taskPhotos.createdAt)
    return reply.send(photos)
  })

  app.post('/tasks/:taskId/photos', {
    preHandler: [requireAuth]
  }, async (req, reply) => {
    const { taskId } = req.params as any
    const body = req.body as any

    const [photo] = await db
      .insert(taskPhotos)
      .values({
        taskId,
        url: body.url,
        caption: body.caption ?? null,
      })
      .returning()

    return reply.status(201).send(photo)
  })

  app.delete('/photos/:photoId', {
    preHandler: [requireAuth]
  }, async (req, reply) => {
    const { photoId } = req.params as any
    await db.delete(taskPhotos).where(eq(taskPhotos.id, photoId))
    return reply.status(204).send()
  })

  app.put('/tasks/:taskId/vendor', {
    preHandler: [requireAuth]
  }, async (req, reply) => {
    const { taskId } = req.params as any
    const body = req.body as any

    const [existing] = await db
      .select()
      .from(taskVendors)
      .where(eq(taskVendors.taskId, taskId))
      .limit(1)

    if (existing) {
      const [updated] = await db
        .update(taskVendors)
        .set({
          vendorName: body.vendorName,
          contactInfo: body.contactInfo,
          priceQuoteCents: body.priceQuoteCents,
          website: body.website,
          notes: body.notes,
        })
        .where(eq(taskVendors.id, existing.id))
        .returning()
      return reply.send(updated)
    }

    const [vendor] = await db
      .insert(taskVendors)
      .values({
        taskId,
        vendorName: body.vendorName,
        contactInfo: body.contactInfo,
        priceQuoteCents: body.priceQuoteCents,
        website: body.website,
        notes: body.notes,
      })
      .returning()

    return reply.status(201).send(vendor)
  })

  app.delete('/tasks/:taskId/vendor', {
    preHandler: [requireAuth]
  }, async (req, reply) => {
    const { taskId } = req.params as any
    await db.delete(taskVendors).where(eq(taskVendors.taskId, taskId))
    return reply.status(204).send()
  })
}
