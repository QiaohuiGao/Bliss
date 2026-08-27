import { describe, expect, it } from 'bun:test'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { planningThreads } from './agent'

describe('planning thread schema', () => {
  it('uniquely identifies one thread per wedding quest question', () => {
    const config = getTableConfig(planningThreads)
    const index = config.indexes.find(item =>
      item.config.name === 'planning_threads_wedding_question_idx',
    )

    expect(index?.config.unique).toBe(true)
    expect(index?.config.columns).toHaveLength(3)
  })
})
