import { describe, expect, it } from 'bun:test'
import { stickyReleaseBucket } from './cohort'

describe('sticky release cohorts', () => {
  it('is deterministic for one wedding and deployment', () => {
    const first = stickyReleaseBucket('wedding-1', 'deployment-1')
    expect(stickyReleaseBucket('wedding-1', 'deployment-1')).toBe(first)
    expect(first).toBeGreaterThanOrEqual(0)
    expect(first).toBeLessThan(10_000)
  })

  it('uses the deployment identity so a new canary gets a new allocation', () => {
    expect(stickyReleaseBucket('wedding-1', 'deployment-1'))
      .not.toBe(stickyReleaseBucket('wedding-1', 'deployment-2'))
  })
})
