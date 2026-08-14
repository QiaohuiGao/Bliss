import { AgentGuardrailError } from '../errors'
import type {
  AgentMessage,
  AgentModel,
  AgentModelResult,
  AgentToolDefinition,
} from '../types'

interface AnthropicContentBlock {
  type: 'text' | 'tool_use'
  text?: string
  id?: string
  name?: string
  input?: unknown
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[]
  usage?: { input_tokens?: number; output_tokens?: number }
  error?: { message?: string }
}

const toAnthropicTools = (tools: AgentToolDefinition[]) => tools.map(tool => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.inputSchema,
}))

function toAnthropicMessages(messages: AgentMessage[]) {
  const converted: Array<{ role: 'user' | 'assistant'; content: unknown }> = []

  for (const message of messages.filter(item => item.role !== 'system')) {
    if (message.role === 'tool') {
      converted.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: message.toolCallId,
          content: message.content,
        }],
      })
      continue
    }
    if (message.role === 'assistant' && message.toolCalls?.length) {
      converted.push({
        role: 'assistant',
        content: [
          ...(message.content ? [{ type: 'text', text: message.content }] : []),
          ...message.toolCalls.map(call => ({
            type: 'tool_use',
            id: call.id,
            name: call.name,
            input: call.input,
          })),
        ],
      })
      continue
    }
    converted.push({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content,
    })
  }

  return converted
}

export class AnthropicAgentModel implements AgentModel {
  readonly id: string

  constructor(private readonly config: {
    apiKey: string
    model: string
    maxOutputTokens?: number
    baseUrl?: string
  }) {
    this.id = `anthropic:${config.model}`
  }

  async generate(input: {
    messages: AgentMessage[]
    tools: AgentToolDefinition[]
    signal: AbortSignal
  }): Promise<AgentModelResult> {
    const system = input.messages
      .filter(message => message.role === 'system')
      .map(message => message.content)
      .join('\n\n')
    const response = await fetch(`${this.config.baseUrl ?? 'https://api.anthropic.com'}/v1/messages`, {
      method: 'POST',
      signal: input.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxOutputTokens ?? 2_048,
        system,
        messages: toAnthropicMessages(input.messages),
        tools: toAnthropicTools(input.tools),
      }),
    })

    const body = await response.json() as AnthropicResponse
    if (!response.ok) {
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500
      throw new AgentGuardrailError(
        `MODEL_HTTP_${response.status}`,
        body.error?.message ?? `Model request failed with status ${response.status}`,
        retryable,
      )
    }

    const blocks = body.content ?? []
    return {
      text: blocks.filter(block => block.type === 'text').map(block => block.text ?? '').join('\n'),
      toolCalls: blocks
        .filter(block => block.type === 'tool_use')
        .map(block => ({
          id: block.id ?? crypto.randomUUID(),
          name: block.name ?? '',
          input: block.input,
        })),
      usage: {
        inputTokens: body.usage?.input_tokens ?? 0,
        outputTokens: body.usage?.output_tokens ?? 0,
      },
    }
  }
}

export function configuredAgentModel(): AgentModel | null {
  const apiKey = process.env['ANTHROPIC_API_KEY']
  const model = process.env['ANTHROPIC_MODEL']
  if (!apiKey || !model) return null
  return new AnthropicAgentModel({ apiKey, model })
}
