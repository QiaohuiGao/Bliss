import { describe, expect, it } from 'bun:test'
import { runAgentLoop } from './loop'
import type {
  AgentModel,
  AgentModelResult,
  AgentSpanRecord,
  AgentTool,
  AgentTraceSink,
} from '../types'

class ScriptedModel implements AgentModel {
  readonly id = 'scripted-test-model'
  private cursor = 0

  constructor(private readonly results: AgentModelResult[]) {}

  async generate(): Promise<AgentModelResult> {
    const result = this.results[Math.min(this.cursor, this.results.length - 1)]!
    this.cursor += 1
    return result
  }
}

class MemoryTrace implements AgentTraceSink {
  readonly spans: AgentSpanRecord[] = []
  async recordSpan(_runId: string, span: AgentSpanRecord) {
    this.spans.push(span)
  }
}

const context = {
  runId: 'run-1',
  weddingId: 'wedding-1',
  userId: 'user-1',
  threadId: 'thread-1',
}

const limits = {
  maxSteps: 8,
  maxTokens: 40_000,
  maxCostMicros: 100_000,
  maxMs: 1_000,
}

const result = (
  text: string | undefined,
  toolCalls: AgentModelResult['toolCalls'] = [],
  usage?: AgentModelResult['usage'],
): AgentModelResult => ({ text, toolCalls, usage })

const echoTool: AgentTool = {
  definition: { name: 'echo', description: 'Echo input', inputSchema: {} },
  async execute(input) {
    return input
  },
}

describe('bounded agent loop', () => {
  it('stops naturally when the model requests no tool', async () => {
    const trace = new MemoryTrace()
    const run = await runAgentLoop({
      model: new ScriptedModel([result('Done')]),
      tools: [],
      messages: [],
      context,
      limits,
      trace,
    })

    expect(run.stopReason).toBe('natural')
    expect(run.messages.at(-1)?.content).toBe('Done')
    expect(trace.spans.map(s => s.kind)).toEqual(['model_call'])
  })

  it('stops after a terminal proposal tool', async () => {
    const trace = new MemoryTrace()
    const terminal: AgentTool = { ...echoTool, terminal: true }
    const run = await runAgentLoop({
      model: new ScriptedModel([
        result(undefined, [{ id: 'call-1', name: 'echo', input: { ok: true } }]),
      ]),
      tools: [terminal],
      messages: [],
      context,
      limits,
      trace,
    })

    expect(run.stopReason).toBe('terminal_tool')
    expect(run.terminalToolResult).toEqual({ ok: true })
  })

  it('stops at max steps instead of looping forever', async () => {
    const trace = new MemoryTrace()
    const run = await runAgentLoop({
      model: new ScriptedModel([
        result(undefined, [{ id: 'call', name: 'echo', input: 'again' }]),
      ]),
      tools: [echoTool],
      messages: [],
      context,
      limits: { ...limits, maxSteps: 2 },
      trace,
    })

    expect(run.stopReason).toBe('max_steps')
    expect(run.steps).toBe(2)
  })

  it('enforces token and cost budgets', async () => {
    const tokenRun = await runAgentLoop({
      model: new ScriptedModel([result('large', [], { inputTokens: 80, outputTokens: 30 })]),
      tools: [],
      messages: [],
      context,
      limits: { ...limits, maxTokens: 100 },
      trace: new MemoryTrace(),
    })
    const costRun = await runAgentLoop({
      model: new ScriptedModel([result('costly', [], {
        inputTokens: 1,
        outputTokens: 1,
        costMicros: 101,
      })]),
      tools: [],
      messages: [],
      context,
      limits: { ...limits, maxCostMicros: 100 },
      trace: new MemoryTrace(),
    })

    expect(tokenRun.stopReason).toBe('max_tokens')
    expect(costRun.stopReason).toBe('max_cost')
  })

  it('distinguishes timeout from user cancellation', async () => {
    const waitingModel: AgentModel = {
      id: 'waiting-model',
      generate: ({ signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      }),
    }
    const timedOut = await runAgentLoop({
      model: waitingModel,
      tools: [],
      messages: [],
      context,
      limits: { ...limits, maxMs: 10 },
      trace: new MemoryTrace(),
    })
    const controller = new AbortController()
    controller.abort('user cancelled')
    const cancelled = await runAgentLoop({
      model: new ScriptedModel([result('should not run')]),
      tools: [],
      messages: [],
      context,
      limits,
      trace: new MemoryTrace(),
      signal: controller.signal,
    })

    expect(timedOut.stopReason).toBe('timeout')
    expect(cancelled.stopReason).toBe('cancelled')
  })

  it('blocks tools outside the active allowlist', async () => {
    const trace = new MemoryTrace()
    const run = await runAgentLoop({
      model: new ScriptedModel([
        result(undefined, [{ id: 'call-1', name: 'send_email', input: {} }]),
      ]),
      tools: [echoTool],
      messages: [],
      context,
      limits,
      trace,
    })

    expect(run.stopReason).toBe('guardrail')
    expect(trace.spans.at(-1)?.error?.code).toBe('TOOL_NOT_ALLOWED')
  })
})
