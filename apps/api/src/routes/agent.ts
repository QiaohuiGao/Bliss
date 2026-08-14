import type { FastifyInstance } from 'fastify'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { AgentRuntime, isQuestScopingKey } from '../agent/runtime'
import { normalizedAgentError } from '../agent/errors'
import { configuredAgentModel } from '../agent/models/anthropic'
import { ATTIRE_QUEST_KEY } from '../agent/packs/attire'
import { PHOTOGRAPHER_QUEST_KEY } from '../agent/packs/photographer'
import { getQuestScopingOverview } from '../agent/packs/quest-scoping'
import { configuredVendorSearchProvider } from '../agent/providers/vendor-search'
import { DatabaseDecisionCommitter } from '../agent/proposals/committer'
import { loadCurrentDecisionState } from '../agent/proposals/current'
import { db } from '../db'
import {
  decisionProposals,
  planningThreads,
  threadMessages,
  vendorCandidates,
} from '../db/schema'
import { requireAuth, requireWeddingAccess } from '../middleware/auth'

const createThreadSchema = z.object({
  questKey: z.enum([ATTIRE_QUEST_KEY, PHOTOGRAPHER_QUEST_KEY, 'foundation', 'venue_date', 'wedding_party', 'guests_stationery', 'guest_experience', 'food_beverage', 'design_flowers', 'ceremony', 'registry_rings_honeymoon', 'legal', 'pre_wedding_events', 'final_30_and_day_of']).default(ATTIRE_QUEST_KEY),
  title: z.string().trim().min(1).max(120).optional(),
})

const createMessageSchema = z.object({
  content: z.string().trim().min(1).max(12_000),
})

async function threadBelongsToWedding(threadId: string, weddingId: string) {
  const [thread] = await db
    .select()
    .from(planningThreads)
    .where(and(
      eq(planningThreads.id, threadId),
      eq(planningThreads.weddingId, weddingId),
    ))
    .limit(1)
  return thread
}

async function proposalWithVendors<T extends {
  weddingId: string
  vendorEffects: Array<{ candidateId: string }>
}>(proposal: T) {
  const ids = proposal.vendorEffects.map(vendor => vendor.candidateId)
  if (ids.length === 0) return proposal
  const candidates = await db
    .select()
    .from(vendorCandidates)
    .where(and(
      eq(vendorCandidates.weddingId, proposal.weddingId),
      inArray(vendorCandidates.id, ids),
    ))
  const byId = new Map(candidates.map(candidate => [candidate.id, candidate]))
  return {
    ...proposal,
    vendorEffects: proposal.vendorEffects.map(vendor => ({
      ...vendor,
      candidate: byId.get(vendor.candidateId) ?? null,
    })),
  }
}

