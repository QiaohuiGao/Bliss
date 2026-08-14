export interface OpsRunRecord {
  id: string
  mode: string
  artifactBundleId: string
  modelId: string
  outcome: string
  stopReason: string | null
  inputTokens: number
  outputTokens: number
  costMicros: number
  latencyMs: number | null
  startedAt: Date
}

export interface OpsFeedbackRecord {
  dimension: string
  rating: number
}

const round = (value: number, digits = 4) => Number(value.toFixed(digits))

const percentile = (values: number[], fraction: number): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)]!
}

function groupCounts(values: Array<string | null>) {
  return Object.fromEntries([...values.reduce((counts, value) => {
    const key = value ?? 'unknown'
    counts.set(key, (counts.get(key) ?? 0) + 1)
    return counts
  }, new Map<string, number>())].sort(([a], [b]) => a.localeCompare(b)))
}

function bundleSummary(runs: OpsRunRecord[]) {
  const groups = new Map<string, OpsRunRecord[]>()
  for (const run of runs) {
    const key = `${run.mode}:${run.artifactBundleId}:${run.modelId}`
    groups.set(key, [...(groups.get(key) ?? []), run])
  }
  return [...groups.values()].map(group => {
    const first = group[0]!
    const failed = group.filter(run => run.outcome === 'failed').length
    const completed = group.filter(run => run.outcome === 'completed' || run.outcome === 'proposal_created').length
    const latency = group.flatMap(run => run.latencyMs === null ? [] : [run.latencyMs])
    return {
      mode: first.mode,
      bundleId: first.artifactBundleId,
      modelId: first.modelId,
      runs: group.length,
      completed,
      completionRate: round(completed / group.length),
      failed,
      errorRate: round(failed / group.length),
      latencyMs: { p50: percentile(latency, 0.5), p95: percentile(latency, 0.95) },
      totalCostMicros: group.reduce((sum, run) => sum + run.costMicros, 0),
      stopReasons: groupCounts(group.map(run => run.stopReason)),
    }
  }).sort((a, b) => a.bundleId.localeCompare(b.bundleId) || a.modelId.localeCompare(b.modelId))
}

export function summarizeAgentOps(
  runs: OpsRunRecord[],
  feedback: OpsFeedbackRecord[],
  window: { days: number; from: Date; to: Date },
) {
  const failed = runs.filter(run => run.outcome === 'failed').length
  const completed = runs.filter(run => run.outcome === 'completed' || run.outcome === 'proposal_created').length
  const latency = runs.flatMap(run => run.latencyMs === null ? [] : [run.latencyMs])
  const feedbackByDimension = [...feedback.reduce((groups, item) => {
    const values = groups.get(item.dimension) ?? []
    values.push(item.rating)
    groups.set(item.dimension, values)
    return groups
  }, new Map<string, number[]>())].map(([dimension, ratings]) => ({
    dimension,
    responses: ratings.length,
    positive: ratings.filter(rating => rating === 1).length,
    positiveRate: round(ratings.filter(rating => rating === 1).length / ratings.length),
  })).sort((a, b) => a.dimension.localeCompare(b.dimension))
  const errorRate = runs.length ? failed / runs.length : 0

  return {
    generatedAt: window.to.toISOString(),
    window: { days: window.days, from: window.from.toISOString(), to: window.to.toISOString() },
    totals: {
      runs: runs.length,
      completed,
      completionRate: runs.length ? round(completed / runs.length) : 0,
      failed,
      errorRate: runs.length ? round(errorRate) : 0,
      inputTokens: runs.reduce((sum, run) => sum + run.inputTokens, 0),
      outputTokens: runs.reduce((sum, run) => sum + run.outputTokens, 0),
      costMicros: runs.reduce((sum, run) => sum + run.costMicros, 0),
      latencyMs: { p50: percentile(latency, 0.5), p95: percentile(latency, 0.95) },
    },
    stopReasons: groupCounts(runs.map(run => run.stopReason)),
    bundles: bundleSummary(runs),
    feedback: feedbackByDimension,
    slo: {
      runErrorRate: {
        target: 0.03,
        actual: runs.length ? round(errorRate) : 0,
        healthy: runs.length === 0 || errorRate <= 0.03,
      },
    },
  }
}

export type AgentOpsSummary = ReturnType<typeof summarizeAgentOps>
