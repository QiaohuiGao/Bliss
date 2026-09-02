import { strict as assert } from 'node:assert'
import { and, eq } from 'drizzle-orm'
import { AgentRuntime } from '../src/agent/runtime'
import { ExternalActionApprover } from '../src/agent/actions/approver'
import { DatabaseDecisionCommitter } from '../src/agent/proposals/committer'
import type {
  ProviderVendor,
  VendorSearchProvider,
  VendorSearchQuery,
} from '../src/agent/providers/vendor-search'
import type { AgentMessage, AgentModel, AgentModelResult } from '../src/agent/types'
import { db } from '../src/db'
import {
  agentSpans,
  agentFeedback,
  decisionProposalApprovals,
  decisionProposals,
  decisions,
  externalActions,
  memoryClaims,
  moments,
  planningThreads,
  tasks,
  threadMessages,
  users,
  vendorCandidates,
  vendorSearches,
  vendorShortlistItems,
  weddingMembers,
  weddings,
} from '../src/db/schema'
import { generateQuestsForWedding } from '../src/services/quest-generator'

class SmokeVendorProvider implements VendorSearchProvider {
  readonly id = 'smoke-vendor-directory-v1'

  async search(query: VendorSearchQuery, _signal: AbortSignal): Promise<ProviderVendor[]> {
    assert.equal(query.city, 'Brooklyn')
    assert.equal(query.state, 'NY')
    assert.equal(query.style, 'documentary')
    return [
      {
        providerVendorId: 'north-star-photo',
        name: 'North Star Photo',
        website: 'https://vendors.bliss.invalid/north-star',
        sourceUrl: 'https://directory.bliss.invalid/north-star',
        city: 'Brooklyn',
        state: 'NY',
        priceLevel: '$$$',
        summary: 'Documentary coverage with natural color and complete gallery examples.',
        rating: 4.9,
        reviewCount: 84,
      },
      {
        providerVendorId: 'goodlight-studio',
        name: 'Goodlight Studio',
        website: 'https://vendors.bliss.invalid/goodlight',
        sourceUrl: 'https://directory.bliss.invalid/goodlight',
        city: 'Brooklyn',
        state: 'NY',
        priceLevel: '$$$',
        summary: 'Candid storytelling with an unobtrusive working style.',
        rating: 4.8,
        reviewCount: 61,
      },
      {
        providerVendorId: 'soft-hour-photo',
        name: 'Soft Hour Photo',
        website: 'https://vendors.bliss.invalid/soft-hour',
        sourceUrl: 'https://directory.bliss.invalid/soft-hour',
        city: 'Brooklyn',
        state: 'NY',
        priceLevel: '$$',
        summary: 'Documentary coverage with a relaxed portrait approach.',
        rating: 4.7,
        reviewCount: 43,
      },
      {
        providerVendorId: 'kinfolk-photo',
        name: 'Kinfolk Photo',
        website: 'https://vendors.bliss.invalid/kinfolk',
        sourceUrl: 'https://directory.bliss.invalid/kinfolk',
        city: 'Brooklyn',
        state: 'NY',
        priceLevel: '$$$$',
        summary: 'Full-day documentary work with film add-ons.',
        rating: 4.9,
        reviewCount: 27,
      },
    ].slice(0, query.limit)
  }
}

class SmokePhotographerModel implements AgentModel {
  readonly id = 'smoke-photographer-scripted-v1'
  private step = 0

  constructor(private readonly evidence: {
    threadId: string
    firstMemberId: string
    firstMessageId: string
    secondMemberId: string
    secondMessageId: string
  }) {}

