import { AgentGuardrailError } from '../errors'

const DEFAULT_LEASE_MS = 120_000

export interface ThreadRunLease {
  threadId: string
  weddingId: string
  leaseId: string
  ttlMs: number
}

export interface ThreadRunLeaseStore {
  acquire(lease: ThreadRunLease): Promise<boolean>
  release(lease: ThreadRunLease): Promise<void>
}

export interface WithThreadRunLeaseOptions {
  threadId: string
  weddingId: string
  ttlMs?: number
  createLeaseId?: () => string
}

/**
 * Runs one agent turn while owning the permanent question thread's lease.
 * A duplicate request fails fast and is retryable instead of producing two
 * assistant replies or competing decision proposals from the same history.
 */
export async function withThreadRunLease<T>(
  store: ThreadRunLeaseStore,
  options: WithThreadRunLeaseOptions,
  operation: () => Promise<T>,
): Promise<T> {
  const lease: ThreadRunLease = {
    threadId: options.threadId,
    weddingId: options.weddingId,
    leaseId: options.createLeaseId?.() ?? crypto.randomUUID(),
    ttlMs: options.ttlMs ?? DEFAULT_LEASE_MS,
  }
  if (!await store.acquire(lease)) {
    throw new AgentGuardrailError(
      'THREAD_RUN_IN_PROGRESS',
      'This planning question already has an agent run in progress',
      true,
    )
  }

  try {
    return await operation()
  } finally {
    await store.release(lease)
  }
}
