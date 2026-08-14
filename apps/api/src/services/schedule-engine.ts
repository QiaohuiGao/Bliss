import {
  addDays,
  addWeeks,
  differenceInCalendarDays,
  format,
  isAfter,
  parseISO,
  startOfDay,
  startOfWeek,
} from 'date-fns'

export interface ScheduleTaskInput {
  id: string
  status: 'todo' | 'done' | 'skipped'
  leadTimeDays: number
  effortMinutes: number
  dueDate: string | null
  decisionId: string | null
  questKey: string | null
  dependsOnTaskIds: string[]
}

export interface ScheduledTask {
  id: string
  computedLatestStart: string
  plannedWeekStart: string | null
  slackDays: number
  onCriticalPath: boolean
}

export interface ScheduleIssueDraft {
  type: 'negative_slack' | 'weekly_overload'
  severity: 'warning' | 'blocking'
  taskId: string | null
  decisionId: string | null
  questKey: string | null
  weekStart: string | null
  slackDays: number | null
  overloadMinutes: number | null
}

export interface ScheduleResult {
  weddingDate: string
  tasks: ScheduledTask[]
  issues: ScheduleIssueDraft[]
  weeklyLoads: Array<{
    weekStart: string
    plannedMinutes: number
    capacityMinutes: number
    overloadMinutes: number
  }>
}

const isoDate = (date: Date) => format(date, 'yyyy-MM-dd')
const monday = (date: Date) => startOfWeek(date, { weekStartsOn: 1 })

function topologicalOrder(tasks: ScheduleTaskInput[]) {
  const byId = new Map(tasks.map(task => [task.id, task]))
  const indegree = new Map(tasks.map(task => [task.id, 0]))
  const successors = new Map(tasks.map(task => [task.id, [] as string[]]))
  for (const task of tasks) {
    for (const dependencyId of task.dependsOnTaskIds) {
      if (!byId.has(dependencyId)) continue
      indegree.set(task.id, (indegree.get(task.id) ?? 0) + 1)
      successors.get(dependencyId)!.push(task.id)
    }
  }
  const queue = tasks.filter(task => indegree.get(task.id) === 0).map(task => task.id).sort()
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const successorId of successors.get(id) ?? []) {
      const next = (indegree.get(successorId) ?? 0) - 1
      indegree.set(successorId, next)
      if (next === 0) {
        queue.push(successorId)
        queue.sort()
      }
    }
  }
  if (order.length !== tasks.length) throw new Error('Task dependency graph contains a cycle')
  return { order, byId, successors }
}

export function computeWeddingSchedule(input: {
  weddingDate: string
  weeklyCapacityHours: number
  tasks: ScheduleTaskInput[]
  today?: Date
}): ScheduleResult {
  const today = startOfDay(input.today ?? new Date())
  const weddingDate = startOfDay(parseISO(input.weddingDate))
  if (!isAfter(weddingDate, today)) throw new Error('Wedding date must be after today')
  if (!Number.isInteger(input.weeklyCapacityHours) || input.weeklyCapacityHours < 1) {
    throw new Error('Weekly capacity must be at least one hour')
  }

  const { order, byId, successors } = topologicalOrder(input.tasks)
  const latestStart = new Map<string, Date>()
  for (const id of [...order].reverse()) {
    const task = byId.get(id)!
    const authoredDeadline = task.leadTimeDays > 0
      ? addDays(weddingDate, -task.leadTimeDays)
      : task.dueDate
        ? startOfDay(parseISO(task.dueDate))
        : weddingDate
    const successorDeadlines = (successors.get(id) ?? [])
      .map(successorId => addDays(latestStart.get(successorId)!, -1))
    latestStart.set(id, successorDeadlines.reduce(
      (earliest, candidate) => candidate < earliest ? candidate : earliest,
      authoredDeadline,
    ))
  }

  const active = input.tasks.filter(task => task.status === 'todo')
  const activeSlack = active.map(task => differenceInCalendarDays(latestStart.get(task.id)!, today))
  const minimumSlack = activeSlack.length ? Math.min(...activeSlack) : null

  const capacityMinutes = input.weeklyCapacityHours * 60
  const firstWeek = monday(today)
  const lastWeek = monday(weddingDate)
  const weekly = new Map<string, { plannedMinutes: number; overloadMinutes: number }>()
  for (let cursor = firstWeek; cursor <= lastWeek; cursor = addWeeks(cursor, 1)) {
    weekly.set(isoDate(cursor), { plannedMinutes: 0, overloadMinutes: 0 })
  }
  const plannedWeek = new Map<string, string | null>()
  const byDeadline = [...active].sort((left, right) => {
    const difference = latestStart.get(left.id)!.getTime() - latestStart.get(right.id)!.getTime()
    return difference || left.id.localeCompare(right.id)
  })
  for (const task of byDeadline) {
    let remainingMinutes = Math.max(0, task.effortMinutes)
    const deadline = latestStart.get(task.id)!
    const deadlineWeek = monday(deadline < today ? today : deadline)
    let selected: string | null = null
    for (let cursor = firstWeek; cursor <= deadlineWeek && cursor <= lastWeek; cursor = addWeeks(cursor, 1)) {
      const key = isoDate(cursor)
      const load = weekly.get(key)!
      const available = Math.max(0, capacityMinutes - load.plannedMinutes)
      const allocated = Math.min(remainingMinutes, available)
      if (allocated > 0) selected ??= key
      load.plannedMinutes += allocated
      remainingMinutes -= allocated
      if (remainingMinutes === 0) break
    }
    const fallback = isoDate(deadlineWeek < firstWeek ? firstWeek : deadlineWeek)
    const overloadWeek = weekly.has(fallback) ? fallback : isoDate(lastWeek)
    selected ??= overloadWeek
    if (remainingMinutes > 0) {
      const load = weekly.get(overloadWeek)!
      load.plannedMinutes += remainingMinutes
      load.overloadMinutes = Math.max(0, load.plannedMinutes - capacityMinutes)
    }
    plannedWeek.set(task.id, selected)
  }

  const tasks = input.tasks.map(task => {
    const slackDays = differenceInCalendarDays(latestStart.get(task.id)!, today)
    return {
      id: task.id,
      computedLatestStart: isoDate(latestStart.get(task.id)!),
      plannedWeekStart: task.status === 'todo' ? plannedWeek.get(task.id) ?? null : null,
      slackDays,
      onCriticalPath: task.status === 'todo' && slackDays === minimumSlack,
    }
  })
  const issues: ScheduleIssueDraft[] = [
    ...active.flatMap(task => {
      const slackDays = differenceInCalendarDays(latestStart.get(task.id)!, today)
      return slackDays < 0 ? [{
        type: 'negative_slack' as const,
        severity: 'blocking' as const,
        taskId: task.id,
        decisionId: task.decisionId,
        questKey: task.questKey,
        weekStart: null,
        slackDays,
        overloadMinutes: null,
      }] : []
    }),
    ...[...weekly.entries()].flatMap(([weekStart, load]) => load.overloadMinutes > 0 ? [{
      type: 'weekly_overload' as const,
      severity: 'warning' as const,
      taskId: null,
      decisionId: null,
      questKey: null,
      weekStart,
      slackDays: null,
      overloadMinutes: load.overloadMinutes,
    }] : []),
  ]

  return {
    weddingDate: isoDate(weddingDate),
    tasks,
    issues,
    weeklyLoads: [...weekly.entries()].map(([weekStart, load]) => ({
      weekStart,
      plannedMinutes: load.plannedMinutes,
      capacityMinutes,
      overloadMinutes: load.overloadMinutes,
    })),
  }
}
