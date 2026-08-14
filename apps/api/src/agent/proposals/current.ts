import { desc, eq } from 'drizzle-orm'
import { db, type DB } from '../../db'
import { decisions } from '../../db/schema'
import { projectCurrentDecisions, type CurrentDecisionState } from './current-state'

type Transaction = Parameters<Parameters<DB['transaction']>[0]>[0]
type Executor = DB | Transaction

export async function loadCurrentDecisionState(
  weddingId: string,
  executor: Executor = db,
): Promise<CurrentDecisionState> {
  const rows = await executor
    .select({
      id: decisions.id,
      questKey: decisions.questKey,
      questionKey: decisions.questionKey,
      choice: decisions.choice,
      reason: decisions.reason,
    })
    .from(decisions)
    .where(eq(decisions.weddingId, weddingId))
    .orderBy(desc(decisions.createdAt), desc(decisions.id))
  return projectCurrentDecisions(rows)
}
