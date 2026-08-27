import { strict as assert } from 'node:assert'
import { configuredAgentModel } from '../src/agent/models/configured'
import {
  decisionPacketJsonSchema,
  decisionPacketSchema,
  type AgentMessage,
  type AgentToolDefinition,
} from '../src/agent/types'

const model = configuredAgentModel()
assert.ok(model, 'Agent model is not configured')

const tools: AgentToolDefinition[] = [
  {
    name: 'get_test_context',
    description: 'Read the synthetic integration-test context before proposing.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  },
  {
    name: 'propose_decision',
    description: 'Return the exact synthetic Decision Packet from the test context.',
    inputSchema: decisionPacketJsonSchema,
  },
]

const messages: AgentMessage[] = [
  {
    role: 'system',
    content: 'This is a provider protocol check with synthetic data. First call get_test_context. After its response, call propose_decision with packetTemplate exactly. Do not add facts or prose.',
  },
  { role: 'user', content: 'Run the synthetic protocol check.' },
]

const first = await model.generate({
  messages,
  tools,
  signal: new AbortController().signal,
})
assert.equal(first.toolCalls.length, 1)
assert.equal(first.toolCalls[0]?.name, 'get_test_context')

const packetTemplate = {
  schemaVersion: 1 as const,
  threadId: 'synthetic-thread',
  questKey: 'foundation',
  questionKey: 'foundation.synthetic',
  state: 'ready' as const,
  summary: 'The synthetic couple chose the shared option.',
  proposedChoice: 'shared',
  reason: 'This verifies the model provider protocol.',
  alternativesConsidered: [],
  memberInputs: [{
    memberId: 'synthetic-member',
    stance: 'shared',
    reason: 'This verifies the model provider protocol.',
    sourceMessageIds: ['synthetic-message'],
  }],
  taskEffects: [],
  memoryEffects: [],
  externalActions: [],
  vendorEffects: [],
  momentCandidate: null,
}
const toolCall = first.toolCalls[0]!
const secondMessages: AgentMessage[] = [
  ...messages,
  { role: 'assistant', content: first.text ?? '', toolCalls: first.toolCalls },
  {
    role: 'tool',
    toolCallId: toolCall.id,
    content: JSON.stringify({ packetTemplate }),
  },
]
const second = await model.generate({
  messages: secondMessages,
  tools,
  signal: new AbortController().signal,
})
assert.equal(second.toolCalls.length, 1)
assert.equal(second.toolCalls[0]?.name, 'propose_decision')
assert.deepEqual(decisionPacketSchema.parse(second.toolCalls[0]?.input), packetTemplate)

console.log('PASS: real model provider tool-calling smoke test')
console.log(`  model: ${model.id}`)
console.log(`  turns: 2`)
console.log(`  tokens: ${(first.usage?.inputTokens ?? 0) + (second.usage?.inputTokens ?? 0)} input, ${(first.usage?.outputTokens ?? 0) + (second.usage?.outputTokens ?? 0)} output`)
