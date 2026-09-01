import { strict as assert } from 'node:assert'
import { and, eq, inArray } from 'drizzle-orm'
import { AgentRuntime } from '../src/agent/runtime'
import { DatabaseDecisionCommitter } from '../src/agent/proposals/committer'
import { DatabaseDecisionProposalStore } from '../src/agent/proposals/store'
import { ATTIRE_QUESTION_KEY } from '../src/agent/packs/attire'
import { correctMemoryClaim } from '../src/agent/memory/corrections'
import { loadMemoryProfile } from '../src/agent/memory/profile'
import { attachMomentAsset } from '../src/agent/memory/assets'
import { cleanupExpiredMediaUploads } from '../src/agent/memory/media-cleanup'
import { ExternalActionApprover } from '../src/agent/actions/approver'
import { ExternalActionWorker } from '../src/agent/actions/action-worker'
import { fireDueReminders } from '../src/agent/actions/reminder-worker'
import { AgentGuardrailError } from '../src/agent/errors'
import type { EmailSendProvider, SendEmailPayload } from '../src/agent/providers/email-send'
import {
  mediaObjectReference,
  type MediaUploadProvider,
} from '../src/agent/providers/media-upload'
import type { AgentModel, AgentModelResult } from '../src/agent/types'
import { db } from '../src/db'
import {
  agentSpans,
  activityFeed,
  decisionProposals,
  decisions,
  externalActions,
  memoryClaims,
  mediaUploadIntents,
  momentAssets,
  moments,
  planningThreads,
  tasks,
  threadMessages,
  users,
  weddingMembers,
  weddings,
  scheduledTriggers,
  scheduleIssues,
  taskDependencies,
} from '../src/db/schema'
import { generateQuestsForWedding } from '../src/services/quest-generator'
import { recomputeWeddingSchedule } from '../src/services/schedule-store'

class SmokeModel implements AgentModel {
  readonly id = 'smoke-scripted-v1'
  private step = 0

  constructor(private readonly evidence: { threadId: string; messageId: string; memberId: string }) {}

  async generate(): Promise<AgentModelResult> {
    this.step += 1
    if (this.step === 1) {
      return {
        toolCalls: [{ id: 'candidate', name: 'get_candidate_tasks', input: { choice: 'buy_custom' } }],
        usage: { inputTokens: 120, outputTokens: 30, costMicros: 100 },
      }
    }
    return {
      text: 'A custom gown fits the meaning you want, as long as you protect the lead time.',
      toolCalls: [{
        id: 'proposal',
        name: 'propose_decision',
        input: {
          schemaVersion: 1,
          threadId: this.evidence.threadId,
          questKey: 'attire_beauty',
          questionKey: 'attire.dress_acquisition',
          state: 'ready',
          summary: 'Custom feels personal enough to justify the longer timeline.',
          proposedChoice: 'buy_custom',
          reason: 'Craftsmanship and personal meaning matter more than speed.',
          alternativesConsidered: [
            { value: 'buy_offrack', tradeoff: 'Faster, but less personal.' },
          ],
          memberInputs: [{
            memberId: this.evidence.memberId,
            stance: 'buy_custom',
            reason: 'The craftsmanship feels meaningful.',
            sourceMessageIds: [this.evidence.messageId],
          }],
          taskEffects: [
            { taskKey: 'order_the_gown', rationale: 'Protect the six-month production window.' },
            { taskKey: 'second_fitting', rationale: 'A custom build needs the additional fit check.' },
          ],
          memoryEffects: [{
            subjectType: 'member',
            subjectId: this.evidence.memberId,
            kind: 'priority',
            key: 'attire.craftsmanship',
            value: 'Craftsmanship and personal meaning matter more than speed.',
            source: 'explicit',
            confidenceBasisPoints: 10_000,
            evidenceMessageIds: [this.evidence.messageId],
          }],
          externalActions: [{
            kind: 'reminder',
            payload: {
              title: 'Start custom gown research',
              triggerAt: '2026-10-01T09:00:00-04:00',
              note: 'Protect the custom production window.',
            },
            requiresApproval: true,
          }],
          momentCandidate: {
            title: 'Choosing something made for this chapter',
            narrative: 'You chose craftsmanship with open eyes about the time it needs.',
            sourceMessageIds: [this.evidence.messageId],
          },
        },
      }],
      usage: { inputTokens: 250, outputTokens: 180, costMicros: 200 },
    }
  }
}

