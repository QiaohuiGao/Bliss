import { describe, expect, it } from 'bun:test'
import { computeWeddingSchedule, type ScheduleTaskInput } from './schedule-engine'

const task = (overrides: Partial<ScheduleTaskInput> = {}): ScheduleTaskInput => ({
  id: crypto.randomUUID(),
  status: 'todo',
  leadTimeDays: 0,
  effortMinutes: 60,
  dueDate: null,
  decisionId: null,
  questKey: 'attire_beauty',
  dependsOnTaskIds: [],
  ...overrides,
})

describe('deterministic wedding schedule', () => {
  it('makes a six-month custom gown infeasible but keeps rental feasible', () => {
    const today = new Date('2026-01-01T12:00:00Z')
    const custom = task({ id: 'custom', leadTimeDays: 180, decisionId: 'decision-custom' })
    const rental = task({ id: 'rental', leadTimeDays: 21 })
    const result = computeWeddingSchedule({
      weddingDate: '2026-05-31',
      weeklyCapacityHours: 5,
      tasks: [custom, rental],
      today,
    })
    expect(result.tasks.find(item => item.id === 'custom')?.slackDays).toBe(-30)
    expect(result.tasks.find(item => item.id === 'rental')?.slackDays).toBe(129)
    expect(result.issues).toContainEqual(expect.objectContaining({
      type: 'negative_slack',
      taskId: 'custom',
      decisionId: 'decision-custom',
      slackDays: -30,
    }))
  })

  it('moves a prerequisite before its successor without adding lead times together', () => {
    const result = computeWeddingSchedule({
      weddingDate: '2027-01-01',
      weeklyCapacityHours: 5,
      tasks: [
        task({ id: 'order', leadTimeDays: 180 }),
        task({ id: 'fitting', leadTimeDays: 56, dependsOnTaskIds: ['order'] }),
      ],
      today: new Date('2026-01-01T12:00:00Z'),
    })
    expect(result.tasks.find(item => item.id === 'order')?.computedLatestStart).toBe('2026-07-05')
    expect(result.tasks.find(item => item.id === 'fitting')?.computedLatestStart).toBe('2026-11-06')
  })

  it('flags work that cannot fit before its deadline at the weekly capacity', () => {
    const result = computeWeddingSchedule({
      weddingDate: '2026-01-31',
      weeklyCapacityHours: 2,
      tasks: [
        task({ id: 'one', effortMinutes: 120, dueDate: '2026-01-05' }),
        task({ id: 'two', effortMinutes: 120, dueDate: '2026-01-05' }),
        task({ id: 'three', effortMinutes: 120, dueDate: '2026-01-05' }),
      ],
      today: new Date('2026-01-01T12:00:00Z'),
    })
    expect(result.issues).toContainEqual(expect.objectContaining({
      type: 'weekly_overload',
      weekStart: '2026-01-05',
      overloadMinutes: 120,
    }))
  })

  it('rejects a dependency cycle instead of silently producing dates', () => {
    expect(() => computeWeddingSchedule({
      weddingDate: '2027-01-01',
      weeklyCapacityHours: 5,
      tasks: [
        task({ id: 'one', dependsOnTaskIds: ['two'] }),
        task({ id: 'two', dependsOnTaskIds: ['one'] }),
      ],
      today: new Date('2026-01-01T12:00:00Z'),
    })).toThrow('dependency graph contains a cycle')
  })
})
