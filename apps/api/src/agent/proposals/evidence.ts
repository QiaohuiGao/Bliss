/**
 * Evidence citation checking for a Decision Packet.
 *
 * Every claim the assistant makes about the couple carries the message IDs it came
 * from, and the product leans on that: the memory UI lets a couple open any stored
 * preference and see the sentence it was derived from. But the model supplies those
 * IDs, and nothing about generating a plausible UUID is hard. An uncited claim is
 * rejected by `proposedMemoryClaimSchema`; a *fabricated* citation would pass schema
 * validation and land in storage looking exactly like a real one.
 *
 * That failure is quiet and permanent: the claim is retrieved into every later run,
 * the couple has no way to trace it, and the one affordance that makes a wrong
 * inference correctable is gone. So the commit path resolves every cited ID against
 * the thread's own messages before writing anything.
 *
 * The collector is separated from the database check so the traversal — which is the
 * part that silently rots when a new packet field starts carrying citations — is
 * unit-testable on its own.
 */

import type { DecisionPacket } from '../types'

/** Fields of a packet that cite evidence, for error messages that name the culprit. */
export type EvidenceSite =
  | { field: 'memoryEffects'; index: number; key: string }
  | { field: 'memberInputs'; index: number; memberId: string }
  | { field: 'momentCandidate' }

export interface EvidenceCitation {
  messageId: string
  site: EvidenceSite
}

/**
 * Every message ID the packet cites, with the site that cited it. A single ID cited
 * from two places appears twice: the point is to report which field is wrong, not to
 * deduplicate.
 */
export function evidenceCitations(packet: {
  memoryEffects: DecisionPacket['memoryEffects']
  memberInputs: DecisionPacket['memberInputs']
  momentCandidate: DecisionPacket['momentCandidate']
}): EvidenceCitation[] {
  const citations: EvidenceCitation[] = []

  packet.memoryEffects.forEach((effect, index) => {
    for (const messageId of effect.evidenceMessageIds) {
      citations.push({ messageId, site: { field: 'memoryEffects', index, key: effect.key } })
    }
  })

  packet.memberInputs.forEach((input, index) => {
    for (const messageId of input.sourceMessageIds) {
      citations.push({
        messageId,
        site: { field: 'memberInputs', index, memberId: input.memberId },
      })
    }
  })

  for (const messageId of packet.momentCandidate?.sourceMessageIds ?? []) {
    citations.push({ messageId, site: { field: 'momentCandidate' } })
  }

  return citations
}

/** Distinct IDs to resolve, for the single lookup the commit path performs. */
export function citedMessageIds(packet: Parameters<typeof evidenceCitations>[0]): string[] {
  return [...new Set(evidenceCitations(packet).map(citation => citation.messageId))]
}

const describeSite = (site: EvidenceSite): string => {
  if (site.field === 'memoryEffects') return `memoryEffects[${site.index}] (${site.key})`
  if (site.field === 'memberInputs') return `memberInputs[${site.index}] (${site.memberId})`
  return 'momentCandidate'
}

/**
 * Citations that do not resolve to a message in this thread, described well enough to
 * debug from a guardrail error alone.
 */
export function unresolvedCitations(
  packet: Parameters<typeof evidenceCitations>[0],
  knownMessageIds: Iterable<string>,
): string[] {
  const known = new Set(knownMessageIds)
  return evidenceCitations(packet)
    .filter(citation => !known.has(citation.messageId))
    .map(citation => `${describeSite(citation.site)} cites unknown message ${citation.messageId}`)
}
