import { describe, expect, it } from 'bun:test'
import { configuredWebOrigins } from './cors'

describe('configured web origins', () => {
  it('allows only the stable production origin and explicitly listed previews', () => {
    expect(configuredWebOrigins({
      NODE_ENV: 'production',
      WEB_URL: 'https://bliss.example',
      WEB_PREVIEW_URLS: 'https://preview-one.example, https://preview-two.example/',
    })).toEqual([
      'https://bliss.example',
      'https://preview-one.example',
      'https://preview-two.example',
    ])
  })

  it('rejects insecure or path-bearing production values', () => {
    expect(configuredWebOrigins({
      NODE_ENV: 'production',
      WEB_URL: 'https://bliss.example',
      WEB_PREVIEW_URLS: 'http://unsafe.example,https://safe.example/path',
    })).toEqual(['https://bliss.example'])
  })

  it('adds local development origins without duplicates', () => {
    expect(configuredWebOrigins({ WEB_URL: 'http://localhost:3000' })).toEqual([
      'http://localhost:3000',
      'http://localhost:19006',
    ])
  })
})
