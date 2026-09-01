import { AgentGuardrailError, normalizedAgentError } from '../errors'
import type {
  AgentMessage,
  AgentModel,
  AgentStopReason,
  AgentTool,
  AgentToolContext,
  AgentTraceSink,
} from '../types'

export interface AgentLoopLimits {
  maxSteps: number
  maxTokens: number
  maxCostMicros: number
  maxMs: number
}

export interface AgentLoopResult {
  messages: AgentMessage[]
  stopReason: AgentStopReason
  steps: number
  inputTokens: number
  outputTokens: number
  costMicros: number
  terminalToolResult?: unknown
}

export interface RunAgentLoopInput {
  model: AgentModel
  tools: AgentTool[]
  messages: AgentMessage[]
  context: AgentToolContext
  limits: AgentLoopLimits
  trace: AgentTraceSink
  signal?: AbortSignal
}

const jsonForMessage = (value: unknown) => {
  try {
    return JSON.stringify(value)
  } catch {
    return JSON.stringify({ error: 'Tool result could not be serialized' })
  }
}

/**
 * The bounded tool-use loop. A run may only end through `finish`, so every exit
 * carries a stop reason the caller can record and act on.
 */
export async function runAgentLoop(input: RunAgentLoopInput): Promise<AgentLoopResult> {
  // Local copy: the caller's assembled context must survive this run unmutated.
  const messages = [...input.messages]
  // The allowlist. A tool the caller did not pass is not callable, whatever the model asks for.
  const toolsByName = new Map(input.tools.map(tool => [tool.definition.name, tool]))
  const controller = new AbortController()
  // `timedOut` distinguishes our own deadline from a caller cancellation; both abort the
  // same controller, so the flag is the only way to tell them apart afterwards.
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort(new Error('Agent run timed out'))
  }, input.limits.maxMs)

  const cancel = () => controller.abort(input.signal?.reason)
  input.signal?.addEventListener('abort', cancel, { once: true })

  let steps = 0
  let inputTokens = 0
  let outputTokens = 0
  let costMicros = 0
  const repairedToolErrors = new Set<string>()

  const finish = (
    stopReason: AgentStopReason,
    terminalToolResult?: unknown,
  ): AgentLoopResult => ({
    messages,
    stopReason,
    steps,
    inputTokens,
    outputTokens,
    costMicros,
    terminalToolResult,
  })

  try {
    while (true) {
      // Step 1 · budget gate. Checked before spending anything, so an exhausted run
      // cannot buy one more model call on its way out.
      if (input.signal?.aborted) return finish('cancelled')
      if (timedOut) return finish('timeout')
      if (steps >= input.limits.maxSteps) return finish('max_steps')
      if (inputTokens + outputTokens >= input.limits.maxTokens) return finish('max_tokens')
      if (costMicros >= input.limits.maxCostMicros) return finish('max_cost')

      // Step 2 · call the model. Counted before the call, so a provider that hangs or
      // throws still consumes a step and cannot be retried forever.
      steps += 1
      const modelStartedAt = new Date()
      let response
      try {
        response = await input.model.generate({
          messages,
          tools: input.tools.map(tool => tool.definition),
          signal: controller.signal,
        })
      } catch (error) {
        const endedAt = new Date()
        await input.trace.recordSpan(input.context.runId, {
          kind: 'model_call',
          name: input.model.id,
          error: normalizedAgentError(error),
          startedAt: modelStartedAt,
          endedAt,
        })
        // An aborted call surfaces as a provider error; report why we aborted, not that.
        if (timedOut) return finish('timeout')
        if (input.signal?.aborted) return finish('cancelled')
        return finish('error')
      }

      // Step 3 · account for what the call cost, then record the span.
      inputTokens += response.usage?.inputTokens ?? 0
      outputTokens += response.usage?.outputTokens ?? 0
      costMicros += response.usage?.costMicros ?? 0
      await input.trace.recordSpan(input.context.runId, {
        kind: 'model_call',
        name: input.model.id,
        input: { messageCount: messages.length, toolNames: [...toolsByName.keys()] },
        output: { text: response.text, toolCalls: response.toolCalls },
        startedAt: modelStartedAt,
        endedAt: new Date(),
        inputTokens: response.usage?.inputTokens,
        outputTokens: response.usage?.outputTokens,
        costMicros: response.usage?.costMicros,
      })

      // Step 4 · append the turn before any early return, so a run that stops on budget
      // still leaves a transcript the next run can resume from.
      if (response.text || response.toolCalls.length > 0) {
        messages.push({
          role: 'assistant',
          content: response.text ?? '',
          toolCalls: response.toolCalls,
        })
      }

      // Step 5 · stop conditions. Re-check the spend budgets now that this call is
      // accounted for: overspending should not also buy the tool calls it asked for.
      if (inputTokens + outputTokens > input.limits.maxTokens) return finish('max_tokens')
      if (costMicros > input.limits.maxCostMicros) return finish('max_cost')
      // No tool call means the model has nothing left to do. This is the healthy exit.
      if (response.toolCalls.length === 0) return finish('natural')

      // Step 6 · dispatch tools.
      for (const call of response.toolCalls) {
        const tool = toolsByName.get(call.name)
        const startedAt = new Date()
        // A hallucinated tool name means the model is working from an assumption we did
        // not give it. End the run rather than let it improvise around a rejection.
        if (!tool) {
          const error = new AgentGuardrailError(
            'TOOL_NOT_ALLOWED',
            `Tool "${call.name}" is not available in this run`,
          )
          await input.trace.recordSpan(input.context.runId, {
            kind: 'policy_check',
            name: 'tool_allowlist',
            input: call,
            error: normalizedAgentError(error),
            startedAt,
            endedAt: new Date(),
          })
          return finish('guardrail')
        }

        try {
          const result = await tool.execute(call.input, {
            ...input.context,
            signal: controller.signal,
          })
          await input.trace.recordSpan(input.context.runId, {
            kind: 'tool_call',
            name: call.name,
            input: call.input,
            output: result,
            startedAt,
            endedAt: new Date(),
          })
          messages.push({
            role: 'tool',
            toolCallId: call.id,
            content: jsonForMessage(result),
          })
          // A terminal tool is the run's whole purpose (a Decision Packet). Once it lands
          // there is nothing more to reason about, so stop instead of paying for a wrap-up turn.
          if (tool.terminal) return finish('terminal_tool', result)
        } catch (error) {
          const normalized = normalizedAgentError(error)
          await input.trace.recordSpan(input.context.runId, {
            kind: error instanceof AgentGuardrailError ? 'policy_check' : 'tool_call',
            name: call.name,
            input: call.input,
            error: normalized,
            startedAt,
            endedAt: new Date(),
          })
          // The model is told what failed so it can adapt; a retryable failure (a flaky
          // provider) earns another turn, a rule violation does not.
          messages.push({
            role: 'tool',
            toolCallId: call.id,
            content: jsonForMessage({ error: normalized }),
          })
          if (normalized.retryable) continue
          // A malformed draft has no side effect and can be safely repaired once.
          // This is distinct from provider retryability: execution still treats an
          // invalid payload as final, while the bounded model loop gets one chance
          // to return a schema-valid proposal.
          if (normalized.code === 'ACTION_PAYLOAD_INVALID' && !repairedToolErrors.has(normalized.code)) {
            repairedToolErrors.add(normalized.code)
            continue
          }
          return finish('guardrail')
        }
      }
    }
  } finally {
    // Runs exit from many places; the timer and listener are released from exactly one.
    clearTimeout(timeout)
    input.signal?.removeEventListener('abort', cancel)
  }
}
