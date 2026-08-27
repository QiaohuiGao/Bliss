/**
 * Aggregates the numbers worth quoting about this agent system: eval coverage
 * from the release-gate suites, and runtime behaviour from recorded traces.
 *
 *   bun run metrics:resume            eval section only
 *   bun run metrics:resume --days=30  eval section plus runtime, needs DATABASE_URL
 */
import {
  ATTIRE_ARTIFACT_BUNDLE,
  PHOTOGRAPHER_ARTIFACT_BUNDLE,
  QUEST_SCOPING_ARTIFACT_BUNDLES,
} from '../src/agent/artifacts/registry'
import {
  runAttireEvalSuite,
  runPhotographerEvalSuite,
  runQuestScopingEvalSuite,
  runVenueScopingEvalSuite,
  runFoundationScopingEvalSuite,
  runGuestsScopingEvalSuite,
  runWeddingPartyScopingEvalSuite,
  runGuestExperienceScopingEvalSuite,
  runDesignScopingEvalSuite,
  runCeremonyScopingEvalSuite,
  runLifeScopingEvalSuite,
  runLegalScopingEvalSuite,
  runPreEventsScopingEvalSuite,
  runFinaleScopingEvalSuite,
} from '../src/agent/evals/run-suite'

const daysFlag = process.argv.find(argument => argument.startsWith('--days='))
const days = daysFlag ? Number(daysFlag.split('=')[1]) : null
if (days !== null && (!Number.isInteger(days) || days < 1 || days > 365)) {
  throw new Error('--days must be an integer from 1 to 365')
}

// ---------------------------------------------------------------- eval suites

const startedAt = Date.now()
const reports = await Promise.all([
  runAttireEvalSuite(ATTIRE_ARTIFACT_BUNDLE),
  runPhotographerEvalSuite(PHOTOGRAPHER_ARTIFACT_BUNDLE),
  runQuestScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.food_beverage),
  runVenueScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.venue_date),
  runFoundationScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.foundation),
  runGuestsScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.guests_stationery),
  runWeddingPartyScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.wedding_party),
  runGuestExperienceScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.guest_experience),
  runDesignScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.design_flowers),
  runCeremonyScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.ceremony),
  runLifeScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.registry_rings_honeymoon),
  runLegalScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.legal),
  runPreEventsScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.pre_wedding_events),
  runFinaleScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.final_30_and_day_of),
])
const gateMs = Date.now() - startedAt

const checks = reports.flatMap(report => [...report.promptChecks, ...report.cases])
const caseChecks = reports.flatMap(report => report.cases)
const promptChecks = reports.flatMap(report => report.promptChecks)
const failing = checks.filter(check => !check.passed)

console.log('=== EVAL COVERAGE ===')
console.log(`Suites:            ${reports.length}`)
console.log(`Cases:             ${caseChecks.length}`)
console.log(`Prompt checks:     ${promptChecks.length}`)
console.log(`Total assertions:  ${checks.length}`)
console.log(`Passing:           ${checks.length - failing.length}/${checks.length} (${pct(checks.length - failing.length, checks.length)})`)
console.log(`Gate runtime:      ${(gateMs / 1000).toFixed(1)}s`)
console.log(`Suites at 100%:    ${reports.filter(report => report.passed).length}/${reports.length}`)
if (failing.length) {
  console.log('Failing:')
  for (const failure of failing) console.log(`  ${failure.id}: ${failure.detail ?? 'failed'}`)
}
console.table(reports.map(report => ({
  bundle: report.bundleId,
  suite: report.suiteVersion,
  cases: report.caseCount,
  prompt_checks: report.promptChecks.length,
  passed: report.passed,
})))

// -------------------------------------------------------------- runtime traces

if (days === null) {
  console.log('\n(runtime section skipped — pass --days=N with DATABASE_URL set)')
  process.exit(0)
}

const { db } = await import('../src/db')
const { sql } = await import('drizzle-orm')
const since = sql`now() - ${`${days} days`}::interval`

