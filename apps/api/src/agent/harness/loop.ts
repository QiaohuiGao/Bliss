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

export async function runAgentLoop(input: RunAgentLoopInput): Promise<AgentLoopResult> {
  const messages = [...input.messages]
  const toolsByName = new Map(input.tools.map(tool => [tool.definition.name, tool]))
  const controller = new AbortController()
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
      if (input.signal?.aborted) return finish('cancelled')
      if (timedOut) return finish('timeout')
      if (steps >= input.limits.maxSteps) return finish('max_steps')
      if (inputTokens + outputTokens >= input.limits.maxTokens) return finish('max_tokens')
      if (costMicros >= input.limits.maxCostMicros) return finish('max_cost')

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
        if (timedOut) return finish('timeout')
        if (input.signal?.aborted) return finish('cancelled')
        return finish('error')
      }

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

      if (response.text || response.toolCalls.length > 0) {
        messages.push({
          role: 'assistant',
          content: response.text ?? '',
          toolCalls: response.toolCalls,
        })
      }

      if (inputTokens + outputTokens > input.limits.maxTokens) return finish('max_tokens')
      if (costMicros > input.limits.maxCostMicros) return finish('max_cost')
      if (response.toolCalls.length === 0) return finish('natural')

      for (const call of response.toolCalls) {
        const tool = toolsByName.get(call.name)
        const startedAt = new Date()
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
          messages.push({
            role: 'tool',
            toolCallId: call.id,
            content: jsonForMessage({ error: normalized }),
          })
          if (!normalized.retryable) return finish('guardrail')
        }
      }
    }
  } finally {
    clearTimeout(timeout)
    input.signal?.removeEventListener('abort', cancel)
  }
}
