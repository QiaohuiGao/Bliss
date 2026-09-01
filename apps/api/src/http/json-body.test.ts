import { describe, expect, it } from 'bun:test'
import { parseJsonRequestBody } from './json-body'

describe('JSON request body parsing', () => {
  it('accepts an empty JSON request as an empty object', () => {
    expect(parseJsonRequestBody('')).toEqual({})
    expect(parseJsonRequestBody('  ')).toEqual({})
  })

  it('parses valid JSON and still rejects malformed content', () => {
    expect(parseJsonRequestBody('{"answer":true}')).toEqual({ answer: true })
    expect(() => parseJsonRequestBody('{"answer":')).toThrow()
  })
})
