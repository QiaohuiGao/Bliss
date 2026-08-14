import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { licenseWindow } from '../content/marriage-license'
import { normalizedAgentError } from '../agent/errors'
import { configuredMarriageLicenseAuthorityProvider } from '../agent/providers/legal-authority'
import { db } from '../db'
import { weddings } from '../db/schema'
import { requireAuth, requireWeddingAccess } from '../middleware/auth'

const lookupQuerySchema = z.object({
  county: z.string().trim().min(1).max(120).optional(),
}).strict()

export async function legalRoutes(app: FastifyInstance) {
  const access = { preHandler: [requireAuth, requireWeddingAccess] }

  app.get('/weddings/:weddingId/legal/marriage-license', access, async (req, reply) => {
    const { weddingId } = req.params as { weddingId: string }
    const parsedQuery = lookupQuerySchema.safeParse(req.query)
    if (!parsedQuery.success) {
      return reply.status(400).send({
        error: 'County must be a valid jurisdiction name',
        code: 'LEGAL_AUTHORITY_QUERY_INVALID',
      })
    }
    const [wedding] = await db.select({
      state: weddings.state,
      weddingDate: weddings.weddingDate,
    }).from(weddings).where(eq(weddings.id, weddingId)).limit(1)
    if (!wedding?.state) {
      return reply.status(422).send({
        error: 'Add the wedding state before checking marriage-license rules',
        code: 'LEGAL_AUTHORITY_STATE_REQUIRED',
      })
    }

    let provider
    try {
      provider = configuredMarriageLicenseAuthorityProvider()
    } catch (error) {
      const normalized = normalizedAgentError(error)
      req.log.error({ error: normalized }, 'Legal authority provider configuration is invalid')
      return reply.status(503).send({ error: normalized.message, ...normalized })
    }
    if (!provider) {
      return reply.status(503).send({
        error: 'Verified marriage-license lookup is not configured',
        code: 'LEGAL_AUTHORITY_PROVIDER_NOT_CONFIGURED',
        retryable: false,
      })
    }

    const controller = new AbortController()
    req.raw.once('aborted', () => controller.abort(new Error('Request closed')))
    try {
      const rule = await provider.lookup({
        state: wedding.state,
        county: parsedQuery.data.county,
      }, controller.signal)
      if (!rule) {
        return reply.send({
          status: 'verification_required',
          code: 'LEGAL_AUTHORITY_NOT_COVERED',
          state: wedding.state,
          county: parsedQuery.data.county ?? null,
          rule: null,
          window: null,
          disclaimerKey: 'quest.legal.disclaimer',
        })
      }
      const weddingDate = wedding.weddingDate
        ? new Date(`${wedding.weddingDate}T12:00:00.000Z`)
        : null
      return reply.send({
        status: 'verified',
        provider: provider.id,
        rule,
        window: weddingDate ? licenseWindow(rule, weddingDate) : null,
        untrustedExternalContent: true,
        disclaimerKey: 'quest.legal.disclaimer',
      })
    } catch (error) {
      const normalized = normalizedAgentError(error)
      req.log.error({
        error: normalized,
        weddingId,
        state: wedding.state,
      }, 'Verified marriage-license lookup failed')
      const status = normalized.retryable ? 503 : 422
      return reply.status(status).send({ error: normalized.message, ...normalized })
    }
  })
}
