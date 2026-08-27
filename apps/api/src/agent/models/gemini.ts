import { AgentGuardrailError } from '../errors'
import type {
  AgentMessage,
  AgentModel,
  AgentModelResult,
  AgentToolCall,
  AgentToolDefinition,
} from '../types'

interface GeminiPart {
  text?: string
  thoughtSignature?: string
  functionCall?: {
    name?: string
    args?: unknown
  }
  functionResponse?: {
    name: string
    response: Record<string, unknown>
  }
}

interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] }
    finishReason?: string
  }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
  }
  error?: { message?: string }
}

export type GeminiFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

function toolNameFor(messages: AgentMessage[], toolCallId?: string) {
  if (!toolCallId) return ''
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const call = messages[index]?.toolCalls?.find(item => item.id === toolCallId)
    if (call) return call.name
  }
  return ''
}

function parseToolResponse(content: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(content) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return { result: parsed }
  } catch {
    return { result: content }
  }
}

function appendContent(contents: GeminiContent[], content: GeminiContent) {
  const previous = contents.at(-1)
  if (previous?.role === content.role) {
    previous.parts.push(...content.parts)
    return
  }
  contents.push(content)
}

export function toGeminiContents(messages: AgentMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = []

  for (const message of messages.filter(item => item.role !== 'system')) {
    if (message.role === 'tool') {
      const name = toolNameFor(messages, message.toolCallId)
      appendContent(contents, {
        role: 'user',
        parts: [{
          functionResponse: {
            name,
            response: parseToolResponse(message.content),
          },
        }],
      })
      continue
    }

    const parts: GeminiPart[] = []
    if (message.content) parts.push({ text: message.content })
    for (const call of message.toolCalls ?? []) {
      parts.push({
        functionCall: {
          name: call.name,
          args: call.input,
        },
        ...(call.providerContext?.geminiThoughtSignature
          ? { thoughtSignature: call.providerContext.geminiThoughtSignature }
          : {}),
      })
    }
    if (parts.length === 0) continue

    appendContent(contents, {
      role: message.role === 'assistant' ? 'model' : 'user',
      parts,
    })
  }

  return contents
}

function toGeminiTools(tools: AgentToolDefinition[]) {
  if (tools.length === 0) return undefined
  return [{
    functionDeclarations: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parametersJsonSchema: tool.inputSchema,
    })),
  }]
}

export class GeminiAgentModel implements AgentModel {
  readonly id: string

  constructor(private readonly config: {
    apiKey: string
    model: string
    maxOutputTokens?: number
    maxAttempts?: number
    baseUrl?: string
    fetcher?: GeminiFetch
  }) {
    this.id = `gemini:${config.model}`
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
    const baseUrl = this.config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta'
    const model = encodeURIComponent(this.config.model)
    const fetcher = this.config.fetcher ?? fetch
    const request = {
      method: 'POST',
      signal: input.signal,
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': this.config.apiKey,
      },
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: toGeminiContents(input.messages),
        tools: toGeminiTools(input.tools),
        generationConfig: {
          maxOutputTokens: this.config.maxOutputTokens ?? 2_048,
        },
      }),
    } satisfies RequestInit

    const maxAttempts = Math.min(Math.max(this.config.maxAttempts ?? 2, 1), 3)
    let body: GeminiResponse | undefined
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const response = await fetcher(`${baseUrl}/models/${model}:generateContent`, request)
      try {
        body = await response.json() as GeminiResponse
      } catch {
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500
        if (retryable && attempt < maxAttempts) continue
        throw new AgentGuardrailError(
          `MODEL_HTTP_${response.status}`,
          'Gemini returned an invalid response',
          retryable,
        )
      }

      if (response.ok) break
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500
      if (retryable && attempt < maxAttempts) continue
      throw new AgentGuardrailError(
        `MODEL_HTTP_${response.status}`,
        body.error?.message ?? `Model request failed with status ${response.status}`,
        retryable,
      )
    }

    if (!body) {
      throw new AgentGuardrailError('MODEL_EMPTY_RESPONSE', 'Gemini returned no response', true)
    }

    const parts = body.candidates?.[0]?.content?.parts ?? []
    const toolCalls: AgentToolCall[] = parts
      .filter(part => part.functionCall)
      .map(part => ({
        id: crypto.randomUUID(),
        name: part.functionCall?.name ?? '',
        input: part.functionCall?.args ?? {},
        ...(part.thoughtSignature
          ? { providerContext: { geminiThoughtSignature: part.thoughtSignature } }
          : {}),
      }))

    return {
      text: parts.filter(part => typeof part.text === 'string').map(part => part.text).join('\n'),
      toolCalls,
      usage: {
        inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
      },
    }
  }
}
