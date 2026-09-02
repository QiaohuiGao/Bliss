import { describe, expect, test } from 'bun:test'
import { projectDecisionProposalApprovals } from './approvals'

describe('projectDecisionProposalApprovals', () => {
  const members = [
    { userId: 'maya', displayName: 'Maya' },
    { userId: 'theo', displayName: 'Theo' },
  ]

  test('keeps each member independent until both are ready', () => {
    const result = projectDecisionProposalApprovals('proposal-1', 'maya', members, [
      { userId: 'maya', approvedAt: new Date('2027-01-01T12:00:00Z') },
    ])

    expect(result.readyToConfirm).toBe(false)
    expect(result.readyMembers).toBe(1)
    expect(result.requiredMembers).toBe(2)
    expect(result.approvals).toEqual([
      {
        proposalId: 'proposal-1',
        userId: 'maya',
        displayName: 'Maya',
        isCurrentUser: true,
        ready: true,
        approvedAt: '2027-01-01T12:00:00.000Z',
      },
      {
        proposalId: 'proposal-1',
        userId: 'theo',
        displayName: 'Theo',
        isCurrentUser: false,
        ready: false,
        approvedAt: null,
      },
    ])
  })

  test('allows a one-member wedding to move forward after that member approves', () => {
    const result = projectDecisionProposalApprovals('proposal-1', 'maya', members.slice(0, 1), [
      { userId: 'maya', approvedAt: new Date('2027-01-01T12:00:00Z') },
    ])

    expect(result.readyToConfirm).toBe(true)
  })

  test('does not inflate readiness when an approval retry is observed twice', () => {
    const result = projectDecisionProposalApprovals('proposal-1', 'maya', members, [
      { userId: 'maya', approvedAt: new Date('2027-01-01T12:00:00Z') },
      { userId: 'maya', approvedAt: new Date('2027-01-01T12:00:01Z') },
    ])

    expect(result.readyMembers).toBe(1)
    expect(result.requiredMembers).toBe(2)
    expect(result.readyToConfirm).toBe(false)
    expect(result.approvals).toHaveLength(2)
  })

  test('ignores approval rows from users outside the wedding', () => {
    const result = projectDecisionProposalApprovals('proposal-1', 'maya', members, [
      { userId: 'maya', approvedAt: new Date('2027-01-01T12:00:00Z') },
      { userId: 'outsider', approvedAt: new Date('2027-01-01T12:00:00Z') },
    ])

    expect(result.readyMembers).toBe(1)
    expect(result.readyToConfirm).toBe(false)
  })
})
