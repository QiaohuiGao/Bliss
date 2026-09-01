import { describe, expect, it } from 'bun:test'
import { AgentGuardrailError } from '../errors'
import {
  withThreadRunLease,
  type ThreadRunLease,
  type ThreadRunLeaseStore,
} from './run-lease'

class MemoryLeaseStore implements ThreadRunLeaseStore {
  active: ThreadRunLease | null = null
  released: ThreadRunLease[] = []

  async acquire(lease: ThreadRunLease) {
    if (this.active) return false
    this.active = lease
    return true
  }

  async release(lease: ThreadRunLease) {
    if (this.active?.leaseId === lease.leaseId) this.active = null
    this.released.push(lease)
  }
}

describe('question thread run lease', () => {
  it('holds one lease for the complete agent operation and releases it', async () => {
    const store = new MemoryLeaseStore()
    const result = await withThreadRunLease(
      store,
      {
        weddingId: 'wedding-1',
        threadId: 'thread-1',
        ttlMs: 45_000,
        createLeaseId: () => 'lease-1',
      },
      async () => {
        expect(store.active).toEqual({
          weddingId: 'wedding-1',
          threadId: 'thread-1',
          ttlMs: 45_000,
          leaseId: 'lease-1',
        })
        return 'complete'
      },
    )

    expect(result).toBe('complete')
    expect(store.active).toBeNull()
    expect(store.released).toHaveLength(1)
  })

  it('rejects a concurrent run as a retryable conflict', async () => {
    const store = new MemoryLeaseStore()
    store.active = {
      weddingId: 'wedding-1',
      threadId: 'thread-1',
      ttlMs: 45_000,
      leaseId: 'existing-lease',
    }

    const error = await withThreadRunLease(
      store,
      {
        weddingId: 'wedding-1',
        threadId: 'thread-1',
        createLeaseId: () => 'competing-lease',
      },
      async () => 'should not run',
    ).catch(caught => caught)

    expect(error).toBeInstanceOf(AgentGuardrailError)
    expect((error as AgentGuardrailError).code).toBe('THREAD_RUN_IN_PROGRESS')
    expect((error as AgentGuardrailError).retryable).toBe(true)
    expect(store.released).toHaveLength(0)
  })

  it('releases the lease when the agent operation fails', async () => {
    const store = new MemoryLeaseStore()
    const error = await withThreadRunLease(
      store,
      {
        weddingId: 'wedding-1',
        threadId: 'thread-1',
        createLeaseId: () => 'lease-1',
      },
      async () => {
        throw new Error('model failed')
      },
    ).catch(caught => caught)

    expect(error).toEqual(new Error('model failed'))
    expect(store.active).toBeNull()
    expect(store.released).toHaveLength(1)
  })
})