class RevisionSmokeModel implements AgentModel {
  readonly id = 'smoke-revision-v1'
  private step = 0

  constructor(private readonly evidence: { threadId: string; messageId: string; memberId: string }) {}

  async generate(): Promise<AgentModelResult> {
    this.step += 1
    if (this.step === 1) {
      return {
        toolCalls: [{ id: 'candidate-revision', name: 'get_candidate_tasks', input: { choice: 'rent' } }],
      }
    }
    return {
      text: 'Renting now fits the timeline better, while keeping the choice intentional.',
      toolCalls: [{
        id: 'proposal-revision',
        name: 'propose_decision',
        input: {
          schemaVersion: 1,
          threadId: this.evidence.threadId,
          questKey: 'attire_beauty',
          questionKey: 'attire.dress_acquisition',
          state: 'ready',
          summary: 'The couple changed the gown path after seeing the schedule pressure.',
          proposedChoice: 'rent',
          reason: 'A rental protects the remaining timeline without rushing a custom gown.',
          alternativesConsidered: [
            { value: 'buy_custom', tradeoff: 'More personal, but no longer feasible without schedule risk.' },
          ],
          memberInputs: [{
            memberId: this.evidence.memberId,
            stance: 'rent',
            reason: 'The timeline is now the firm constraint.',
            sourceMessageIds: [this.evidence.messageId],
          }],
          taskEffects: [{
            taskKey: 'reserve_rental_gown',
            rationale: 'Secure the selected gown inside the shorter rental window.',
          }],
          memoryEffects: [],
          externalActions: [],
          vendorEffects: [],
          momentCandidate: null,
        },
      }],
    }
  }
}

class SmokeEmailProvider implements EmailSendProvider {
  readonly id = 'email-smoke-v1'
  readonly actionIds: string[] = []
  readonly attempts = new Map<string, number>()
  readonly failFirst = new Set<string>()

  async send(_payload: SendEmailPayload, context: { actionId: string }) {
    this.actionIds.push(context.actionId)
    const attempt = (this.attempts.get(context.actionId) ?? 0) + 1
    this.attempts.set(context.actionId, attempt)
    if (this.failFirst.has(context.actionId) && attempt === 1) {
      throw new AgentGuardrailError('EMAIL_PROVIDER_HTTP_503', 'Email provider failed', true)
    }
    return {
      messageId: `message-${context.actionId}`,
      acceptedAt: new Date().toISOString(),
    }
  }
}

class SmokeMediaProvider implements MediaUploadProvider {
  readonly id = 'media-smoke-v1'
  readonly maxBytes = 10 * 1024 * 1024
  readonly deletedObjectKeys: string[] = []

  async createUploadGrant(): Promise<never> {
    throw new Error('Not used by this smoke test')
  }

  async createReadGrant(): Promise<never> {
    throw new Error('Not used by this smoke test')
  }

  async deleteObject(request: { weddingId: string; objectKey: string }): Promise<void> {
    assert.ok(request.objectKey.includes(`/weddings/${request.weddingId}/moment/`))
    this.deletedObjectKeys.push(request.objectKey)
  }
}

let weddingId: string | null = null
let userId: string | null = null

