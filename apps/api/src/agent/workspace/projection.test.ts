import { describe, expect, test } from 'bun:test'
import type { DecisionProposal, ExternalAction } from '@bliss/types'
import {
  projectWorkspaceCapabilities,
  projectWorkspaceMoment,
  projectWorkspaceProcedure,
  projectWorkspaceReadyActions,
} from './projection'

const base = {
  activeQuestionKey: 'photo.coverage',
  journey: [],
  proposal: null,
  confirmed: false,
  messageCount: 0,
  persistedActions: [] as ExternalAction[],
  persistedMoment: null,
}

describe('workspace projection', () => {
  test('starts with one current phase and no fabricated output', () => {
    expect(projectWorkspaceProcedure(base).map(phase => phase.state)).toEqual([
      'current', 'open', 'open', 'open', 'open',
    ])
    expect(projectWorkspaceReadyActions(base)).toEqual([])
    expect(projectWorkspaceMoment(base)).toBeNull()
  })

  test('distinguishes proposal previews from persisted effects', () => {
    const proposal = {
      externalActions: [{ kind: 'draft_email', payload: { to: ['studio@example.com'] }, requiresApproval: true }],
      momentCandidate: { title: 'A shared choice', narrative: 'We found the overlap.', sourceMessageIds: ['m1'] },
    } as unknown as DecisionProposal
    const input = { ...base, proposal, messageCount: 2 }

    expect(projectWorkspaceReadyActions(input)[0]).toMatchObject({
      source: 'proposal_preview', status: 'preview', id: null,
    })
    expect(projectWorkspaceMoment(input)).toMatchObject({
      source: 'proposal_preview', status: 'preview', id: null,
    })
  })

  test('moves action and memory phases from canonical state', () => {
    const input = {
      ...base,
      confirmed: true,
      messageCount: 2,
      persistedMoment: {
        id: 'moment-1',
        status: 'saved' as const,
        title: 'A shared choice',
        narrative: 'We found the overlap.',
        sourceMessageIds: ['m1'],
      },
    }

    expect(projectWorkspaceProcedure(input).map(phase => phase.state)).toEqual([
      'done', 'done', 'done', 'done', 'done',
    ])
  })

  test('projects every persisted action with its canonical review status', () => {
    const persistedActions = [
      {
        id: 'action-1',
        kind: 'draft_email',
        payload: { subject: 'Venue follow-up', body: 'Hello' },
        status: 'draft',
      },
      {
        id: 'action-2',
        kind: 'reminder',
        payload: { title: 'Review replies', triggerAt: '2027-01-02T12:00:00Z' },
        approvedPayload: { title: 'Review replies', triggerAt: '2027-01-03T12:00:00Z' },
        status: 'succeeded',
      },
    ] as unknown as ExternalAction[]

    expect(projectWorkspaceReadyActions({ ...base, confirmed: true, persistedActions })).toEqual([
      {
        source: 'persisted',
        id: 'action-1',
        kind: 'draft_email',
        payload: { subject: 'Venue follow-up', body: 'Hello' },
        status: 'draft',
      },
      {
        source: 'persisted',
        id: 'action-2',
        kind: 'reminder',
        payload: { title: 'Review replies', triggerAt: '2027-01-03T12:00:00Z' },
        status: 'succeeded',
      },
    ])
    expect(projectWorkspaceProcedure({ ...base, confirmed: true, persistedActions })[3]?.state).toBe('current')
  })

  test.each(['saved', 'dismissed'] as const)('treats a %s moment as resolved', status => {
    const persistedMoment = {
      id: 'moment-1',
      status,
      title: 'A shared choice',
      narrative: 'We found the overlap.',
      sourceMessageIds: ['m1'],
    }
    const projected = projectWorkspaceMoment({ ...base, confirmed: true, persistedMoment })

    expect(projected).toMatchObject({ source: 'persisted', id: 'moment-1', status })
    expect(projectWorkspaceProcedure({ ...base, confirmed: true, persistedMoment })[4]?.state).toBe('done')
  })

  test('keeps a suggested moment open until a member saves or dismisses it', () => {
    const persistedMoment = {
      id: 'moment-1',
      status: 'suggested' as const,
      title: 'A shared choice',
      narrative: 'We found the overlap.',
      sourceMessageIds: ['m1'],
    }

    expect(projectWorkspaceProcedure({ ...base, confirmed: true, persistedMoment })[4]?.state).toBe('current')
  })

  test('uses the question registry for photographer workflow and tools', () => {
    const input = {
      ...base,
      activeQuestionKey: 'photo.photographer_choice',
      proposal: { vendorEffects: [{ candidateId: 'vendor-1' }, { candidateId: 'vendor-2' }] } as DecisionProposal,
      messageCount: 2,
    }
    expect(projectWorkspaceProcedure(input).map(phase => phase.titleI18nKey)).toEqual([
      'workspace.workflow.photographerChoice.understand',
      'workspace.workflow.photographerChoice.explore',
      'workspace.workflow.photographerChoice.decide',
      'workspace.workflow.photographerChoice.act',
      'workspace.workflow.photographerChoice.remember',
    ])
    expect(projectWorkspaceCapabilities(input).map(capability => [capability.key, capability.enabled])).toEqual([
      ['findVendors', true],
      ['compareVendors', true],
      ['draftInquiry', true],
      ['planInterviews', true],
    ])
  })
})
