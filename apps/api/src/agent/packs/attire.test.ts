import { describe, expect, it } from 'bun:test'
import { AgentGuardrailError } from '../errors'
import type { AgentToolContext, DecisionPacket } from '../types'
import type { DecisionProposalStore } from '../proposals/store'
import { createAttireTools } from './attire'

const context: AgentToolContext = {
  runId: 'run-1',
  weddingId: 'wedding-1',
  userId: 'member-1',
  threadId: 'thread-1',
}

const readyPacket = (overrides: Partial<DecisionPacket> = {}): DecisionPacket => ({
  schemaVersion: 1,
  threadId: context.threadId,
  questKey: 'attire_beauty',
  questionKey: 'attire.dress_acquisition',
  state: 'ready',
  summary: 'You prefer a custom gown because craftsmanship matters most.',
  proposedChoice: 'buy_custom',
  reason: 'Craftsmanship and a personal fit matter more than speed.',
  alternativesConsidered: [],
  memberInputs: [],
  taskEffects: [{ taskKey: 'order_the_gown', rationale: 'Matches the custom choice.' }],
  memoryEffects: [],
  externalActions: [],
  vendorEffects: [],
  momentCandidate: null,
  ...overrides,
})

class MemoryProposalStore implements DecisionProposalStore {
  packet: DecisionPacket | null = null

  async create(_context: AgentToolContext, packet: DecisionPacket) {
    this.packet = packet
    return { proposalId: 'proposal-1', version: 1, status: 'pending' as const }
  }
}

const toolsWithStore = () => {
  const store = new MemoryProposalStore()
  const tools = createAttireTools({ resolverInput: {}, proposalStore: store })
  return {
    store,
    candidate: tools.find(tool => tool.definition.name === 'get_candidate_tasks')!,
    propose: tools.find(tool => tool.definition.name === 'propose_decision')!,
  }
}

describe('attire decision tools', () => {
  it('persists a proposal built only from deterministic candidates', async () => {
    const { candidate, propose, store } = toolsWithStore()
    const pool = await candidate.execute({ choice: 'buy_custom' }, context) as {
      candidates: Array<{ taskKey: string }>
    }
    expect(pool.candidates.some(task => task.taskKey === 'order_the_gown')).toBe(true)

    const result = await propose.execute(readyPacket(), context)

    expect(result).toEqual({ proposalId: 'proposal-1', version: 1, status: 'pending' })
    expect(store.packet?.proposedChoice).toBe('buy_custom')
    expect(store.packet?.taskEffects.map(effect => effect.taskKey)).toEqual([
      'book_salon_appointments',
      'order_the_gown',
      'first_fitting',
      'second_fitting',
      'final_fitting_and_bustle',
      'learn_the_bustle',
    ])
  })

  it('requires candidate retrieval before proposing tasks', async () => {
    const { propose } = toolsWithStore()
    await expect(propose.execute(readyPacket(), context)).rejects.toMatchObject({
      code: 'CANDIDATES_NOT_READ',
    } satisfies Partial<AgentGuardrailError>)
  })

  it('rejects invented task keys', async () => {
    const { candidate, propose } = toolsWithStore()
    await candidate.execute({ choice: 'buy_custom' }, context)
    await expect(propose.execute(readyPacket({
      taskEffects: [{ taskKey: 'email_every_salon', rationale: 'Convenient.' }],
    }), context)).rejects.toMatchObject({ code: 'INVENTED_TASK' })
  })

  it('binds the candidate pool to the proposed choice', async () => {
    const { candidate, propose } = toolsWithStore()
    await candidate.execute({ choice: 'buy_custom' }, context)
    await expect(propose.execute(readyPacket({
      proposedChoice: 'rent',
      reason: 'Renting is the preferred tradeoff.',
      taskEffects: [{ taskKey: 'order_the_gown', rationale: 'Wrong branch.' }],
    }), context)).rejects.toMatchObject({ code: 'CANDIDATES_NOT_READ' })
  })

  it('rejects duplicate task effects', async () => {
    const { candidate, propose } = toolsWithStore()
    await candidate.execute({ choice: 'buy_custom' }, context)
    await expect(propose.execute(readyPacket({
      taskEffects: [
        { taskKey: 'order_the_gown', rationale: 'First.' },
        { taskKey: 'order_the_gown', rationale: 'Duplicate.' },
      ],
    }), context)).rejects.toMatchObject({ code: 'DUPLICATE_TASK_EFFECT' })
  })

  it('never materializes tasks while the couple is contested', async () => {
    const { candidate, propose } = toolsWithStore()
    await candidate.execute({ choice: 'buy_custom' }, context)
    await expect(propose.execute(readyPacket({
      state: 'contested',
      proposedChoice: null,
      reason: null,
    }), context)).rejects.toMatchObject({ code: 'CONTESTED_SIDE_EFFECT' })
  })

  it('accepts a contested proposal when it contains no task effects', async () => {
    const { propose, store } = toolsWithStore()
    await propose.execute(readyPacket({
      state: 'contested',
      proposedChoice: null,
      reason: null,
      taskEffects: [],
    }), context)
    expect(store.packet?.state).toBe('contested')
  })
})