export async function agentRoutes(app: FastifyInstance) {
  const access = { preHandler: [requireAuth, requireWeddingAccess] }

  app.get('/weddings/:weddingId/quests/:questKey/scoping', access, async (req, reply) => {
    const { weddingId, questKey } = req.params as { weddingId: string; questKey: string }
    try {
      const current = await loadCurrentDecisionState(weddingId)
      return reply.send(getQuestScopingOverview(questKey, current.answers))
    } catch (error) {
      const normalized = normalizedAgentError(error)
      return reply.status(404).send({ error: normalized.message, ...normalized })
    }
  })

  app.post('/weddings/:weddingId/threads', access, async (req, reply) => {
    const { weddingId } = req.params as { weddingId: string }
    const userId = (req as any).userId as string
    const body = createThreadSchema.parse(req.body ?? {})
    const title = body.title ?? ({
      [ATTIRE_QUEST_KEY]: 'Make attire and beauty choices',
      [PHOTOGRAPHER_QUEST_KEY]: 'Find the right photographer',
      foundation: 'Agree how this wedding will work',
      venue_date: 'Choose the venue and date path',
      wedding_party: 'Shape the wedding party and VIP roles',
      guests_stationery: 'Set guest and invitation policies',
      guest_experience: 'Plan guest travel and hospitality',
      food_beverage: 'Shape the food and drink plan',
      design_flowers: 'Shape the design and production plan',
      ceremony: 'Shape the ceremony and vows',
      registry_rings_honeymoon: 'Choose rings, gifting, and the trip after',
      legal: 'Organize legal and paperwork choices',
      pre_wedding_events: 'Choose the celebrations around the wedding',
      final_30_and_day_of: 'Hand off the final month and day-of plan',
    }[body.questKey])
    const [existing] = await db
      .select()
      .from(planningThreads)
      .where(and(
        eq(planningThreads.weddingId, weddingId),
        eq(planningThreads.questKey, body.questKey),
      ))
      .orderBy(desc(planningThreads.updatedAt))
      .limit(1)
    if (existing && existing.status !== 'resolved' && existing.status !== 'parked') {
      return reply.send(existing)
    }
    const [thread] = await db
      .insert(planningThreads)
      .values({
        weddingId,
        questKey: body.questKey,
        title,
        openedBy: userId,
      })
      .returning()
    return reply.status(201).send(thread)
  })

  app.get('/weddings/:weddingId/threads', access, async (req, reply) => {
    const { weddingId } = req.params as { weddingId: string }
    const threads = await db
      .select()
      .from(planningThreads)
      .where(eq(planningThreads.weddingId, weddingId))
      .orderBy(desc(planningThreads.updatedAt))
    return reply.send(threads)
  })

  app.post('/weddings/:weddingId/threads/:threadId/messages', access, async (req, reply) => {
    const { weddingId, threadId } = req.params as { weddingId: string; threadId: string }
    const userId = (req as any).userId as string
    const body = createMessageSchema.parse(req.body)
    if (!await threadBelongsToWedding(threadId, weddingId)) {
      return reply.status(404).send({ error: 'Planning thread not found' })
    }
    const [message] = await db
      .insert(threadMessages)
      .values({
        threadId,
        weddingId,
        authorType: 'user',
        authorUserId: userId,
        content: body.content,
      })
      .returning()
    await db
      .update(decisionProposals)
      .set({ status: 'superseded' })
      .where(and(
        eq(decisionProposals.threadId, threadId),
        eq(decisionProposals.weddingId, weddingId),
        eq(decisionProposals.status, 'pending'),
      ))
    await db
      .update(planningThreads)
      .set({ status: 'exploring', updatedAt: new Date() })
      .where(eq(planningThreads.id, threadId))
    return reply.status(201).send(message)
  })

  app.get('/weddings/:weddingId/threads/:threadId/messages', access, async (req, reply) => {
    const { weddingId, threadId } = req.params as { weddingId: string; threadId: string }
    const userId = (req as any).userId as string
    if (!await threadBelongsToWedding(threadId, weddingId)) {
      return reply.status(404).send({ error: 'Planning thread not found' })
    }
    const messages = await db
      .select()
      .from(threadMessages)
      .where(and(
        eq(threadMessages.threadId, threadId),
        eq(threadMessages.weddingId, weddingId),
      ))
      .orderBy(asc(threadMessages.createdAt))
    return reply.send(messages.map(message => ({
      ...message,
      isCurrentUser: message.authorUserId === userId,
    })))
  })

  app.get('/weddings/:weddingId/threads/:threadId/decision-proposals/latest', access, async (req, reply) => {
    const { weddingId, threadId } = req.params as { weddingId: string; threadId: string }
    if (!await threadBelongsToWedding(threadId, weddingId)) {
      return reply.status(404).send({ error: 'Planning thread not found' })
    }
    const [proposal] = await db
      .select()
      .from(decisionProposals)
      .where(and(
        eq(decisionProposals.threadId, threadId),
        eq(decisionProposals.weddingId, weddingId),
      ))
      .orderBy(desc(decisionProposals.version))
      .limit(1)
    if (!proposal) return reply.status(404).send({ error: 'Decision proposal not found' })
    return reply.send(await proposalWithVendors(proposal))
  })

  app.post('/weddings/:weddingId/threads/:threadId/attire/run', access, async (req, reply) => {
    const { weddingId, threadId } = req.params as { weddingId: string; threadId: string }
    const userId = (req as any).userId as string
    const model = configuredAgentModel()
    if (!model) {
      return reply.status(503).send({
        error: 'Agent model is not configured',
        code: 'MODEL_NOT_CONFIGURED',
      })
    }

    const controller = new AbortController()
    req.raw.once('aborted', () => controller.abort())
    try {
      const result = await new AgentRuntime(model).runAttireDecision({
        weddingId,
        threadId,
        userId,
        signal: controller.signal,
      })
      return reply.send(result)
    } catch (error) {
      const normalized = normalizedAgentError(error)
      req.log.error({ error: normalized, weddingId, threadId }, 'Attire agent run failed')
      const status = normalized.code === 'UNEXPECTED_ERROR' ? 500 : 422
      return reply.status(status).send({ error: normalized.message, ...normalized })
    }
  })

  app.post('/weddings/:weddingId/threads/:threadId/photographer/run', access, async (req, reply) => {
    const { weddingId, threadId } = req.params as { weddingId: string; threadId: string }
    const userId = (req as any).userId as string
    const model = configuredAgentModel()
    if (!model) {
      return reply.status(503).send({ error: 'Agent model is not configured', code: 'MODEL_NOT_CONFIGURED' })
    }
    let provider
    try {
      provider = configuredVendorSearchProvider()
    } catch (error) {
      const normalized = normalizedAgentError(error)
      req.log.error({ error: normalized }, 'Vendor search provider configuration is invalid')
      return reply.status(503).send({ error: normalized.message, ...normalized })
    }
    if (!provider) {
      return reply.status(503).send({
        error: 'Vendor search provider is not configured',
        code: 'VENDOR_PROVIDER_NOT_CONFIGURED',
      })
    }

    const controller = new AbortController()
    req.raw.once('aborted', () => controller.abort())
    try {
      const result = await new AgentRuntime(model).runPhotographerDecision({
        weddingId,
        threadId,
        userId,
        signal: controller.signal,
      }, provider)
      return reply.send(result)
    } catch (error) {
      const normalized = normalizedAgentError(error)
      req.log.error({ error: normalized, weddingId, threadId }, 'Photographer agent run failed')
      return reply.status(normalized.code === 'UNEXPECTED_ERROR' ? 500 : 422).send({
        error: normalized.message,
        ...normalized,
      })
    }
  })

  app.post('/weddings/:weddingId/threads/:threadId/scoping/run', access, async (req, reply) => {
    const { weddingId, threadId } = req.params as { weddingId: string; threadId: string }
    const userId = (req as any).userId as string
    const thread = await threadBelongsToWedding(threadId, weddingId)
    if (!thread) return reply.status(404).send({ error: 'Planning thread not found' })
    if (!isQuestScopingKey(thread.questKey)) {
      return reply.status(422).send({
        error: 'This quest requires a specialized decision pack',
        code: 'QUEST_SCOPING_PACK_UNAVAILABLE',
      })
    }
    const model = configuredAgentModel()
    if (!model) {
      return reply.status(503).send({ error: 'Agent model is not configured', code: 'MODEL_NOT_CONFIGURED' })
    }
    const controller = new AbortController()
    req.raw.once('aborted', () => controller.abort())
    try {
      const result = await new AgentRuntime(model).runQuestScopingDecision({
        weddingId,
        threadId,
        userId,
        signal: controller.signal,
      }, thread.questKey)
      return reply.send(result)
    } catch (error) {
      const normalized = normalizedAgentError(error)
      req.log.error({ error: normalized, weddingId, threadId }, 'Quest scoping agent run failed')
      return reply.status(normalized.code === 'UNEXPECTED_ERROR' ? 500 : 422).send({
        error: normalized.message,
        ...normalized,
      })
    }
  })

  app.get('/weddings/:weddingId/decision-proposals/:proposalId', access, async (req, reply) => {
    const { weddingId, proposalId } = req.params as { weddingId: string; proposalId: string }
    const [proposal] = await db
      .select()
      .from(decisionProposals)
      .where(and(
        eq(decisionProposals.id, proposalId),
        eq(decisionProposals.weddingId, weddingId),
      ))
      .limit(1)
    if (!proposal) return reply.status(404).send({ error: 'Decision proposal not found' })
    return reply.send(await proposalWithVendors(proposal))
  })

  app.post('/weddings/:weddingId/decision-proposals/:proposalId/confirm', access, async (req, reply) => {
    const { weddingId, proposalId } = req.params as { weddingId: string; proposalId: string }
    const userId = (req as any).userId as string
    const idempotencyKey = req.headers['idempotency-key']
    if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
      return reply.status(400).send({
        error: 'Idempotency-Key header is required',
        code: 'IDEMPOTENCY_KEY_REQUIRED',
      })
    }
    try {
      const result = await new DatabaseDecisionCommitter().confirm({
        proposalId,
        weddingId,
        userId,
        idempotencyKey,
      })
      return reply.send(result)
    } catch (error) {
      const normalized = normalizedAgentError(error)
      const status = normalized.code === 'UNEXPECTED_ERROR' ? 500 : 409
      return reply.status(status).send({ error: normalized.message, ...normalized })
    }
  })
}
