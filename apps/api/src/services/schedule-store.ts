import { addDays, format } from 'date-fns'
import { and, eq, inArray } from 'drizzle-orm'
import { QUEST_TEMPLATES } from '../content/quest-templates'
import { db } from '../db'
import {
  modules,
  scheduleIssues,
  subModules,
  taskDependencies,
  tasks,
  weddings,
} from '../db/schema'
import { computeWeddingSchedule } from './schedule-engine'

export async function syncAuthoredTaskDependencies(weddingId: string) {
  const rows = await db.select({
    id: tasks.id,
    taskKey: tasks.templateKey,
    questKey: modules.templateKey,
  }).from(tasks)
    .innerJoin(subModules, eq(subModules.id, tasks.subModuleId))
    .innerJoin(modules, eq(modules.id, subModules.moduleId))
    .where(eq(tasks.weddingId, weddingId))
  const rowsByQuestTask = new Map(rows.flatMap(row => row.questKey && row.taskKey
    ? [[`${row.questKey}:${row.taskKey}`, row] as const]
    : []))
  const edges: Array<{ taskId: string; dependsOnTaskId: string }> = []
  for (const quest of QUEST_TEMPLATES) {
    for (const authored of quest.sections.flatMap(section => section.tasks)) {
      const task = rowsByQuestTask.get(`${quest.key}:${authored.key}`)
      if (!task) continue
      for (const dependencyKey of authored.dependsOn ?? []) {
        const dependency = rowsByQuestTask.get(`${quest.key}:${dependencyKey}`)
        if (dependency) edges.push({ taskId: task.id, dependsOnTaskId: dependency.id })
      }
    }
  }
  if (edges.length) await db.insert(taskDependencies).values(edges).onConflictDoNothing()
  return edges.length
}

export async function recomputeWeddingSchedule(weddingId: string, today = new Date()) {
  const [wedding] = await db.select().from(weddings).where(eq(weddings.id, weddingId)).limit(1)
  if (!wedding) throw new Error('Wedding not found')
  await syncAuthoredTaskDependencies(weddingId)
  const taskRows = await db.select({
    id: tasks.id,
    status: tasks.status,
    leadTimeDays: tasks.leadTimeDays,
    effortMinutes: tasks.effortMinutes,
    dueDate: tasks.dueDate,
    decisionId: tasks.decisionId,
    questKey: modules.templateKey,
  }).from(tasks)
    .innerJoin(subModules, eq(subModules.id, tasks.subModuleId))
    .innerJoin(modules, eq(modules.id, subModules.moduleId))
    .where(eq(tasks.weddingId, weddingId))
  const ids = taskRows.map(task => task.id)
  const dependencies = ids.length
    ? await db.select().from(taskDependencies).where(inArray(taskDependencies.taskId, ids))
    : []
  const dependencyIds = new Map<string, string[]>()
  for (const edge of dependencies) {
    dependencyIds.set(edge.taskId, [...(dependencyIds.get(edge.taskId) ?? []), edge.dependsOnTaskId])
  }
  const weddingDate = wedding.weddingDate ?? format(addDays(today, 420), 'yyyy-MM-dd')
  if (wedding.weddingDate && new Date(`${wedding.weddingDate}T12:00:00`) <= today) {
    await db.transaction(async tx => {
      await tx.update(tasks).set({
        computedLatestStart: null,
        plannedWeekStart: null,
        slackDays: null,
        onCriticalPath: false,
      }).where(eq(tasks.weddingId, weddingId))
      await tx.delete(scheduleIssues).where(eq(scheduleIssues.weddingId, weddingId))
    })
    return { weddingDate, tasks: [], issues: [], weeklyLoads: [] }
  }
  const result = computeWeddingSchedule({
    weddingDate,
    weeklyCapacityHours: wedding.weeklyCapacityHours,
    today,
    tasks: taskRows.map(task => ({
      id: task.id,
      status: task.status,
      leadTimeDays: task.leadTimeDays ?? 0,
      effortMinutes: task.effortMinutes,
      dueDate: task.dueDate,
      decisionId: task.decisionId,
      questKey: task.questKey,
      dependsOnTaskIds: dependencyIds.get(task.id) ?? [],
    })),
  })
  await db.transaction(async tx => {
    for (const scheduled of result.tasks) {
      await tx.update(tasks).set({
        computedLatestStart: scheduled.computedLatestStart,
        plannedWeekStart: scheduled.plannedWeekStart,
        slackDays: scheduled.slackDays,
        onCriticalPath: scheduled.onCriticalPath,
      }).where(and(eq(tasks.id, scheduled.id), eq(tasks.weddingId, weddingId)))
    }
    await tx.delete(scheduleIssues).where(eq(scheduleIssues.weddingId, weddingId))
    if (result.issues.length) {
      await tx.insert(scheduleIssues).values(result.issues.map(issue => ({
        weddingId,
        ...issue,
      })))
    }
  })
  return result
}
