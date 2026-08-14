import { describe, expect, it } from 'bun:test'
import { S3CompatibleMediaUploadProvider } from './media-upload'

function provider(fetcher?: typeof fetch) {
  return new S3CompatibleMediaUploadProvider({
    endpoint: 'https://account.r2.cloudflarestorage.com',
    bucket: 'bliss-media',
    region: 'auto',
    accessKeyId: 'test-access-key',
    secretAccessKey: 'never-return-this-secret',
    keyPrefix: 'uploads',
    now: () => new Date('2026-08-13T12:34:56.000Z'),
    fetcher,
  })
}

describe('S3-compatible media upload provider', () => {
  it('creates a short-lived wedding-scoped signed PUT without exposing the secret', async () => {
    const grant = await provider().createUploadGrant({
      intentId: 'intent-1',
      weddingId: 'wedding-1',
      purpose: 'moment',
      contentType: 'image/jpeg',
      sizeBytes: 2_000_000,
      originalFilename: 'our fitting.jpg',
    })

    expect(grant.objectKey).toBe('uploads/weddings/wedding-1/moment/intent-1.jpg')
    expect(grant.uploadHeaders).toEqual({
      'content-type': 'image/jpeg',
      'if-none-match': '*',
    })
    expect(grant.expiresAt.toISOString()).toBe('2026-08-13T12:49:56.000Z')

    const url = new URL(grant.uploadUrl)
    expect(url.pathname).toBe('/bliss-media/uploads/weddings/wedding-1/moment/intent-1.jpg')
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256')
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900')
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-type;host;if-none-match')
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[a-f0-9]{64}$/)
    expect(grant.uploadUrl).not.toContain('never-return-this-secret')
  })

  it('issues a short-lived private read URL only inside the same wedding scope', async () => {
    const grant = await provider().createReadGrant({
      weddingId: 'wedding-1',
      objectKey: 'uploads/weddings/wedding-1/moment/intent-1.jpg',
    })
    const url = new URL(grant.url)
    expect(url.pathname).toBe('/bliss-media/uploads/weddings/wedding-1/moment/intent-1.jpg')
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300')
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host')
    expect(grant.expiresAt.toISOString()).toBe('2026-08-13T12:39:56.000Z')

    await expect(provider().createReadGrant({
      weddingId: 'wedding-2',
      objectKey: 'uploads/weddings/wedding-1/moment/intent-1.jpg',
    })).rejects.toMatchObject({ code: 'MEDIA_OBJECT_OUT_OF_SCOPE' })
  })

  it('uses distinct object extensions and signatures for each allowed content type', async () => {
    const png = await provider().createUploadGrant({
      intentId: 'intent-2',
      weddingId: 'wedding-1',
      purpose: 'moment',
      contentType: 'image/png',
      sizeBytes: 100,
      originalFilename: 'comparison.png',
    })
    const webp = await provider().createUploadGrant({
      intentId: 'intent-2',
      weddingId: 'wedding-1',
      purpose: 'moment',
      contentType: 'image/webp',
      sizeBytes: 100,
      originalFilename: 'comparison.webp',
    })
    expect(png.objectKey).toEndWith('.png')
    expect(webp.objectKey).toEndWith('.webp')
    expect(new URL(png.uploadUrl).searchParams.get('X-Amz-Signature'))
      .not.toBe(new URL(webp.uploadUrl).searchParams.get('X-Amz-Signature'))
  })

  it('rejects files above the configured limit before issuing a storage grant', async () => {
    await expect(provider().createUploadGrant({
      intentId: 'intent-3',
      weddingId: 'wedding-1',
      purpose: 'moment',
      contentType: 'image/jpeg',
      sizeBytes: 11 * 1024 * 1024,
      originalFilename: 'huge.jpg',
    })).rejects.toMatchObject({ code: 'MEDIA_SIZE_NOT_ALLOWED' })
  })

  it('deletes only a same-wedding private object and treats a missing object as deleted', async () => {
    const calls: Array<{ url: string; method: string | undefined }> = []
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), method: init?.method })
      return new Response(null, { status: 404 })
    }) as typeof fetch
    await provider(fetcher).deleteObject({
      weddingId: 'wedding-1',
      objectKey: 'uploads/weddings/wedding-1/moment/intent-1.jpg',
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.method).toBe('DELETE')
    expect(new URL(calls[0]!.url).searchParams.get('X-Amz-SignedHeaders')).toBe('host')

    await expect(provider(fetcher).deleteObject({
      weddingId: 'wedding-2',
      objectKey: 'uploads/weddings/wedding-1/moment/intent-1.jpg',
    })).rejects.toMatchObject({ code: 'MEDIA_OBJECT_OUT_OF_SCOPE' })
    expect(calls).toHaveLength(1)
  })
})
