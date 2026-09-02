import { z } from 'zod'

export const decisionStateSchema = z.enum(['contested', 'ready'])

export const proposedTaskSchema = z.object({
  taskKey: z.string().min(1),
  rationale: z.string().min(1),
})

export const proposedMemoryClaimSchema = z.object({
  subjectType: z.enum(['wedding', 'couple', 'member']),
  subjectId: z.string().nullable().default(null),
  kind: z.enum(['fact', 'preference', 'priority', 'constraint', 'ruled_out']),
  key: z.string().min(1),
  value: z.unknown(),
  source: z.enum(['explicit', 'inferred', 'decision']),
  confidenceBasisPoints: z.number().int().min(0).max(10_000),
  evidenceMessageIds: z.array(z.string()).min(1),
})

export const proposedExternalActionSchema = z.object({
  kind: z.enum(['draft_email', 'send_email', 'calendar_event', 'reminder', 'vendor_shortlist']),
  payload: z.record(z.string(), z.unknown()),
  requiresApproval: z.literal(true),
})

export const proposedMomentSchema = z.object({
  title: z.string().min(1),
  narrative: z.string().min(1),
  sourceMessageIds: z.array(z.string()),
})

export const proposedVendorSchema = z.object({
  candidateId: z.string().min(1),
  rationale: z.string().min(1),
  pros: z.array(z.string().min(1)).max(4),
  concerns: z.array(z.string().min(1)).max(4),
})

export const decisionPacketSchema = z.object({
  schemaVersion: z.literal(1),
  threadId: z.string().min(1),
  questKey: z.string().min(1),
  questionKey: z.string().min(1),
  state: decisionStateSchema,
  summary: z.string().min(1),
  proposedChoice: z.string().nullable(),
  customChoice: z.string().trim().min(1).max(2_000).nullable().optional(),
  reason: z.string().nullable(),
  alternativesConsidered: z.array(z.object({
    value: z.string().min(1),
    tradeoff: z.string().min(1),
  })).max(4),
  memberInputs: z.array(z.object({
    memberId: z.string().min(1),
    stance: z.string().min(1),
    reason: z.string().nullable(),
    sourceMessageIds: z.array(z.string()).min(1),
  })).max(2),
  taskEffects: z.array(proposedTaskSchema).max(8),
  memoryEffects: z.array(proposedMemoryClaimSchema).max(12),
  externalActions: z.array(proposedExternalActionSchema).max(4),
  vendorEffects: z.array(proposedVendorSchema).max(5).default([]),
  momentCandidate: proposedMomentSchema.nullable(),
})

export type DecisionPacket = z.infer<typeof decisionPacketSchema>
export type ProposedTask = z.infer<typeof proposedTaskSchema>
export type ProposedMemoryClaim = z.infer<typeof proposedMemoryClaimSchema>
export type ProposedExternalAction = z.infer<typeof proposedExternalActionSchema>
export type ProposedMoment = z.infer<typeof proposedMomentSchema>
export type ProposedVendor = z.infer<typeof proposedVendorSchema>

const nullableStringJsonSchema = { type: 'string', nullable: true }