try {
  const [user] = await db.insert(users).values({
    clerkId: `smoke-${crypto.randomUUID()}`,
    email: `smoke-${crypto.randomUUID()}@bliss.invalid`,
    displayName: 'Smoke Test Member',
  }).returning({ id: users.id })
  userId = user!.id

  const [wedding] = await db.insert(weddings).values({
    weddingDate: '2027-10-16',
    state: 'NY',
    city: 'Brooklyn',
    weddingType: 'traditional',
    cultures: [],
    plannerType: 'none',
  }).returning({ id: weddings.id })
  weddingId = wedding!.id

  await db.insert(weddingMembers).values({ weddingId, userId, role: 'owner' })
  await generateQuestsForWedding(weddingId, {
    weddingDate: '2027-10-16',
    state: 'NY',
    weddingType: 'traditional',
    cultures: [],
    plannerType: 'none',
    locale: 'en',
  })

  const [thread] = await db.insert(planningThreads).values({
    weddingId,
    questKey: 'attire_beauty',
    title: 'Smoke attire decision',
    openedBy: userId,
  }).returning({ id: planningThreads.id })
  const [message] = await db.insert(threadMessages).values({
    weddingId,
    threadId: thread!.id,
    authorType: 'user',
    authorUserId: userId,
    content: 'The craftsmanship feels meaningful, and I can accept starting early.',
  }).returning({ id: threadMessages.id })

  const run = await new AgentRuntime(new SmokeModel({
    threadId: thread!.id,
    messageId: message!.id,
    memberId: userId,
  })).runAttireDecision({ weddingId, threadId: thread!.id, userId })
  assert.equal(run.stopReason, 'terminal_tool')

  const [proposal] = await db.select().from(decisionProposals).where(and(
    eq(decisionProposals.threadId, thread!.id),
    eq(decisionProposals.status, 'pending'),
  )).limit(1)
  assert.ok(proposal)

  // A thread carries one decision. The first proposal locks which question that is.
  const [lockedThread] = await db
    .select({ questionKey: planningThreads.questionKey })
    .from(planningThreads)
    .where(eq(planningThreads.id, thread!.id))
    .limit(1)
  assert.equal(lockedThread!.questionKey, ATTIRE_QUESTION_KEY)

  await assert.rejects(
    () => new DatabaseDecisionProposalStore().create(
      { runId: run.runId, weddingId: weddingId!, userId: userId!, threadId: thread!.id },
      {
        schemaVersion: 1,
        threadId: thread!.id,
        questKey: 'attire_beauty',
        questionKey: 'attire.suit_acquisition',
        state: 'contested',
        summary: 'A second question must not retarget a locked thread',
        proposedChoice: null,
        reason: null,
        alternativesConsidered: [],
        memberInputs: [],
        taskEffects: [],
        memoryEffects: [],
        externalActions: [],
        vendorEffects: [],
        momentCandidate: null,
      },
    ),
    (error: unknown) => error instanceof AgentGuardrailError
      && error.code === 'QUESTION_SCOPE_MISMATCH',
  )

  const committer = new DatabaseDecisionCommitter()
  const key = crypto.randomUUID()
  const committed = await committer.confirm({
    proposalId: proposal.id,
    weddingId,
    userId,
    idempotencyKey: key,
  })
  const replayed = await committer.confirm({
    proposalId: proposal.id,
    weddingId,
    userId,
    idempotencyKey: key,
  })
  assert.equal(replayed.replayed, true)
  assert.equal(replayed.decisionId, committed.decisionId)

  const decidedTasks = await db.select().from(tasks).where(and(
    eq(tasks.weddingId, weddingId),
    eq(tasks.decisionId, committed.decisionId),
  ))
  const obsoleteTasks = await db.select().from(tasks).where(and(
    eq(tasks.weddingId, weddingId),
    eq(tasks.templateKey, 'buy_the_gown_offrack'),
  ))
  const claims = await db.select().from(memoryClaims).where(eq(memoryClaims.weddingId, weddingId))
  const actions = await db.select().from(externalActions).where(eq(externalActions.weddingId, weddingId))
  const savedMoments = await db.select().from(moments).where(eq(moments.weddingId, weddingId))
  const spans = await db.select().from(agentSpans).where(eq(agentSpans.runId, run.runId))

  assert.deepEqual(new Set(decidedTasks.map(task => task.templateKey)), new Set([
    'book_salon_appointments',
    'order_the_gown',
    'first_fitting',
    'second_fitting',
    'final_fitting_and_bustle',
    'learn_the_bustle',
  ]))
  assert.ok(decidedTasks.every(task => task.confidence === 'decided'))
  assert.equal(obsoleteTasks.length, 0)
  assert.equal(claims.length, 1)
  assert.equal(actions.length, 1)
  assert.equal(actions[0]!.status, 'draft')
  assert.equal(savedMoments.length, 1)
  assert.ok(spans.length >= 4)

  // Moment media accepts only a provider-controlled, unexpired upload intent.
  // Consuming it and inserting the asset is atomic and single-use.
  const uploadIntentId = crypto.randomUUID()
  const uploadedObjectKey = `bliss/weddings/${weddingId}/moment/${uploadIntentId}.jpg`
  const uploadedAssetReference = mediaObjectReference(uploadedObjectKey)
  await db.insert(mediaUploadIntents).values({
    id: uploadIntentId,
    weddingId,
    createdBy: userId,
    provider: 'media-smoke-v1',
    purpose: 'moment',
    contentType: 'image/jpeg',
    sizeBytes: 1_024,
    originalFilename: 'our-fitting.jpg',
    objectKey: uploadedObjectKey,
    assetUrl: uploadedAssetReference,
    expiresAt: new Date(Date.now() + 60_000),
  })
  const attachedAsset = await attachMomentAsset({
    weddingId,
    momentId: savedMoments[0]!.id,
    userId,
    uploadIntentId,
    kind: 'memory',
    caption: 'The fitting where the choice felt real.',
  })
  assert.equal(attachedAsset.status, 'created')
  assert.equal(attachedAsset.status === 'created' && attachedAsset.asset.url, uploadedAssetReference)
  const reusedIntent = await attachMomentAsset({
    weddingId,
    momentId: savedMoments[0]!.id,
    userId,
    uploadIntentId,
    kind: 'memory',
  })
  assert.equal(reusedIntent.status, 'intent_unavailable')
  const attachedRows = await db.select().from(momentAssets).where(
    eq(momentAssets.momentId, savedMoments[0]!.id),
  )
  assert.equal(attachedRows.length, 1)

  const expiredIntentId = crypto.randomUUID()
  const expiredObjectKey = `bliss/weddings/${weddingId}/moment/${expiredIntentId}.jpg`
  await db.insert(mediaUploadIntents).values({
    id: expiredIntentId,
    weddingId,
    createdBy: userId,
    provider: 'media-smoke-v1',
    purpose: 'moment',
    contentType: 'image/jpeg',
    sizeBytes: 2_048,
    originalFilename: 'cancelled-upload.jpg',
    objectKey: expiredObjectKey,
    assetUrl: mediaObjectReference(expiredObjectKey),
    expiresAt: new Date(Date.now() - 60_000),
  })
  const mediaProvider = new SmokeMediaProvider()
  const cleanup = await cleanupExpiredMediaUploads(mediaProvider)
  assert.ok(cleanup.cleaned.includes(expiredIntentId))
  assert.ok(mediaProvider.deletedObjectKeys.includes(expiredObjectKey))
  const [expiredIntent] = await db.select({ status: mediaUploadIntents.status })
    .from(mediaUploadIntents).where(eq(mediaUploadIntents.id, expiredIntentId))
  assert.equal(expiredIntent!.status, 'expired')

  await recomputeWeddingSchedule(weddingId, new Date('2027-05-01T12:00:00Z'))
  const timeConflicts = await db.select().from(scheduleIssues).where(and(
    eq(scheduleIssues.weddingId, weddingId),
    eq(scheduleIssues.decisionId, committed.decisionId),
    eq(scheduleIssues.type, 'negative_slack'),
  ))
  const dependencyEdges = await db.select().from(taskDependencies).where(
    eq(taskDependencies.taskId, decidedTasks.find(task => task.templateKey === 'second_fitting')!.id),
  )
  assert.ok(timeConflicts.some(issue => (issue.slackDays ?? 0) < 0))
  assert.ok(dependencyEdges.length >= 1)

  const actionKey = crypto.randomUUID()
  const approvedAction = await new ExternalActionApprover().approve({
    weddingId,
    actionId: actions[0]!.id,
    userId,
    idempotencyKey: actionKey,
  })
  const replayedAction = await new ExternalActionApprover().approve({
    weddingId,
    actionId: actions[0]!.id,
    userId,
    idempotencyKey: actionKey,
  })
  const triggers = await db.select().from(scheduledTriggers).where(
    eq(scheduledTriggers.externalActionId, actions[0]!.id),
  )
  assert.equal(approvedAction.status, 'succeeded')
  assert.equal(replayedAction.replayed, true)
  assert.equal(triggers.length, 1)
  const fired = await fireDueReminders(new Date('2026-10-02T12:00:00Z'))
  const reminderActivity = await db.select().from(activityFeed).where(and(
    eq(activityFeed.weddingId, weddingId),
    eq(activityFeed.action, 'reminder_due'),
  ))
  assert.deepEqual(fired, [triggers[0]!.id])
  assert.equal(reminderActivity.length, 1)

  // Provider writes are approved into a durable queue, executed outside the
  // approval transaction, and retried with the same action ID.
  const emailProvider = new SmokeEmailProvider()
  const emailPayload = {
    subject: 'Photography availability',
    body: 'Are you available for our wedding date?',
    recipients: ['studio@example.com'],
  }
  const [emailAction, retryEmailAction] = await db.insert(externalActions).values([
    { weddingId, decisionId: committed.decisionId, kind: 'send_email', payload: emailPayload },
    { weddingId, decisionId: committed.decisionId, kind: 'send_email', payload: emailPayload },
  ]).returning()
  emailProvider.failFirst.add(retryEmailAction!.id)
  const emailApprover = new ExternalActionApprover(emailProvider)
  const emailApprovalKey = crypto.randomUUID()
  const queuedEmail = await emailApprover.approve({
    weddingId,
    actionId: emailAction!.id,
    userId,
    idempotencyKey: emailApprovalKey,
  })
  const replayedEmail = await emailApprover.approve({
    weddingId,
    actionId: emailAction!.id,
    userId,
    idempotencyKey: emailApprovalKey,
  })
  await emailApprover.approve({
    weddingId,
    actionId: retryEmailAction!.id,
    userId,
    idempotencyKey: crypto.randomUUID(),
  })
  assert.equal(queuedEmail.status, 'approved')
  assert.equal(replayedEmail.replayed, true)

  let workerNow = new Date(Date.now() + 1_000)
  const worker = new ExternalActionWorker(emailProvider, db, { now: () => workerNow })
  const firstWorkerRun = await worker.runDue()
  assert.equal(firstWorkerRun.processed.length, 2)
  assert.equal(firstWorkerRun.processed.find(item => item.actionId === emailAction!.id)?.status, 'succeeded')
  assert.equal(firstWorkerRun.processed.find(item => item.actionId === retryEmailAction!.id)?.status, 'approved')
  assert.equal((await worker.runDue()).processed.length, 0)
  workerNow = new Date(workerNow.getTime() + 31_000)
  const retryWorkerRun = await worker.runDue()
  assert.equal(retryWorkerRun.processed[0]?.status, 'succeeded')
  assert.deepEqual(emailProvider.actionIds, [
    emailAction!.id,
    retryEmailAction!.id,
    retryEmailAction!.id,
  ])
  const queuedRows = await db.select().from(externalActions).where(inArray(
    externalActions.id,
    [emailAction!.id, retryEmailAction!.id],
  ))
  assert.ok(queuedRows.every(action => action.status === 'succeeded'))
  assert.equal(queuedRows.find(action => action.id === emailAction!.id)?.attemptCount, 1)
  assert.equal(queuedRows.find(action => action.id === retryEmailAction!.id)?.attemptCount, 2)

  const corrected = await correctMemoryClaim({
    weddingId,
    claimId: claims[0]!.id,
    userId,
    value: 'Craftsmanship matters, but the timeline is the firm constraint.',
    reason: 'I want the timeline constraint represented more clearly.',
  })
  assert.ok(corrected)
  assert.equal(corrected.supersedesId, claims[0]!.id)
  const profile = await loadMemoryProfile(weddingId)
  assert.equal(profile.members[userId]?.length, 1)
  assert.equal(profile.memberNames[userId], 'Smoke Test Member')
  assert.equal(
    profile.members[userId]?.[0]?.value,
    'Craftsmanship matters, but the timeline is the firm constraint.',
  )

  // A later change of mind is a new append-only decision. It points to the
  // decision it replaces and deterministically removes the obsolete branch.
  const [revisionMessage] = await db.insert(threadMessages).values({
    weddingId,
    threadId: thread!.id,
    authorType: 'user',
    authorUserId: userId,
    content: 'The timeline is now the firm constraint, so I want to rent instead.',
  }).returning({ id: threadMessages.id })
  const revisionRun = await new AgentRuntime(new RevisionSmokeModel({
    threadId: thread!.id,
    messageId: revisionMessage!.id,
    memberId: userId,
  })).runAttireDecision({ weddingId, threadId: thread!.id, userId })
  assert.equal(revisionRun.stopReason, 'terminal_tool')
  const [revisionProposal] = await db.select().from(decisionProposals).where(and(
    eq(decisionProposals.threadId, thread!.id),
    eq(decisionProposals.status, 'pending'),
  )).limit(1)
  const revision = await committer.confirm({
    proposalId: revisionProposal!.id,
    weddingId,
    userId,
    idempotencyKey: crypto.randomUUID(),
  })
  const [revisionDecision] = await db.select().from(decisions).where(
    eq(decisions.id, revision.decisionId),
  ).limit(1)
  const revisedBranch = await db.select({
    templateKey: tasks.templateKey,
    decisionId: tasks.decisionId,
  }).from(tasks).where(and(
    eq(tasks.weddingId, weddingId),
    inArray(tasks.templateKey, ['order_the_gown', 'second_fitting', 'reserve_rental_gown']),
  ))
  assert.equal(revisionDecision!.supersedesId, committed.decisionId)
  assert.deepEqual(revisedBranch, [{
    templateKey: 'reserve_rental_gown',
    decisionId: revision.decisionId,
  }])

  console.log('PASS: attire agent database smoke test')
  console.log(`  decision tasks: ${decidedTasks.length}`)
  console.log(`  memory claims: ${claims.length}`)
  console.log('  memory correction: recalled replacement only')
  console.log(`  approved actions: ${actions.length} (idempotent replay)`)
  console.log(`  scheduled triggers: ${triggers.length}`)
  console.log(`  fired in-app reminders: ${reminderActivity.length}`)
  console.log('  email worker: durable approval, lease, retry, and stable idempotency')
  console.log(`  suggested Moments: ${savedMoments.length}`)
  console.log('  Moment media: provider-controlled and single-use attachment')
  console.log('  Moment media cleanup: expired orphan removed from private storage')
  console.log(`  spans: ${spans.length}`)
  console.log(`  schedule decision reopens: ${timeConflicts.length}`)
  console.log(`  authored dependency edges: ${dependencyEdges.length}`)
  console.log('  decision revision: append-only supersession + branch replacement')
  console.log(`  thread question scope: locked to ${ATTIRE_QUESTION_KEY}; cross-question proposal refused`)
} finally {
  if (weddingId) await db.delete(weddings).where(eq(weddings.id, weddingId))
  if (userId) await db.delete(users).where(eq(users.id, userId))
}

process.exit(0)
