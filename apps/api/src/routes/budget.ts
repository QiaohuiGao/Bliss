import type { FastifyInstance } from 'fastify'
import { db } from '../db'
import { budgetItems, weddings } from '../db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { requireAuth, requireWeddingAccess } from '../middleware/auth'
import budgetEstimatesData from '../content/budget-estimates.json'
import type { BudgetCategory, GuestCountMode, PlanningStyle } from '@bliss/types'
import { z } from 'zod'

const CATEGORY_LABELS: Record<BudgetCategory, string> = {
  venue: 'Venue',
  catering: 'Catering & Food',
  photography: 'Photography',
  music: 'Music & Entertainment',
  florals: 'Florals & Décor',
  attire: 'Attire',
  stationery: 'Stationery & Paper',
  other: 'Everything Else',
}

function getEstimateRanges(
  guestCountMode: GuestCountMode,
  locationMode: 'urban' | 'suburban' | 'rural',
  planningStyle: PlanningStyle
) {
  const estimates = (budgetEstimatesData.estimates as any)[guestCountMode]?.[locationMode]?.[planningStyle]
  if (!estimates) return []

  return Object.entries(estimates).map(([category, range]: [string, any]) => ({
    category: category as BudgetCategory,
    label: CATEGORY_LABELS[category as BudgetCategory] ?? category,
    lowCents: range[0] as number,
    highCents: range[1] as number,
  }))
}

const budgetItemSchema = z.object({
  category: z.enum(['venue', 'catering', 'photography', 'music', 'florals', 'attire', 'stationery', 'other']),
  label: z.string().min(1),
  estimatedCents: z.number().int().min(0),
  actualCents: z.number().int().min(0).optional().default(0),
  isDiy: z.boolean().optional().default(false),
  vendorName: z.string().optional().nullable(),
  paidAt: z.string().optional().nullable(),
})

export async function budgetRoutes(app: FastifyInstance) {
  // Get budget overview
  app.get('/weddings/:weddingId/budget', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    const { weddingId } = req.params as any
    const wedding = (req as any).wedding

    const items = await db
      .select()
      .from(budgetItems)
      .where(eq(budgetItems.weddingId, weddingId))
      .orderBy(budgetItems.category, budgetItems.createdAt)

    // Totals by category
    const byCategory = items.reduce(
      (acc, item) => {
        if (!acc[item.category]) {
          acc[item.category] = { estimatedCents: 0, actualCents: 0 }
        }
        acc[item.category]!.estimatedCents += item.estimatedCents
        acc[item.category]!.actualCents += item.actualCents
        return acc
      },
      {} as Record<BudgetCategory, { estimatedCents: number; actualCents: number }>
    )

    const totalEstimatedCents = items.reduce((sum, i) => sum + i.estimatedCents, 0)
    const totalActualCents = items.reduce((sum, i) => sum + i.actualCents, 0)

    // Estimate ranges based on wedding profile
    const estimateRanges = getEstimateRanges(
      wedding.guestCountMode,
      wedding.locationMode,
      wedding.planningStyle
    )

    // Trade-off tip: if any category is over estimate, suggest where to cut
    const tips: string[] = []
    for (const range of estimateRanges) {
      const actual = byCategory[range.category]
      if (actual && actual.estimatedCents > range.highCents) {
        const overBy = Math.round((actual.estimatedCents - range.highCents) / 100)
        tips.push(
          `Your ${CATEGORY_LABELS[range.category]} budget is $${overBy} over the typical range. Consider adjusting to free up room elsewhere.`
        )
      }
    }

    return reply.send({
      items,
      byCategory,
      totalEstimatedCents,
      totalActualCents,
      estimateRanges,
      tips,
    })
  })

  // Add budget item
  app.post('/weddings/:weddingId/budget-items', {
    preHandler: [requireAuth, requireWeddingAccess]
  }, async (req, reply) => {
    const { weddingId } = req.params as any
    const body = budgetItemSchema.parse(req.body)

    const [item] = await db
      .insert(budgetItems)
      .values({
        weddingId,
        ...body,
        paidAt: body.paidAt ? new Date(body.paidAt) : null,
      })
      .returning()

    return reply.status(201).send(item)
  })

  // Update budget item
  app.patch('/budget-items/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as any
    const userId = (req as any).userId as string
    const body = budgetItemSchema.partial().parse(req.body)

    // Verify access via wedding
    const [item] = await db.select().from(budgetItems).where(eq(budgetItems.id, id)).limit(1)
    if (!item) return reply.status(404).send({ error: 'Budget item not found' })

    const [wedding] = await db
      .select()
      .from(weddings)
      .where(eq(weddings.id, item.weddingId))
      .limit(1)

    if (!wedding || (wedding.partnerAId !== userId && wedding.partnerBId !== userId)) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    const [updated] = await db
      .update(budgetItems)
      .set({ ...body, paidAt: body.paidAt ? new Date(body.paidAt) : body.paidAt === null ? null : undefined, updatedAt: new Date() })
      .where(eq(budgetItems.id, id))
      .returning()

    return reply.send(updated)
  })

  // Delete budget item
  app.delete('/budget-items/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as any
    const userId = (req as any).userId as string

    const [item] = await db.select().from(budgetItems).where(eq(budgetItems.id, id)).limit(1)
    if (!item) return reply.status(404).send({ error: 'Not found' })

    const [wedding] = await db
      .select()
      .from(weddings)
      .where(eq(weddings.id, item.weddingId))
      .limit(1)

    if (!wedding || (wedding.partnerAId !== userId && wedding.partnerBId !== userId)) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    await db.delete(budgetItems).where(eq(budgetItems.id, id))
    return reply.status(204).send()
  })
}