export const decisionPacketJsonSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion', 'threadId', 'questKey', 'questionKey', 'state',
    'summary', 'proposedChoice', 'reason', 'alternativesConsidered',
    'memberInputs', 'taskEffects', 'memoryEffects', 'externalActions',
    'vendorEffects', 'momentCandidate',
  ],
  properties: {
    schemaVersion: { type: 'integer', enum: [1] },
    threadId: { type: 'string', minLength: 1 },
    questKey: { type: 'string', minLength: 1 },
    questionKey: { type: 'string', minLength: 1 },
    state: { type: 'string', enum: ['contested', 'ready'] },
    summary: { type: 'string', minLength: 1 },
    proposedChoice: nullableStringJsonSchema,
    customChoice: { type: 'string', nullable: true, minLength: 1, maxLength: 2_000 },
    reason: nullableStringJsonSchema,
    alternativesConsidered: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['value', 'tradeoff'],
        properties: {
          value: { type: 'string', minLength: 1 },
          tradeoff: { type: 'string', minLength: 1 },
        },
      },
    },
    memberInputs: {
      type: 'array',
      maxItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['memberId', 'stance', 'reason', 'sourceMessageIds'],
        properties: {
          memberId: { type: 'string', minLength: 1 },
          stance: { type: 'string', minLength: 1 },
          reason: nullableStringJsonSchema,
          sourceMessageIds: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    taskEffects: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['taskKey', 'rationale'],
        properties: {
          taskKey: { type: 'string', minLength: 1 },
          rationale: { type: 'string', minLength: 1 },
        },
      },
    },
    memoryEffects: {
      type: 'array',
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'subjectType', 'subjectId', 'kind', 'key', 'value', 'source',
          'confidenceBasisPoints', 'evidenceMessageIds',
        ],
        properties: {
          subjectType: { type: 'string', enum: ['wedding', 'couple', 'member'] },
          subjectId: nullableStringJsonSchema,
          kind: { type: 'string', enum: ['fact', 'preference', 'priority', 'constraint', 'ruled_out'] },
          key: { type: 'string', minLength: 1 },
          value: { type: 'string', description: 'The concise fact or preference to remember.' },
          source: { type: 'string', enum: ['explicit', 'inferred', 'decision'] },
          confidenceBasisPoints: { type: 'integer', minimum: 0, maximum: 10_000 },
          evidenceMessageIds: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    externalActions: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'payload', 'requiresApproval'],
        properties: {
          kind: {
            type: 'string',
            enum: ['draft_email', 'send_email', 'calendar_event', 'reminder', 'vendor_shortlist'],
          },
          payload: { type: 'object' },
          requiresApproval: { type: 'boolean', enum: [true] },
        },
      },
    },
    vendorEffects: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['candidateId', 'rationale', 'pros', 'concerns'],
        properties: {
          candidateId: { type: 'string', minLength: 1 },
          rationale: { type: 'string', minLength: 1 },
          pros: {
            type: 'array',
            maxItems: 4,
            items: { type: 'string', minLength: 1 },
          },
          concerns: {
            type: 'array',
            maxItems: 4,
            items: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    momentCandidate: {
      type: 'object',
      nullable: true,
      additionalProperties: false,
      required: ['title', 'narrative', 'sourceMessageIds'],
      properties: {
        title: { type: 'string', minLength: 1 },
        narrative: { type: 'string', minLength: 1 },
        sourceMessageIds: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
        },
      },
    },
  },
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  toolCalls?: AgentToolCall[]
}

export interface AgentToolCall {
  id: string
  name: string
  input: unknown
  /** Opaque single-run provider state. Never persist or expose this to tools. */
  providerContext?: {
    geminiThoughtSignature?: string
  }
}

export interface AgentModelResult {
  text?: string
  toolCalls: AgentToolCall[]
  usage?: {
    inputTokens: number
    outputTokens: number
    costMicros?: number
  }
}

export interface AgentModel {
  readonly id: string
  generate(input: {
    messages: AgentMessage[]
    tools: AgentToolDefinition[]
    signal: AbortSignal
  }): Promise<AgentModelResult>
}

export interface AgentToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface AgentTool {
  definition: AgentToolDefinition
  terminal?: boolean
  parallelSafe?: boolean
  execute(input: unknown, context: AgentToolContext): Promise<unknown>
}

export interface AgentToolContext {
  runId: string
  weddingId: string
  userId: string
  threadId: string
  signal?: AbortSignal
}

export type AgentStopReason =
  | 'natural'
  | 'terminal_tool'
  | 'max_steps'
  | 'max_tokens'
  | 'max_cost'
  | 'timeout'
  | 'cancelled'
  | 'guardrail'
  | 'error'

export interface AgentSpanRecord {
  parentSpanId?: string
  kind: 'model_call' | 'tool_call' | 'policy_check' | 'retrieval'
  name: string
  input?: unknown
  output?: unknown
  error?: { code: string; message: string; retryable: boolean }
  startedAt: Date
  endedAt: Date
  inputTokens?: number
  outputTokens?: number
  costMicros?: number
}

export interface AgentTraceSink {
  recordSpan(runId: string, span: AgentSpanRecord): Promise<void>
}