const [totals] = await db.execute<{
  runs: number
  traced: number
  mean_steps: number | null
  p50_ms: number | null
  p95_ms: number | null
  max_ms: number | null
  mean_cost_micros: number | null
  p95_cost_micros: number | null
  total_cost_micros: number | null
  mean_tokens: number | null
}>(sql`
  select
    count(*)::int                                                          as runs,
    count(*) filter (where exists (
      select 1 from agent_spans s where s.run_id = r.id))::int             as traced,
    avg(r.steps)                                                           as mean_steps,
    percentile_disc(0.5) within group (order by r.latency_ms)              as p50_ms,
    percentile_disc(0.95) within group (order by r.latency_ms)             as p95_ms,
    max(r.latency_ms)                                                      as max_ms,
    avg(r.cost_micros)                                                     as mean_cost_micros,
    percentile_disc(0.95) within group (order by r.cost_micros)            as p95_cost_micros,
    sum(r.cost_micros)                                                     as total_cost_micros,
    avg(r.input_tokens + r.output_tokens)                                  as mean_tokens
  from agent_runs r
  where r.started_at >= ${since}
`)

if (!totals || totals.runs === 0) {
  console.log(`\n=== RUNTIME (last ${days}d) ===\nNo runs recorded. Exercise the agent first (bun run smoke:agent).`)
  process.exit(0)
}

const stopReasons = await db.execute<{ stop_reason: string | null; n: number }>(sql`
  select coalesce(stop_reason, 'null') as stop_reason, count(*)::int as n
  from agent_runs where started_at >= ${since}
  group by 1 order by n desc
`)
const outcomes = await db.execute<{ outcome: string; n: number }>(sql`
  select outcome, count(*)::int as n
  from agent_runs where started_at >= ${since}
  group by 1 order by n desc
`)
const tools = await db.execute<{ name: string; calls: number; errors: number; p95_ms: number | null }>(sql`
  select s.name,
         count(*)::int                                          as calls,
         count(*) filter (where s.error is not null)::int        as errors,
         percentile_disc(0.95) within group (
           order by extract(milliseconds from (s.ended_at - s.started_at))) as p95_ms
  from agent_spans s
  join agent_runs r on r.id = s.run_id
  where s.kind = 'tool' and r.started_at >= ${since}
  group by 1 order by calls desc
`)

// A run that stopped for any reason other than "natural" hit a budget wall on
// purpose; a run with no stop reason at all is the unbounded case we care about.
const unbounded = stopReasons.find(row => row.stop_reason === 'null')?.n ?? 0
const budgetStops = stopReasons
  .filter(row => !['natural', 'null'].includes(row.stop_reason ?? ''))
  .reduce((sum, row) => sum + row.n, 0)

console.log(`\n=== RUNTIME (last ${days}d) ===`)
console.log(`Runs:              ${totals.runs}`)
console.log(`Trace coverage:    ${totals.traced}/${totals.runs} (${pct(totals.traced, totals.runs)})`)
console.log(`Mean tool-steps:   ${num(totals.mean_steps, 2)}`)
console.log(`Latency p50/p95:   ${totals.p50_ms ?? 'n/a'}ms / ${totals.p95_ms ?? 'n/a'}ms (max ${totals.max_ms ?? 'n/a'}ms)`)
console.log(`Cost mean/p95:     ${cents(totals.mean_cost_micros)} / ${cents(totals.p95_cost_micros)} per run`)
console.log(`Total spend:       ${cents(totals.total_cost_micros)}`)
console.log(`Mean tokens/run:   ${num(totals.mean_tokens, 0)}`)
console.log(`Budget-capped:     ${budgetStops} (${pct(budgetStops, totals.runs)}) — stopped on steps/tokens/cost/timeout`)
console.log(`Unbounded runs:    ${unbounded}`)
console.table(stopReasons)
console.table(outcomes)
if (tools.length) console.table(tools)

console.log('\n--- resume-ready lines ---')
console.log(`p95 run latency ${sec(totals.p95_ms)}s · mean ${num(totals.mean_steps, 1)} tool-steps/run · ${cents(totals.p95_cost_micros)} p95 cost, ${unbounded} unbounded runs across ${totals.runs} traced sessions`)
console.log(`${caseChecks.length} eval cases across ${reports.length} domain suites, ${pct(checks.length - failing.length, checks.length)} passing, gate blocks promotion in ${(gateMs / 1000).toFixed(1)}s`)

process.exit(0)

function pct(part: number, whole: number): string {
  if (!whole) return 'n/a'
  return `${((part / whole) * 100).toFixed(1)}%`
}
function num(value: number | string | null, digits: number): string {
  return value === null ? 'n/a' : Number(value).toFixed(digits)
}
function cents(micros: number | string | null): string {
  return micros === null ? 'n/a' : `${(Number(micros) / 10_000).toFixed(3)}¢`
}
function sec(ms: number | string | null): string {
  return ms === null ? 'n/a' : (Number(ms) / 1000).toFixed(1)
}
