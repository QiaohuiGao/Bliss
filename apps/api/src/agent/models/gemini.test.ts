import { describe, expect, it } from 'bun:test'
import { GeminiAgentModel, toGeminiContents } from './gemini'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('Gemini agent model', () => {
  it('maps system, tool declarations, function calls, and function responses', async () => {
    let request: Request | undefined
    const model = new GeminiAgentModel({
      apiKey: 'gemini-secret',
      model: 'gemini-test',
      baseUrl: 'https://gemini.bliss.test/v1beta',
      fetcher: async (input, init) => {
        request = input instanceof Request
          ? new Request(input, init)
          : new Request(input.toString(), init)
        return jsonResponse({
          candidates: [{
            content: {
              parts: [
                { text: 'I found the next step.' },
                {
                  functionCall: { name: 'propose_decision', args: { choice: 'garden' } },
                  thoughtSignature: 'opaque-signature',
                },
              ],
            },
          }],
          usageMetadata: { promptTokenCount: 42, candidatesTokenCount: 17 },
        })
      },
    })

    const result = await model.generate({
      messages: [
        { role: 'system', content: 'Be warm and precise.' },
        { role: 'user', content: 'We prefer natural light.' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'call-1', name: 'get_memory', input: { key: 'style' } }],
        },
        { role: 'tool', toolCallId: 'call-1', content: JSON.stringify({ value: 'garden' }) },
      ],
      tools: [{
        name: 'propose_decision',
        description: 'Create a proposal for confirmation.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: { choice: { type: 'string' } },
          required: ['choice'],
        },
      }],
      signal: new AbortController().signal,
    })

    expect(request?.url).toBe('https://gemini.bliss.test/v1beta/models/gemini-test:generateContent')
    expect(request?.headers.get('x-goog-api-key')).toBe('gemini-secret')
    expect(request?.url).not.toContain('gemini-secret')
    expect(await request?.json()).toEqual({
      systemInstruction: { parts: [{ text: 'Be warm and precise.' }] },
      contents: [
        { role: 'user', parts: [{ text: 'We prefer natural light.' }] },
        { role: 'model', parts: [{ functionCall: { name: 'get_memory', args: { key: 'style' } } }] },
        { role: 'user', parts: [{ functionResponse: { name: 'get_memory', response: { value: 'garden' } } }] },
      ],
      tools: [{
        functionDeclarations: [{
          name: 'propose_decision',
          description: 'Create a proposal for confirmation.',
          parametersJsonSchema: {
            type: 'object',
            additionalProperties: false,
            properties: { choice: { type: 'string' } },
            required: ['choice'],
          },
        }],
      }],
      generationConfig: { maxOutputTokens: 2_048 },
    })
    expect(result.text).toBe('I found the next step.')
    expect(result.toolCalls).toHaveLength(1)
    expect(result.toolCalls[0]).toMatchObject({
      name: 'propose_decision',
      input: { choice: 'garden' },
      providerContext: { geminiThoughtSignature: 'opaque-signature' },
    })
    expect(result.usage).toEqual({ inputTokens: 42, outputTokens: 17 })
  })

  it('returns Gemini thought signatures on the matching function call', () => {
    expect(toGeminiContents([{
      role: 'assistant',
      content: '',
      toolCalls: [{
        id: 'call-1',
        name: 'get_memory',
        input: { key: 'style' },
        providerContext: { geminiThoughtSignature: 'opaque-signature' },
      }],
    }])).toEqual([{
      role: 'model',
      parts: [{
        functionCall: { name: 'get_memory', args: { key: 'style' } },
        thoughtSignature: 'opaque-signature',
      }],
    }])
  })

  it('preserves primitive and malformed tool results safely', () => {
    expect(toGeminiContents([
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { id: 'call-1', name: 'first_tool', input: {} },
          { id: 'call-2', name: 'second_tool', input: {} },
        ],
      },
      { role: 'tool', toolCallId: 'call-1', content: 'true' },
      { role: 'tool', toolCallId: 'call-2', content: 'not-json' },
    ])).toEqual([
      {
        role: 'model',
        parts: [
          { functionCall: { name: 'first_tool', args: {} } },
          { functionCall: { name: 'second_tool', args: {} } },
        ],
      },
      {
        role: 'user',
        parts: [
          { functionResponse: { name: 'first_tool', response: { result: true } } },
          { functionResponse: { name: 'second_tool', response: { result: 'not-json' } } },
        ],
      },
    ])
  })

  it('classifies throttling as retryable without putting the key in the URL', async () => {
    let requestUrl = ''
    let requestCount = 0
    const model = new GeminiAgentModel({
      apiKey: 'gemini-secret',
      model: 'gemini-test',
      fetcher: async input => {
        requestCount += 1
        requestUrl = input.toString()
        return jsonResponse({ error: { message: 'Quota exceeded' } }, 429)
      },
    })

    await expect(model.generate({
      messages: [{ role: 'user', content: 'Hello' }],
      tools: [],
      signal: new AbortController().signal,
    })).rejects.toMatchObject({
      code: 'MODEL_HTTP_429',
      retryable: true,
      message: 'Quota exceeded',
    })
    expect(requestUrl).not.toContain('gemini-secret')
    expect(requestCount).toBe(2)
  })

  it('recovers from a transient provider failure', async () => {
    let requestCount = 0
    const model = new GeminiAgentModel({
      apiKey: 'gemini-secret',
      model: 'gemini-test',
      fetcher: async () => {
        requestCount += 1
        if (requestCount === 1) {
          return jsonResponse({ error: { message: 'Temporarily busy' } }, 503)
        }
        return jsonResponse({
          candidates: [{ content: { parts: [{ text: 'Recovered' }] } }],
        })
      },
    })

    const result = await model.generate({
      messages: [{ role: 'user', content: 'Hello' }],
      tools: [],
      signal: new AbortController().signal,
    })

    expect(result.text).toBe('Recovered')
    expect(requestCount).toBe(2)
  })
})
