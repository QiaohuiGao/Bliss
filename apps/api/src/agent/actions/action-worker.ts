import { and, asc, eq, isNull, lte, or, sql } from 'drizzle-orm'
import { db, type DB } from '../../db'
import { externalActions } from '../../db/schema'
import { AgentGuardrailError, normalizedAgentError } from '../errors'
import type { EmailSendProvider } from '../providers/email-send'
import { sendEmailPayloadSchema } from './contracts'

type ClaimedAction = typeof externalActions.$inferSelect

export interface ActionWorkerItem {
  actionId: string
  status: 'succeeded' | 'approved' | 'failed'
  attemptCount: number
  errorCode?: string
}

export interface ActionWorkerResult {
  processed: ActionWorkerItem[]
}

export class ExternalActionWorker {
  private readonly now: () => Date
  private readonly leaseMs: number
  private readonly maxAttempts: number

  constructor(
    private readonly emailProvider: EmailSendProvider,
    private readonly database: DB = db,
    options: {
      now?: () => Date
      leaseMs?: number
      maxAttempts?: number
    } = {},
  ) {
    this.now = options.now ?? (() => new Date())
    this.leaseMs = Math.min(Math.max(options.leaseMs ?? 60_000, 5_000), 10 * 60_000)
    this.maxAttempts = Math.min(Math.max(options.maxAttempts ?? 3, 1), 10)
  }

  private readyCondition(now: Date) {
    return or(
      and(
        eq(externalActions.status, 'approved'),
        or(isNull(externalActions.nextAttemptAt), lte(externalActions.nextAttemptAt, now)),
      ),
      and(
        eq(externalActions.status, 'executing'),
        or(isNull(externalActions.leaseExpiresAt), lte(externalActions.leaseExpiresAt, now)),
      ),
    )
  }

  private async claimNext(): Promise<ClaimedAction | null> {
    const now = this.now()
    const candidates = await this.database.select({ id: externalActions.id })
      .from(externalActions)
      .where(and(
        eq(externalActions.kind, 'send_email'),
        this.readyCondition(now),
      ))
      .orderBy(asc(externalActions.approvedAt), asc(externalActions.createdAt))
      .limit(5)

    for (const candidate of candidates) {
      const leaseId = crypto.randomUUID()
      const [claimed] = await this.database.update(externalActions).set({
        status: 'executing',
        leaseId,
        leaseExpiresAt: new Date(now.getTime() + this.leaseMs),
        attemptCount: sql`${externalActions.attemptCount} + 1`,
        updatedAt: now,
      }).where(and(
        eq(externalActions.id, candidate.id),
        this.readyCondition(now),
      )).returning()
      if (claimed) return claimed
    }
    return null
  }

  private async execute(action: ClaimedAction): Promise<ActionWorkerItem> {
    const now = this.now()
    try {
      if (action.provider !== this.emailProvider.id) {
        throw new AgentGuardrailError(
          'ACTION_PROVIDER_UNAVAILABLE',
          'The approved email provider is not active',
        )
      }
      const payload = sendEmailPayloadSchema.parse(action.approvedPayload)
      const result = await this.emailProvider.send(
        payload,
        { actionId: action.id },
        new AbortController().signal,
      )
      await this.database.update(externalActions).set({
        status: 'succeeded',
        result: {
          type: 'sent_email',
          provider: this.emailProvider.id,
          ...result,
        },
        executedAt: now,
        updatedAt: now,
        nextAttemptAt: null,
        leaseId: null,
        leaseExpiresAt: null,
        lastErrorCode: null,
        lastErrorAt: null,
      }).where(and(
        eq(externalActions.id, action.id),
        eq(externalActions.leaseId, action.leaseId!),
      ))
      return { actionId: action.id, status: 'succeeded', attemptCount: action.attemptCount }
    } catch (error) {
      const normalized = normalizedAgentError(error)
      const retry = normalized.retryable && action.attemptCount < this.maxAttempts
      const backoffMs = 30_000 * 2 ** Math.max(action.attemptCount - 1, 0)
      const status = retry ? 'approved' as const : 'failed' as const
      await this.database.update(externalActions).set({
        status,
        result: {
          type: 'provider_error',
          code: normalized.code,
          retryable: normalized.retryable,
        },
        updatedAt: now,
        nextAttemptAt: retry ? new Date(now.getTime() + backoffMs) : null,
        leaseId: null,
        leaseExpiresAt: null,
        lastErrorCode: normalized.code,
        lastErrorAt: now,
      }).where(and(
        eq(externalActions.id, action.id),
        eq(externalActions.leaseId, action.leaseId!),
      ))
      return {
        actionId: action.id,
        status,
        attemptCount: action.attemptCount,
        errorCode: normalized.code,
      }
    }
  }

  async runDue(limit = 20): Promise<ActionWorkerResult> {
    const boundedLimit = Math.min(Math.max(limit, 1), 100)
    const processed: ActionWorkerItem[] = []
    while (processed.length < boundedLimit) {
      const action = await this.claimNext()
      if (!action) break
      processed.push(await this.execute(action))
    }
    return { processed }
  }
}
