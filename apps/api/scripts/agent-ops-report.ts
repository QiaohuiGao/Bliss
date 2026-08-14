import { loadAgentOpsSummary } from '../src/agent/ops/store'

const daysFlag = process.argv.find(argument => argument.startsWith('--days='))
const days = Number(daysFlag?.split('=')[1] ?? 7)
if (!Number.isInteger(days) || days < 1 || days > 90) {
  throw new Error('--days must be an integer from 1 to 90')
}

const report = await loadAgentOpsSummary(days)
console.log(`Bliss Agent Ops · last ${days} day${days === 1 ? '' : 's'}`)
console.log(`Runs ${report.totals.runs} · completed ${report.totals.completed} · failed ${report.totals.failed}`)
console.log(`Latency P50 ${report.totals.latencyMs.p50 ?? 'n/a'} ms · P95 ${report.totals.latencyMs.p95 ?? 'n/a'} ms`)
console.log(`Tokens ${report.totals.inputTokens + report.totals.outputTokens} · cost ${report.totals.costMicros} µUSD`)
console.table(report.bundles.map(bundle => ({
  bundle: bundle.bundleId,
  model: bundle.modelId,
  runs: bundle.runs,
  completion: bundle.completionRate,
  errors: bundle.errorRate,
  p95_ms: bundle.latencyMs.p95,
  cost_micros: bundle.totalCostMicros,
})))
if (report.feedback.length) console.table(report.feedback)
if (!report.slo.runErrorRate.healthy) {
  console.error(`SLO BREACH: run error rate ${report.slo.runErrorRate.actual} > ${report.slo.runErrorRate.target}`)
  process.exitCode = 2
}
