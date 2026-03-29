import type { FastifyInstance } from 'fastify'
import { db } from '../db'
import { stressCheckIns, weddings } from '../db/schema'
import { eq, and, desc, gte } from 'drizzle-orm'
import { requireAuth, requireWeddingAccess } from '../middleware/auth'
import stressResponses from '../content/stress-responses.json'
import { subDays } from 'date-fns'
import type { Mood } from '@bliss/types'

const MOOD_CONTEXTS: Record<Mood, string[]> = {
  great: ['everything_going_well', 'excited_about_decision', 'ahead_of_schedule', 'partner_aligned', 'just_finished_something_big'],
  okay: ['managing_but_tired', 'some_things_uncertain', 'partner_not_engaged', 'budget_feeling_tight', 'decisions_feeling_big'],
  overwhelmed: ['too_many_decisions', 'too_many_tasks', 'family_pressure', 'vendor_coordination', 'time_running_out'],
  stressed: ['conflict_with_partner', 'financial_strain', 'something_went_wrong', 'overwhelmed_by_options', 'work_life_balance'],
  lost: ['dont_know_where_to_start', 'conflicting_advice', 'changed_my_mind', 'comparison_anxiety', 'not_enjoying_planning'],
}

export async function stressRoutes(app: FastifyInstance) {
  // Get context options for a given mood
  app.get('/stress-checkins/contexts', async (req, reply) => {
    const { mood } = req.query as { mood: Mood }
    if (!mood || !MOOD_CONTEXTS[mood]) {
      return reply.status(400).send({ error: 'Invalid mood' })
    }
    return reply.send({ contexts: MOOD_CONTEXTS[mood] })
  })

  // Get response for mood + context
  app.get('/stress-checkins/response', async (req, reply) => {
    const { mood, context } = req.query as { mood: string; context: string }
    const key = `${mood}:${context}`
    const response = (stressResponses as Record<string, any>)[key]

    if (!response) {
      return reply.status(404).send({ error: 'Response not found for this combination' })
    }

    return reply.send({ mood, contextTag: context, ...response })
  })

  // Save a check-in
  app.post('/weddings/:weddingId/stress-checkins', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    const { weddingId } = req.params as any
    const userId = (req as any).userId as string
    const { mood, contextTag } = req.body as { mood: Mood; contextTag: string }

    const [checkIn] = await db
      .insert(stressCheckIns)
      .values({ weddingId, userId, mood, contextTag })
      .returning()

    return reply.status(201).send(checkIn)
  })

  // Get check-in history
  app.get('/weddings/:weddingId/stress-checkins', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    const { weddingId } = req.params as any

    const history = await db
      .select()
      .from(stressCheckIns)
      .where(eq(stressCheckIns.weddingId, weddingId))
      .orderBy(desc(stressCheckIns.createdAt))
      .limit(20)

    // Is check-in due? (no check-in in last 7 days)
    const sevenDaysAgo = subDays(new Date(), 7)
    const [recent] = await db
      .select()
      .from(stressCheckIns)
      .where(
        and(
          eq(stressCheckIns.weddingId, weddingId),
          gte(stressCheckIns.createdAt, sevenDaysAgo)
        )
      )
      .limit(1)

    return reply.send({
      checkIns: history,
      isDue: !recent,
      moodContexts: MOOD_CONTEXTS,
    })
  })
}
