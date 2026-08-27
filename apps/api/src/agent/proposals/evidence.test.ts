import { describe, expect, it } from 'bun:test'
import { citedMessageIds, evidenceCitations, unresolvedCitations } from './evidence'

const packet = (overrides: Partial<Parameters<typeof evidenceCitations>[0]> = {}) => ({
  memoryEffects: [],
  memberInputs: [],
  momentCandidate: null,
  ...overrides,
} as Parameters<typeof evidenceCitations>[0])

const claim = (key: string, evidenceMessageIds: string[]) => ({
  subjectType: 'couple' as const,
  subjectId: null,
  kind: 'preference' as const,
  key,
  value: 'garden',
  source: 'inferred' as const,
  confidenceBasisPoints: 6_000,
  evidenceMessageIds,
})

describe('evidenceCitations', () => {
  it('collects citations from all three citing fields', () => {
    const citations = evidenceCitations(packet({
      memoryEffects: [claim('style.aesthetic', ['m1', 'm2'])],
      memberInputs: [{
        memberId: 'member-a',
        stance: 'prefers a garden venue',
        reason: null,
        sourceMessageIds: ['m3'],
      }],
      momentCandidate: {
        title: 'You chose the garden',
        narrative: 'Because it felt like you.',
        sourceMessageIds: ['m4'],
      },
    }))

    expect(citations.map(citation => citation.messageId)).toEqual(['m1', 'm2', 'm3', 'm4'])
    expect(citations[0]!.site).toEqual({ field: 'memoryEffects', index: 0, key: 'style.aesthetic' })
    expect(citations[2]!.site).toEqual({ field: 'memberInputs', index: 0, memberId: 'member-a' })
    expect(citations[3]!.site).toEqual({ field: 'momentCandidate' })
  })

  it('treats a packet with no citations as empty rather than failing', () => {
    expect(evidenceCitations(packet())).toEqual([])
    expect(citedMessageIds(packet())).toEqual([])
  })

  it('deduplicates only for the lookup, not for reporting', () => {
    const input = packet({
      memoryEffects: [claim('a', ['m1']), claim('b', ['m1'])],
    })
    expect(evidenceCitations(input)).toHaveLength(2)
    expect(citedMessageIds(input)).toEqual(['m1'])
  })
})

describe('unresolvedCitations', () => {
  it('passes when every cited message exists', () => {
    const input = packet({ memoryEffects: [claim('style.aesthetic', ['m1', 'm2'])] })
    expect(unresolvedCitations(input, ['m1', 'm2', 'm3'])).toEqual([])
  })

  it('names the field and key of a fabricated citation', () => {
    const input = packet({ memoryEffects: [claim('style.aesthetic', ['m1', 'ghost'])] })
    expect(unresolvedCitations(input, ['m1'])).toEqual([
      'memoryEffects[0] (style.aesthetic) cites unknown message ghost',
    ])
  })

  it('reports every unresolved citation, not just the first', () => {
    const input = packet({
      memoryEffects: [claim('a', ['ghost-1'])],
      memberInputs: [{
        memberId: 'member-b',
        stance: 'wants a bigger guest list',
        reason: null,
        sourceMessageIds: ['ghost-2'],
      }],
      momentCandidate: { title: 't', narrative: 'n', sourceMessageIds: ['ghost-3'] },
    })
    expect(unresolvedCitations(input, [])).toEqual([
      'memoryEffects[0] (a) cites unknown message ghost-1',
      'memberInputs[0] (member-b) cites unknown message ghost-2',
      'momentCandidate cites unknown message ghost-3',
    ])
  })
})