  async generate(input: { messages: AgentMessage[] }): Promise<AgentModelResult> {
    this.step += 1
    if (this.step === 1) {
      return {
        toolCalls: [{
          id: 'search',
          name: 'search_photographers',
          input: { city: 'Brooklyn', state: 'NY', style: 'documentary', limit: 5 },
        }],
        usage: { inputTokens: 180, outputTokens: 40, costMicros: 100 },
      }
    }

    const searchResult = [...input.messages]
      .reverse()
      .find(message => message.role === 'tool' && message.toolCallId === 'search')
    assert.ok(searchResult)
    const candidates = (JSON.parse(searchResult.content) as { candidates: Array<{ id: string; name: string }> }).candidates
    assert.equal(candidates.length, 4)

    return {
      text: 'You both want candid coverage, with video for the parts you will want to relive.',
      toolCalls: [{
        id: 'proposal',
        name: 'propose_decision',
        input: {
          schemaVersion: 1,
          threadId: this.evidence.threadId,
          questKey: 'vendor_team',
          questionKey: 'photo.photographer_choice',
          state: 'ready',
          summary: 'A verified documentary photographer best matches the couple\'s shared priorities.',
          proposedChoice: candidates[0]!.id,
          reason: 'Both partners value candid work, and the sourced profile shows complete documentary galleries.',
          alternativesConsidered: [{
            value: candidates[1]!.id,
            tradeoff: 'Also documentary-led, but the selected profile has stronger complete-gallery evidence.',
          }],
          memberInputs: [
            {
              memberId: this.evidence.firstMemberId,
              stance: candidates[0]!.id,
              reason: 'Wants candid photographs and does not want the day to feel staged.',
              sourceMessageIds: [this.evidence.firstMessageId],
            },
            {
              memberId: this.evidence.secondMemberId,
              stance: candidates[0]!.id,
              reason: 'Wants full galleries that preserve candid moments consistently.',
              sourceMessageIds: [this.evidence.secondMessageId],
            },
          ],
          taskEffects: [{
            taskKey: 'book_photographer',
            rationale: 'Move the selected verified candidate into the booking workflow.',
          }],
          memoryEffects: [
            {
              subjectType: 'member',
              subjectId: this.evidence.firstMemberId,
              kind: 'preference',
              key: 'photo.unobtrusive_documentary',
              value: 'Prefers candid coverage that does not make the wedding feel staged.',
              source: 'explicit',
              confidenceBasisPoints: 10_000,
              evidenceMessageIds: [this.evidence.firstMessageId],
            },
            {
              subjectType: 'member',
              subjectId: this.evidence.secondMemberId,
              kind: 'priority',
              key: 'photo.preserve_audio',
              value: 'Prioritizes preserving vows and speeches with sound.',
              source: 'explicit',
              confidenceBasisPoints: 10_000,
              evidenceMessageIds: [this.evidence.secondMessageId],
            },
          ],
          externalActions: [
            {
              kind: 'draft_email',
              payload: {
                subject: 'Wedding photography availability — October 16, 2027',
                body: 'Hello, we love your documentary work and would like to ask about availability and full-gallery examples for our Brooklyn wedding.',
                recipients: [],
              },
              requiresApproval: true,
            },
            {
              kind: 'calendar_event',
              payload: {
                title: 'Review photographer full galleries together',
                startsAt: '2026-10-04T19:00:00-04:00',
                endsAt: '2026-10-04T20:00:00-04:00',
                description: 'Compare consistency, low-light work, and how candid the galleries feel.',
              },
              requiresApproval: true,
            },
          ],
          vendorEffects: candidates.slice(0, 3).map((candidate, index) => ({
            candidateId: candidate.id,
            rationale: `Rank ${index + 1}: sourced documentary match for the wedding location.`,
            pros: ['Brooklyn location match', 'Documentary style evidence in the directory result'],
            concerns: ['Availability and full-gallery consistency still need confirmation'],
          })),
          momentCandidate: {
            title: 'Choosing how the day will be remembered',
            narrative: 'You chose candid photographs and the living sound of the people you love.',
            sourceMessageIds: [this.evidence.firstMessageId, this.evidence.secondMessageId],
          },
        },
      }],
      usage: { inputTokens: 360, outputTokens: 260, costMicros: 300 },
    }
  }
}

let weddingId: string | null = null
const userIds: string[] = []

