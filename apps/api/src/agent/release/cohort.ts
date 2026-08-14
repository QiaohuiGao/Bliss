import { createHash } from 'node:crypto'

export function stickyReleaseBucket(weddingId: string, deploymentId: string): number {
  const digest = createHash('sha256').update(`${weddingId}:${deploymentId}`).digest()
  return digest.readUInt32BE(0) % 10_000
}
