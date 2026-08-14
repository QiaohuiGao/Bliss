import { asc, eq, gte } from 'drizzle-orm'
import { db } from '../../db'
import { agentFeedback, agentRuns, agentSpans } from '../../db/schema'
import { summarizeAgentOps } from './summary'

export async function loadAgentOpsSummary(days: number, now = new Date()) {
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1_000)
  const runs = await db.select({
    id: agentRuns.id,
    mode: agentRuns.mode,
    artifactBundleId: agentRuns.artifactBundleId,
    modelId: agentRuns.modelId,
    outcome: agentRuns.outcome,
    stopReason: agentRuns.stopReason,
    inputTokens: agentRuns.inputTokens,
    outputTokens: agentRuns.outputTokens,
    costMicros: agentRuns.costMicros,
    latencyMs: agentRuns.latencyMs,
    startedAt: agentRuns.startedAt,
  }).from(agentRuns).where(gte(agentRuns.startedAt, from)).orderBy(asc(agentRuns.startedAt))
  const feedback = await db.select({
    dimension: agentFeedback.dimension,
    rating: agentFeedback.rating,
  }).from(agentFeedback).where(gte(agentFeedback.createdAt, from))
  return summarizeAgentOps(runs, feedback, { days, from, to: now })
}

export async function loadAgentRunTrace(runId: string) {
  const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, runId)).limit(1)
  if (!run) return null
  const [spans, feedback] = await Promise.all([
    db.select().from(agentSpans).where(eq(agentSpans.runId, runId)).orderBy(asc(agentSpans.startedAt)),
    db.select({
      dimension: agentFeedback.dimension,
      rating: agentFeedback.rating,
      createdAt: agentFeedback.createdAt,
    }).from(agentFeedback).where(eq(agentFeedback.runId, runId)).orderBy(asc(agentFeedback.createdAt)),
  ])
  return { run, spans, feedback }
}
