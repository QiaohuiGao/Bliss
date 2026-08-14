export class AgentGuardrailError extends Error {
  readonly code: string
  readonly retryable: boolean

  constructor(code: string, message: string, retryable = false) {
    super(message)
    this.name = 'AgentGuardrailError'
    this.code = code
    this.retryable = retryable
  }
}

export function normalizedAgentError(error: unknown): {
  code: string
  message: string
  retryable: boolean
} {
  if (error instanceof AgentGuardrailError) {
    return { code: error.code, message: error.message, retryable: error.retryable }
  }
  if (error instanceof ZodError) {
    return {
      code: 'INVALID_TOOL_INPUT',
      message: 'Tool input did not match the required schema',
      retryable: false,
    }
  }
  if (error instanceof Error) {
    return { code: 'UNEXPECTED_ERROR', message: error.message, retryable: false }
  }
  return { code: 'UNEXPECTED_ERROR', message: String(error), retryable: false }
}
import { ZodError } from 'zod'
