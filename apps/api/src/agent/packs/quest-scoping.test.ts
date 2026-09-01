import { describe, expect, it } from 'bun:test'
import type { DecisionProposalStore } from '../proposals/store'
import type { AgentToolContext, DecisionPacket } from '../types'
import { createQuestScopingTools } from './quest-scoping'

const context: AgentToolContext = {
  runId: 'run-1',
  weddingId: 'wedding-1',
  userId: 'member-1',
  threadId: 'thread-1',
}

class CaptureStore implements DecisionProposalStore {
  packet: DecisionPacket | null = null
  async create(_context: AgentToolContext, packet: DecisionPacket) {
    this.packet = packet
    return { proposalId: 'proposal-1', version: 1, status: 'pending' as const }
  }
}

const packet = (overrides: Partial<DecisionPacket> = {}): DecisionPacket => ({
  schemaVersion: 1,
  threadId: context.threadId,
  questKey: 'food_beverage',
  questionKey: 'food.service_style',
  state: 'ready',
  summary: 'Buffet keeps the evening relaxed and lets guests choose portions.',
  proposedChoice: 'buffet',
  reason: 'The couple values an informal flow and flexible portions.',
  alternativesConsidered: [{ value: 'plated', tradeoff: 'More formal, with stationery dependencies.' }],
  memberInputs: [{
    memberId: 'member-1',
    stance: 'buffet',
    reason: 'We want the meal to feel relaxed.',
    sourceMessageIds: ['message-1'],
  }],
  taskEffects: [{
    taskKey: 'confirm_line_count_and_flow',
    rationale: 'Prevent queues once buffet is selected.',
  }],
  memoryEffects: [],
  externalActions: [],
  vendorEffects: [],
  momentCandidate: null,
  ...overrides,
})

const tools = (store = new CaptureStore(), questionKey = 'food.service_style') => {
  const result = createQuestScopingTools({
    questKey: 'food_beverage',
    questionKey,
    resolverInput: { weddingType: 'traditional', cultures: [], plannerType: 'none' },
    activeAnswers: { 'food.bar_package': 'dry' },
    proposalStore: store,
  })
  return { store, questions: result[0]!, candidates: result[1]!, propose: result[2]! }
}