try {
  const createdUsers = await db.insert(users).values([
    {
      clerkId: `smoke-${crypto.randomUUID()}`,
      email: `smoke-${crypto.randomUUID()}@bliss.invalid`,
      displayName: 'Smoke Partner One',
    },
    {
      clerkId: `smoke-${crypto.randomUUID()}`,
      email: `smoke-${crypto.randomUUID()}@bliss.invalid`,
      displayName: 'Smoke Partner Two',
    },
  ]).returning({ id: users.id })
  userIds.push(...createdUsers.map(user => user.id))

  const [wedding] = await db.insert(weddings).values({
    weddingDate: '2027-10-16',
    state: 'NY',
    city: 'Brooklyn',
    weddingType: 'traditional',
    cultures: [],
    plannerType: 'none',
  }).returning({ id: weddings.id })
  weddingId = wedding!.id

  await db.insert(weddingMembers).values([
    { weddingId, userId: userIds[0]!, role: 'owner' },
    { weddingId, userId: userIds[1]!, role: 'partner' },
  ])
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
    questKey: 'vendor_team',
    questionKey: 'photo.photographer_choice',
    title: 'Smoke photographer decision',
    openedBy: userIds[0],
  }).returning({ id: planningThreads.id })
  const messages = await db.insert(threadMessages).values([
    {
      weddingId,
      threadId: thread!.id,
      authorType: 'user',
      authorUserId: userIds[0],
      content: 'I want candid photographs and do not want the day to feel staged.',
    },
    {
      weddingId,
      threadId: thread!.id,
      authorType: 'user',
      authorUserId: userIds[1],
      content: 'I want video because I care about hearing our vows and the speeches again.',
    },
  ]).returning({ id: threadMessages.id, authorUserId: threadMessages.authorUserId })
  const firstMessage = messages.find(message => message.authorUserId === userIds[0])!
  const secondMessage = messages.find(message => message.authorUserId === userIds[1])!

  const run = await new AgentRuntime(new SmokePhotographerModel({
    threadId: thread!.id,
    firstMemberId: userIds[0]!,
    firstMessageId: firstMessage.id,
    secondMemberId: userIds[1]!,
    secondMessageId: secondMessage.id,
  })).runPhotographerDecision(
    { weddingId, threadId: thread!.id, userId: userIds[0]! },
    new SmokeVendorProvider(),
  )
  assert.equal(run.stopReason, 'terminal_tool')

  const [proposal] = await db.select().from(decisionProposals).where(and(
    eq(decisionProposals.threadId, thread!.id),
    eq(decisionProposals.status, 'pending'),
  )).limit(1)
  assert.ok(proposal)
  assert.equal(proposal.vendorEffects.length, 3)

  const committer = new DatabaseDecisionCommitter()
  const key = crypto.randomUUID()
  await db.insert(decisionProposalApprovals).values(userIds.map(userId => ({
    weddingId,
    proposalId: proposal.id,
    userId,
  })))
  const committed = await committer.confirm({
    proposalId: proposal.id,
    weddingId,
    userId: userIds[0]!,
    idempotencyKey: key,
  })
  const replayed = await committer.confirm({
    proposalId: proposal.id,
    weddingId,
    userId: userIds[0]!,
    idempotencyKey: key,
  })
  assert.equal(replayed.replayed, true)
  assert.equal(replayed.decisionId, committed.decisionId)

  const searches = await db.select().from(vendorSearches).where(eq(vendorSearches.weddingId, weddingId))
  const candidates = await db.select().from(vendorCandidates).where(eq(vendorCandidates.weddingId, weddingId))
  const shortlist = await db.select().from(vendorShortlistItems).where(eq(vendorShortlistItems.weddingId, weddingId))
  const decidedTasks = await db.select().from(tasks).where(and(
    eq(tasks.weddingId, weddingId),
    eq(tasks.decisionId, committed.decisionId),
  ))
  const [decision] = await db.select().from(decisions).where(eq(decisions.id, committed.decisionId)).limit(1)
  const claims = await db.select().from(memoryClaims).where(eq(memoryClaims.weddingId, weddingId))
  const actions = await db.select().from(externalActions).where(eq(externalActions.weddingId, weddingId))
  const savedMoments = await db.select().from(moments).where(eq(moments.weddingId, weddingId))
  const spans = await db.select().from(agentSpans).where(eq(agentSpans.runId, run.runId))

  assert.equal(searches.length, 1)
  assert.equal(searches[0]!.status, 'succeeded')
  assert.equal(searches[0]!.resultCount, 4)
  assert.equal(candidates.length, 4)
  assert.equal(shortlist.length, 3)
  assert.deepEqual(shortlist.map(item => item.rank).sort(), [1, 2, 3])
  assert.equal(decidedTasks.length, 1)
  assert.ok(decidedTasks.every(task => task.confidence === 'decided'))
  assert.equal(decision!.decidedBy, 'both')
  assert.equal(claims.length, 2)
  assert.equal(actions.length, 2)
  assert.ok(actions.every(action => action.status === 'draft'))
  assert.equal(savedMoments.length, 1)
  assert.ok(spans.length >= 4)
  const serializedSpans = JSON.stringify(spans)
  assert.doesNotMatch(serializedSpans, /candid photographs/i)
  assert.doesNotMatch(serializedSpans, /North Star Photo/i)

  await db.insert(agentFeedback).values({
    weddingId,
    runId: run.runId,
    userId: userIds[0]!,
    dimension: 'represented_both',
    rating: 1,
  })
  await db.insert(agentFeedback).values({
    weddingId,
    runId: run.runId,
    userId: userIds[0]!,
    dimension: 'represented_both',
    rating: -1,
  }).onConflictDoUpdate({
    target: [agentFeedback.runId, agentFeedback.userId, agentFeedback.dimension],
    set: { rating: -1, updatedAt: new Date() },
  })
  const feedback = await db.select().from(agentFeedback).where(eq(agentFeedback.runId, run.runId))
  assert.equal(feedback.length, 1)
  assert.equal(feedback[0]!.rating, -1)

  const approver = new ExternalActionApprover()
  const approved = await Promise.all(actions.map(action => approver.approve({
    weddingId,
    actionId: action.id,
    userId: userIds[0]!,
    idempotencyKey: crypto.randomUUID(),
  })))
  const email = approved.find(action => action.kind === 'draft_email')
  const calendar = approved.find(action => action.kind === 'calendar_event')
  assert.equal(email?.result['type'], 'email_draft')
  assert.equal(calendar?.result['type'], 'calendar_file')
  assert.match(String(calendar?.result['content']), /BEGIN:VCALENDAR/)

  console.log('PASS: photographer agent database smoke test')
  console.log(`  provider searches: ${searches.length} (${candidates.length} normalized candidates)`)
  console.log(`  sourced shortlist: ${shortlist.length}`)
  console.log(`  decided tasks: ${decidedTasks.length}`)
  console.log(`  attributed memory claims: ${claims.length}`)
  console.log(`  approved drafts: ${approved.length}`)
  console.log(`  suggested Moments: ${savedMoments.length}`)
  console.log(`  spans: ${spans.length}`)
  console.log(`  privacy-safe feedback rows: ${feedback.length} (upserted)`)
} finally {
  if (weddingId) await db.delete(weddings).where(eq(weddings.id, weddingId))
  for (const userId of userIds) await db.delete(users).where(eq(users.id, userId))
}

process.exit(0)
