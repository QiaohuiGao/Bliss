import { and, eq, sql } from 'drizzle-orm'
import { db } from '../../db'
import { threadRunLeases } from '../../db/schema'
import type { ThreadRunLease, ThreadRunLeaseStore } from './run-lease'

/**
 * The upsert is the lock boundary: PostgreSQL permits the update only when the
 * existing lease has expired. Comparing against CURRENT_TIMESTAMP keeps lease
 * ownership correct across API instances whose system clocks may differ.
 */
export class DatabaseThreadRunLeaseStore implements ThreadRunLeaseStore {
  async acquire(lease: ThreadRunLease): Promise<boolean> {
    const expiresAt = sql`CURRENT_TIMESTAMP + (${lease.ttlMs} * INTERVAL '1 millisecond')`
    const [acquired] = await db
      .insert(threadRunLeases)
      .values({
        threadId: lease.threadId,
        weddingId: lease.weddingId,
        leaseId: lease.leaseId,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: threadRunLeases.threadId,
        set: {
          weddingId: lease.weddingId,
          leaseId: lease.leaseId,
          expiresAt,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
        setWhere: sql`${threadRunLeases.expiresAt} <= CURRENT_TIMESTAMP`,
      })
      .returning({ leaseId: threadRunLeases.leaseId })
    return acquired?.leaseId === lease.leaseId
  }

  async release(lease: ThreadRunLease): Promise<void> {
    await db
      .delete(threadRunLeases)
      .where(and(
        eq(threadRunLeases.threadId, lease.threadId),
        eq(threadRunLeases.weddingId, lease.weddingId),
        eq(threadRunLeases.leaseId, lease.leaseId),
      ))
  }
}