describe('generic quest scoping pack', () => {
  it('exposes only the active authored question', async () => {
    const { questions } = tools(new CaptureStore(), 'food.bar_package')
    const result = await questions.execute({}, context) as {
      questions: Array<{ questionKey: string; currentChoice: string; source: string }>
    }
    expect(result.questions).toHaveLength(1)
    expect(result.questions[0]).toMatchObject({
      questionKey: 'food.bar_package',
      currentChoice: 'dry',
      source: 'confirmed',
    })
  })

  it('rejects access to another question in the same quest', async () => {
    const { candidates, propose } = tools()
    expect(candidates.execute({
      questionKey: 'food.bar_package',
      choice: 'dry',
    }, context)).rejects.toMatchObject({ code: 'INVALID_QUESTION' })
    expect(propose.execute(packet({
      questionKey: 'food.bar_package',
      proposedChoice: 'dry',
      taskEffects: [],
    }), context)).rejects.toMatchObject({ code: 'INVALID_QUESTION' })
  })

  it('returns only tasks controlled by the selected question and branch', async () => {
    const { candidates } = tools()
    const result = await candidates.execute({
      questionKey: 'food.service_style',
      choice: 'buffet',
    }, context) as { candidates: Array<{ taskKey: string }> }
    expect(result.candidates.map(item => item.taskKey)).toEqual(['confirm_line_count_and_flow'])
  })

  it('creates a grounded proposal from the exact candidate pool', async () => {
    const { store, candidates, propose } = tools()
    await candidates.execute({ questionKey: 'food.service_style', choice: 'buffet' }, context)
    await propose.execute(packet(), context)
    expect(store.packet?.proposedChoice).toBe('buffet')
  })

  it('rejects an invented or cross-question task', async () => {
    const { candidates, propose } = tools()
    await candidates.execute({ questionKey: 'food.service_style', choice: 'buffet' }, context)
    expect(propose.execute(packet({
      taskEffects: [{ taskKey: 'collect_meal_choices_with_rsvp', rationale: 'Invented for this branch.' }],
    }), context)).rejects.toMatchObject({ code: 'INVENTED_TASK' })
  })

  it('keeps contested proposals free of downstream effects', async () => {
    const { propose } = tools()
    expect(propose.execute(packet({
      state: 'contested',
      proposedChoice: null,
      reason: null,
      externalActions: [{
        kind: 'reminder',
        payload: { title: 'Decide', triggerAt: '2027-01-01T09:00:00-05:00' },
        requiresApproval: true,
      }],
    }), context)).rejects.toMatchObject({ code: 'CONTESTED_SIDE_EFFECT' })
  })

  it('shows the full deterministic branch even when the model previews only one task', async () => {
    const store = new CaptureStore()
    const [questions, candidates, propose] = createQuestScopingTools({
      questKey: 'guests_stationery',
      questionKey: 'guests.invitation_format',
      resolverInput: { weddingType: 'traditional', cultures: [], plannerType: 'none' },
      activeAnswers: {},
      proposalStore: store,
    })
    await questions!.execute({}, context)
    await candidates!.execute({
      questionKey: 'guests.invitation_format',
      choice: 'digital_first',
    }, context)
    await propose!.execute(packet({
      questKey: 'guests_stationery',
      questionKey: 'guests.invitation_format',
      proposedChoice: 'digital_first',
      taskEffects: [{
        taskKey: 'choose_digital_invitation_platform',
        rationale: 'Choose the system of record.',
      }],
    }), context)
    expect(store.packet?.taskEffects.map(effect => effect.taskKey)).toEqual([
      'choose_digital_invitation_platform',
      'test_digital_delivery_and_rsvp',
      'plan_offline_guest_backup',
    ])
  })

  it('supports the attire questions outside the specialized gown flow', async () => {
    const store = new CaptureStore()
    const [questions, candidates, propose] = createQuestScopingTools({
      questKey: 'attire_beauty',
      questionKey: 'attire.suit_acquisition',
      resolverInput: { weddingType: 'traditional', cultures: [], plannerType: 'none' },
      activeAnswers: {},
      proposalStore: store,
    })
    const overview = await questions!.execute({}, context) as {
      questions: Array<{ questionKey: string }>
    }
    expect(overview.questions.map(question => question.questionKey)).toEqual([
      'attire.suit_acquisition',
    ])
    const result = await candidates!.execute({
      questionKey: 'attire.suit_acquisition',
      choice: 'custom_tailor',
    }, context) as { candidates: Array<{ taskKey: string }> }
    expect(result.candidates.map(candidate => candidate.taskKey)).toEqual([
      'order_suit',
      'custom_suit_measurements',
      'suit_alterations',
    ])
    await propose!.execute(packet({
      questKey: 'attire_beauty',
      questionKey: 'attire.suit_acquisition',
      proposedChoice: 'custom_tailor',
      taskEffects: [{
        taskKey: 'custom_suit_measurements',
        rationale: 'Start the made-to-measure path early.',
      }],
    }), context)
    expect(store.packet?.taskEffects.map(effect => effect.taskKey)).toEqual([
      'order_suit',
      'custom_suit_measurements',
      'suit_alterations',
    ])
  })

  it('settles Vendor Team coverage without requiring a live vendor provider', async () => {
    const store = new CaptureStore()
    const [questions, candidates, propose] = createQuestScopingTools({
      questKey: 'vendor_team',
      questionKey: 'photo.coverage',
      resolverInput: { weddingType: 'traditional', cultures: [], plannerType: 'none' },
      activeAnswers: {},
      proposalStore: store,
    })
    const overview = await questions!.execute({}, context) as {
      questions: Array<{ questionKey: string }>
    }
    expect(overview.questions.map(question => question.questionKey)).toEqual(['photo.coverage'])
    const result = await candidates!.execute({
      questionKey: 'photo.coverage',
      choice: 'photo_video_content',
    }, context) as { candidates: Array<{ taskKey: string }> }
    expect(result.candidates.map(candidate => candidate.taskKey)).toEqual([
      'book_videographer',
      'book_content_creator',
    ])
    await propose!.execute(packet({
      questKey: 'vendor_team',
      questionKey: 'photo.coverage',
      proposedChoice: 'photo_video_content',
      taskEffects: [{
        taskKey: 'book_content_creator',
        rationale: 'Keep the short-form coverage the couple explicitly chose.',
      }],
    }), context)
    expect(store.packet?.taskEffects.map(effect => effect.taskKey)).toEqual([
      'book_videographer',
      'book_content_creator',
    ])
  })
})
