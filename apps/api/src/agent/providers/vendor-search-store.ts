import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { vendorCandidates, vendorSearches } from '../../db/schema'
import { normalizedAgentError } from '../errors'
import type { AgentToolContext } from '../types'
import {
  normalizeProviderVendor,
  vendorSearchQuerySchema,
  type VendorSearchProvider,
} from './vendor-search'

export class DatabaseVendorSearchStore {
  constructor(private readonly provider: VendorSearchProvider) {}

  async search(context: AgentToolContext, rawQuery: unknown) {
    const query = vendorSearchQuerySchema.parse(rawQuery)
    const [search] = await db.insert(vendorSearches).values({
      weddingId: context.weddingId,
      threadId: context.threadId,
      agentRunId: context.runId,
      provider: this.provider.id,
      query,
    }).returning({ id: vendorSearches.id })

    try {
      const found = await this.provider.search(
        query,
        context.signal ?? new AbortController().signal,
      )
      const normalized = found.map(normalizeProviderVendor)
      const created = normalized.length > 0
        ? await db.insert(vendorCandidates).values(normalized.map(vendor => ({
            ...vendor,
            weddingId: context.weddingId,
            searchId: search!.id,
          }))).returning()
        : []
      await db.update(vendorSearches).set({
        status: 'succeeded',
        resultCount: created.length,
        completedAt: new Date(),
      }).where(eq(vendorSearches.id, search!.id))
      return {
        searchId: search!.id,
        query,
        untrustedExternalContent: true,
        candidates: created.map(candidate => ({
          id: candidate.id,
          name: candidate.name,
          website: candidate.website,
          sourceUrl: candidate.sourceUrl,
          city: candidate.city,
          state: candidate.state,
          priceLevel: candidate.priceLevel,
          summary: candidate.summary,
          metadata: candidate.metadata,
        })),
      }
    } catch (error) {
      await db.update(vendorSearches).set({
        status: 'failed',
        errorCode: normalizedAgentError(error).code,
        completedAt: new Date(),
      }).where(eq(vendorSearches.id, search!.id))
      throw error
    }
  }
}
