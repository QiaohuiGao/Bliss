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
