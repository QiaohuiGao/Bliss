import { ZodError } from 'zod'

export interface PublicHttpError {
  statusCode: number
  body: { error: string; code: string }
  shouldLog: boolean
}

export function publicHttpError(error: unknown): PublicHttpError {
  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      body: { error: 'Request data is invalid', code: 'INVALID_REQUEST' },
      shouldLog: false,
    }
  }
  if (error instanceof SyntaxError) {
    return {
      statusCode: 400,
      body: { error: 'Request JSON is malformed', code: 'MALFORMED_JSON' },
      shouldLog: false,
    }
  }
  const candidate = error as { statusCode?: unknown; message?: unknown; code?: unknown }
  if (
    typeof candidate?.statusCode === 'number'
    && candidate.statusCode >= 400
    && candidate.statusCode < 500
  ) {
    return {
      statusCode: candidate.statusCode,
      body: {
        error: typeof candidate.message === 'string' ? candidate.message : 'Request failed',
        code: typeof candidate.code === 'string' ? candidate.code : 'REQUEST_FAILED',
      },
      shouldLog: false,
    }
  }
  return {
    statusCode: 500,
    body: { error: 'Internal Server Error', code: 'INTERNAL_SERVER_ERROR' },
    shouldLog: true,
  }
}
