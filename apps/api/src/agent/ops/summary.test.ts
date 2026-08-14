import { describe, expect, it } from 'bun:test'
import { summarizeAgentOps, type OpsRunRecord } from './summary'

const run = (overrides: Partial<OpsRunRecord> = {}): OpsRunRecord => ({
  id: crypto.randomUUID(),
  mode: 'decision',
  artifactBundleId: 'attire-v1',
  modelId: 'model-a',
  outcome: 'proposal_created',
  stopReason: 'terminal_tool',
  inputTokens: 100,
  outputTokens: 40,
  costMicros: 200,
  latencyMs: 100,
  startedAt: new Date('2026-08-13T10:00:00Z'),
  ...overrides,
})

describe('agent ops summary', () => {
  it('segments reliability, latency, cost, and feedback by deployable bundle', () => {
    const report = summarizeAgentOps([
      run({ latencyMs: 100 }),
      run({ latencyMs: 200 }),
      run({
        artifactBundleId: 'photographer-v1',
        modelId: 'model-b',
        outcome: 'failed',
        stopReason: 'error',
        latencyMs: 1_000,
      }),
    ], [
      { dimension: 'represented_both', rating: 1 },
      { dimension: 'represented_both', rating: -1 },
    ], {
      days: 7,
      from: new Date('2026-08-06T12:00:00Z'),
      to: new Date('2026-08-13T12:00:00Z'),
    })

    expect(report.totals).toMatchObject({ runs: 3, completed: 2, failed: 1 })
    expect(report.totals.latencyMs).toEqual({ p50: 200, p95: 1_000 })
    expect(report.bundles).toHaveLength(2)
    expect(report.feedback).toEqual([{
      dimension: 'represented_both',
      responses: 2,
      positive: 1,
      positiveRate: 0.5,
    }])
    expect(report.slo.runErrorRate.healthy).toBe(false)
  })

  it('treats an empty window as healthy and avoids NaN rates', () => {
    const now = new Date('2026-08-13T12:00:00Z')
    const report = summarizeAgentOps([], [], { days: 1, from: now, to: now })
    expect(report.totals.errorRate).toBe(0)
    expect(report.totals.completionRate).toBe(0)
    expect(report.slo.runErrorRate.healthy).toBe(true)
  })
})
