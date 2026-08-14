import { and, asc, eq, lte } from 'drizzle-orm'
import { db } from '../../db'
import { activityFeed, scheduledTriggers } from '../../db/schema'

export async function fireDueReminders(now = new Date(), limit = 100): Promise<string[]> {
  const due = await db
    .select()
    .from(scheduledTriggers)
    .where(and(
      eq(scheduledTriggers.status, 'pending'),
      lte(scheduledTriggers.triggerAt, now),
    ))
    .orderBy(asc(scheduledTriggers.triggerAt))
    .limit(limit)

  const firedIds: string[] = []
  for (const trigger of due) {
    await db.transaction(async tx => {
      const [claimed] = await tx
        .update(scheduledTriggers)
        .set({
          status: 'fired',
          attempts: trigger.attempts + 1,
          firedAt: now,
        })
        .where(and(
          eq(scheduledTriggers.id, trigger.id),
          eq(scheduledTriggers.status, 'pending'),
        ))
        .returning({ id: scheduledTriggers.id })
      if (!claimed) return
      await tx.insert(activityFeed).values({
        weddingId: trigger.weddingId,
        action: 'reminder_due',
        targetType: 'external_action',
        targetId: trigger.externalActionId,
        metadata: trigger.payload,
      })
      firedIds.push(trigger.id)
    })
  }
  return firedIds
}
