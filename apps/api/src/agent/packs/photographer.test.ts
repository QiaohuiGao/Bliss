import { describe, expect, it } from 'bun:test'
import type { DecisionProposalStore } from '../proposals/store'
import type { AgentToolContext, DecisionPacket } from '../types'
import { createPhotographerTools } from './photographer'

const context: AgentToolContext = {
  runId: 'run-1', weddingId: 'wedding-1', userId: 'member-1', threadId: 'thread-1',
}

class Store implements DecisionProposalStore {
  packet: DecisionPacket | null = null
  async create(_context: AgentToolContext, packet: DecisionPacket) {
    this.packet = packet
    return { proposalId: 'proposal-1', version: 1, status: 'pending' as const }
  }
}

const vendorEffects = ['v1', 'v2', 'v3'].map((candidateId, index) => ({
  candidateId,
  rationale: `Sourced comparison ${index + 1}.`,
  pros: ['Style evidence'],
  concerns: ['Confirm availability'],
}))

const packet = (overrides: Partial<DecisionPacket> = {}): DecisionPacket => ({
  schemaVersion: 1,
  threadId: context.threadId,
  questKey: 'vendor_team',
  questionKey: 'photo.photographer_choice',
  state: 'ready',
  summary: 'A sourced finalist best matches the couple\'s documentary priorities.',
  proposedChoice: 'v1',
  reason: 'Both members prefer candid coverage and this candidate shows that work.',
  alternativesConsidered: [],
  memberInputs: [],
  taskEffects: [],
  memoryEffects: [],
  externalActions: [],
  vendorEffects,
  momentCandidate: null,
  ...overrides,
})

function setup() {
  const store = new Store()
  const tools = createPhotographerTools({
    weddingLocation: { city: 'Brooklyn', state: 'NY' },
    proposalStore: store,
    vendorSearch: {
      async search() {
        return { candidates: [{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }] }
      },
    },
  })
  return {
    store,
    search: tools.find(tool => tool.definition.name === 'search_photographers')!,
    propose: tools.find(tool => tool.definition.name === 'propose_decision')!,
  }
}

const search = (tool: ReturnType<typeof setup>['search']) => tool.execute({
  city: 'Brooklyn', state: 'NY', style: 'documentary', limit: 5,
}, context)

describe('photographer selection pack', () => {
  it('chooses an exact returned candidate and adds only the booking task', async () => {
    const tools = setup()
    await search(tools.search)
    await tools.propose.execute(packet(), context)
    expect(tools.store.packet).toMatchObject({ proposedChoice: 'v1' })
    expect(tools.store.packet?.taskEffects.map(effect => effect.taskKey)).toEqual(['book_photographer'])
  })

  it('rejects a selected candidate that was not returned', async () => {
    const tools = setup()
    await search(tools.search)
    await expect(tools.propose.execute(packet({ proposedChoice: 'invented' }), context))
      .rejects.toMatchObject({ code: 'INVALID_VENDOR_CHOICE' })
  })

  it('requires the selected candidate in the sourced comparison', async () => {
    const tools = setup()
    await search(tools.search)
    await expect(tools.propose.execute(packet({ vendorEffects: vendorEffects.slice(1) }), context))
      .rejects.toMatchObject({ code: 'SELECTED_VENDOR_MISSING' })
  })

  it('rejects invented vendors and tasks', async () => {
    const tools = setup()
    await search(tools.search)
    await expect(tools.propose.execute(packet({
      vendorEffects: [...vendorEffects.slice(0, 2), { candidateId: 'invented', rationale: 'No source.', pros: [], concerns: [] }],
    }), context)).rejects.toMatchObject({ code: 'INVENTED_VENDOR' })
    await expect(tools.propose.execute(packet({
      taskEffects: [{ taskKey: 'book_videographer', rationale: 'Wrong question.' }],
    }), context)).rejects.toMatchObject({ code: 'INVENTED_TASK' })
  })

  it('requires a provider search before a ready proposal', async () => {
    const tools = setup()
    await expect(tools.propose.execute(packet(), context))
      .rejects.toMatchObject({ code: 'VENDOR_SEARCH_REQUIRED' })
  })

  it('keeps contested decisions free of downstream effects', async () => {
    const tools = setup()
    await expect(tools.propose.execute(packet({ state: 'contested', proposedChoice: null, reason: null }), context))
      .rejects.toMatchObject({ code: 'CONTESTED_SIDE_EFFECT' })
    await tools.propose.execute(packet({
      state: 'contested', proposedChoice: null, reason: null,
      taskEffects: [], vendorEffects: [], externalActions: [],
    }), context)
    expect(tools.store.packet?.state).toBe('contested')
  })

  it('does not search outside the wedding location', async () => {
    const tools = setup()
    await expect(tools.search.execute({
      city: 'Manhattan', state: 'NY', style: 'editorial', limit: 5,
    }, context)).rejects.toMatchObject({ code: 'VENDOR_LOCATION_MISMATCH' })
  })
})
