import { db } from '../../db'
import { agentSpans } from '../../db/schema'
import type { AgentSpanRecord, AgentTraceSink } from '../types'
import { traceSafeSpan } from './trace-sanitize'

export class DatabaseTraceSink implements AgentTraceSink {
  async recordSpan(runId: string, span: AgentSpanRecord): Promise<void> {
    const safe = traceSafeSpan(span)
    await db.insert(agentSpans).values({
      runId,
      parentSpanId: safe.parentSpanId ?? null,
      kind: safe.kind,
      name: safe.name,
      input: safe.input ?? null,
      output: safe.output ?? null,
      error: safe.error ?? null,
      inputTokens: safe.inputTokens ?? null,
      outputTokens: safe.outputTokens ?? null,
      costMicros: safe.costMicros ?? null,
      startedAt: safe.startedAt,
      endedAt: safe.endedAt,
    })
  }
}

/** Telemetry must never turn a successful user action into a failed one. */
export class ResilientTraceSink implements AgentTraceSink {
  constructor(
    private readonly inner: AgentTraceSink,
    private readonly onError: (error: unknown, runId: string, span: AgentSpanRecord) => void = () => {},
  ) {}

  async recordSpan(runId: string, span: AgentSpanRecord): Promise<void> {
    try {
      await this.inner.recordSpan(runId, span)
    } catch (error) {
      this.onError(error, runId, span)
    }
  }
}
