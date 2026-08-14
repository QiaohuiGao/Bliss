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

const packet = (overrides: Partial<DecisionPacket> = {}): DecisionPacket => ({
  schemaVersion: 1,
  threadId: context.threadId,
  questKey: 'vendor_team',
  questionKey: 'photo.coverage',
  state: 'ready',
  summary: 'Photography matters most; video can stay lean.',
  proposedChoice: 'photo_only',
  reason: 'You both prioritize still images and a calm day.',
  alternativesConsidered: [],
  memberInputs: [],
  taskEffects: [{ taskKey: 'shortlist_photographers', rationale: 'Compare a focused set.' }],
  memoryEffects: [],
  externalActions: [],
  vendorEffects: [
    { candidateId: 'v1', rationale: 'Strong documentary fit.', pros: ['Style fit'], concerns: ['Confirm price'] },
    { candidateId: 'v2', rationale: 'Good local experience.', pros: ['Local'], concerns: ['Review full galleries'] },
    { candidateId: 'v3', rationale: 'Balanced alternative.', pros: ['Flexible'], concerns: ['Confirm availability'] },
  ],
  momentCandidate: null,
  ...overrides,
})

function setup() {
  const store = new Store()
  const tools = createPhotographerTools({
    resolverInput: {},
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
    tasks: tools.find(tool => tool.definition.name === 'get_candidate_tasks')!,
    search: tools.find(tool => tool.definition.name === 'search_photographers')!,
    propose: tools.find(tool => tool.definition.name === 'propose_decision')!,
  }
}

describe('photographer pack', () => {
  it('creates a proposal only from authored tasks and returned vendors', async () => {
    const tools = setup()
    await tools.tasks.execute({ choice: 'photo_only' }, context)
    await tools.search.execute({ city: 'Brooklyn', state: 'NY', style: 'documentary', limit: 5 }, context)
    await tools.propose.execute(packet(), context)
    expect(tools.store.packet?.vendorEffects).toHaveLength(3)
  })

  it('shows the full coverage branch before confirmation', async () => {
    const tools = setup()
    await tools.tasks.execute({ choice: 'photo_video' }, context)
    await tools.search.execute({ city: 'Brooklyn', state: 'NY', style: 'documentary', limit: 5 }, context)
    await tools.propose.execute(packet({
      proposedChoice: 'photo_video',
      taskEffects: [{ taskKey: 'shortlist_photographers', rationale: 'Compare a focused set.' }],
    }), context)
    expect(tools.store.packet?.taskEffects.map(effect => effect.taskKey)).toContain('book_videographer')
  })

  it('requires the exact candidate branch even when the model proposes no tasks', async () => {
    const tools = setup()
    await tools.search.execute({ city: 'Brooklyn', state: 'NY', style: 'documentary', limit: 5 }, context)
    await expect(tools.propose.execute(packet({ taskEffects: [] }), context)).rejects.toMatchObject({
      code: 'CANDIDATES_NOT_READ',
    })
  })

  it('rejects an invented vendor', async () => {
    const tools = setup()
    await tools.tasks.execute({ choice: 'photo_only' }, context)
    await tools.search.execute({ city: 'Brooklyn', state: 'NY', style: 'documentary', limit: 5 }, context)
    await expect(tools.propose.execute(packet({
      vendorEffects: [
        { candidateId: 'v1', rationale: 'Returned.', pros: [], concerns: [] },
        { candidateId: 'v2', rationale: 'Returned.', pros: [], concerns: [] },
        { candidateId: 'invented', rationale: 'No source.', pros: [], concerns: [] },
      ],
    }), context)).rejects.toMatchObject({ code: 'INVENTED_VENDOR' })
  })

  it('keeps contested decisions free of downstream effects', async () => {
    const tools = setup()
    await expect(tools.propose.execute(packet({
      state: 'contested', proposedChoice: null, reason: null,
    }), context)).rejects.toMatchObject({ code: 'CONTESTED_SIDE_EFFECT' })
  })

  it('accepts a clean contested proposal without searching', async () => {
    const tools = setup()
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
