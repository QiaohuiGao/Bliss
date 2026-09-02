import { and, eq } from 'drizzle-orm'
import { db, type DB } from '../../db'
import {
  externalActions,
  idempotencyRecords,
  decisions,
  scheduledTriggers,
  weddingMembers,
} from '../../db/schema'
import { AgentGuardrailError } from '../errors'
import {
  configuredEmailSendProvider,
  type EmailSendProvider,
} from '../providers/email-send'
import { assertReleaseEnabled } from '../release/store'
import {
  calendarEventIcs,
  calendarEventPayloadSchema,
  parseExternalActionPayload,
  reminderPayloadSchema,
  sendEmailPayloadSchema,
  type ExternalActionKind,
} from './contracts'

type Transaction = Parameters<Parameters<DB['transaction']>[0]>[0]

export interface ApprovedActionResult {
  actionId: string
  kind: ExternalActionKind
  status: 'approved' | 'succeeded'
  result: Record<string, unknown>
  replayed: boolean
}

async function assertMembership(tx: Transaction, weddingId: string, userId: string) {
  const [membership] = await tx
    .select({ id: weddingMembers.id })
    .from(weddingMembers)
    .where(and(
      eq(weddingMembers.weddingId, weddingId),
      eq(weddingMembers.userId, userId),
    ))
    .limit(1)
  if (!membership) throw new AgentGuardrailError('WEDDING_ACCESS_DENIED', 'Wedding access denied')
}

export class ExternalActionApprover {
  constructor(
    private readonly emailProvider: EmailSendProvider | null = configuredEmailSendProvider(),
  ) {}

  async approve(input: {
    actionId: string
    weddingId: string
    userId: string
    idempotencyKey: string
  }): Promise<ApprovedActionResult> {
    if (!input.idempotencyKey.trim()) {
      throw new AgentGuardrailError('IDEMPOTENCY_KEY_REQUIRED', 'An Idempotency-Key is required')
    }

    return db.transaction(async tx => {
      await assertMembership(tx, input.weddingId, input.userId)
      const operation = `approve_external_action:${input.actionId}`
      const [reservation] = await tx.insert(idempotencyRecords).values({
        weddingId: input.weddingId,
        operation,
        key: input.idempotencyKey,
      }).onConflictDoNothing().returning({ id: idempotencyRecords.id })

      if (!reservation) {
        const [existing] = await tx
          .select({ response: idempotencyRecords.response })
          .from(idempotencyRecords)
          .where(and(
            eq(idempotencyRecords.weddingId, input.weddingId),
            eq(idempotencyRecords.operation, operation),
            eq(idempotencyRecords.key, input.idempotencyKey),
          ))
          .limit(1)
        if (!existing?.response) {
          throw new AgentGuardrailError('IDEMPOTENCY_IN_PROGRESS', 'Action approval is still in progress', true)
        }
        return { ...(existing.response as Omit<ApprovedActionResult, 'replayed'>), replayed: true }
      }

      const [action] = await tx
        .select()
        .from(externalActions)
        .where(and(
          eq(externalActions.id, input.actionId),
          eq(externalActions.weddingId, input.weddingId),
        ))
        .limit(1)
        .for('update')
      if (!action) throw new AgentGuardrailError('ACTION_NOT_FOUND', 'Action not found')
      if (action.status !== 'draft' && action.status !== 'failed') {
        throw new AgentGuardrailError('ACTION_NOT_APPROVABLE', 'Only a draft or failed action can be approved')
      }
      const [origin] = await tx.select({ packKey: decisions.questKey }).from(decisions)
        .where(eq(decisions.id, action.decisionId)).limit(1)
      if (!origin) throw new AgentGuardrailError('ACTION_DECISION_NOT_FOUND', 'Action decision not found')
      await assertReleaseEnabled(tx, origin.packKey, 'external_writes')

      const kind = action.kind as ExternalActionKind
      const approvedPayload = parseExternalActionPayload(kind, action.payload)
      let result: Record<string, unknown>
      let status: ApprovedActionResult['status'] = 'succeeded'
      let provider: string | null = null

      if (kind === 'reminder') {
        const reminder = reminderPayloadSchema.parse(approvedPayload)
        const [trigger] = await tx.insert(scheduledTriggers).values({
          weddingId: input.weddingId,
          externalActionId: action.id,
          kind: 'reminder',
          triggerAt: new Date(reminder.triggerAt),
          payload: reminder,
        }).returning({ id: scheduledTriggers.id })
        result = { type: 'scheduled_reminder', triggerId: trigger!.id, triggerAt: reminder.triggerAt }
      } else if (kind === 'calendar_event') {
        const event = calendarEventPayloadSchema.parse(approvedPayload)
        result = {
          type: 'calendar_file',
          filename: `bliss-${action.id}.ics`,
          content: calendarEventIcs(action.id, event),
        }
      } else if (kind === 'draft_email') {
        result = { type: 'email_draft', ...approvedPayload }
      } else if (kind === 'send_email') {
        const email = sendEmailPayloadSchema.parse(approvedPayload)
        if (!this.emailProvider) {
          throw new AgentGuardrailError(
            'EMAIL_PROVIDER_NOT_CONFIGURED',
            'Email sending is not configured',
          )
        }
        status = 'approved'
        provider = this.emailProvider.id
        result = {
          type: 'queued_email',
          provider,
          recipients: email.recipients,
        }
      } else {
        result = { type: 'vendor_shortlist_brief', ...approvedPayload }
      }

      const now = new Date()
      await tx.update(externalActions).set({
        status,
        approvedBy: input.userId,
        approvedPayload,
        approvedAt: now,
        idempotencyKey: input.idempotencyKey,
        provider,
        attemptCount: 0,
        nextAttemptAt: status === 'approved' ? now : null,
        leaseId: null,
        leaseExpiresAt: null,
        lastErrorCode: null,
        lastErrorAt: null,
        result,
        updatedAt: now,
        executedAt: status === 'succeeded' ? now : null,
      }).where(eq(externalActions.id, action.id))

      const response: Omit<ApprovedActionResult, 'replayed'> = {
        actionId: action.id,
        kind,
        status,
        result,
      }
      await tx.update(idempotencyRecords)
        .set({ response })
        .where(eq(idempotencyRecords.id, reservation.id))
      return { ...response, replayed: false }
    })
  }
}
