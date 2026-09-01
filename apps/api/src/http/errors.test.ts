import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { publicHttpError } from './errors'

describe('public HTTP errors', () => {
  it('maps invalid user input to safe client errors', () => {
    const invalid = z.object({ name: z.string() }).safeParse({ name: 4 })
    if (invalid.success) throw new Error('Expected schema validation to fail')
    expect(publicHttpError(invalid.error)).toMatchObject({
      statusCode: 400,
      body: { code: 'INVALID_REQUEST' },
      shouldLog: false,
    })
    expect(publicHttpError(new SyntaxError('provider detail'))).toMatchObject({
      statusCode: 400,
      body: { code: 'MALFORMED_JSON' },
    })
  })

  it('does not expose unknown exception messages', () => {
    expect(publicHttpError(new Error('database password appeared here'))).toEqual({
      statusCode: 500,
      body: { error: 'Internal Server Error', code: 'INTERNAL_SERVER_ERROR' },
      shouldLog: true,
    })
  })
})
