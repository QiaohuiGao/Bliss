import type {
  ApproveDecisionProposalResult,
  DecisionProposalMemberApproval,
} from '@bliss/types'

export interface ApprovalMemberRow {
  userId: string
  displayName: string | null
}

export interface ApprovalRow {
  userId: string
  approvedAt: Date
}

export function projectDecisionProposalApprovals(
  proposalId: string,
  currentUserId: string,
  members: ApprovalMemberRow[],
  approvals: ApprovalRow[],
): ApproveDecisionProposalResult {
  const approvalByUser = new Map(approvals.map(approval => [approval.userId, approval]))
  const projected: DecisionProposalMemberApproval[] = members.map(member => {
    const approval = approvalByUser.get(member.userId)
    return {
      proposalId,
      userId: member.userId,
      displayName: member.displayName,
      isCurrentUser: member.userId === currentUserId,
      ready: Boolean(approval),
      approvedAt: approval?.approvedAt.toISOString() ?? null,
    }
  })
  const readyMembers = projected.filter(approval => approval.ready).length
  return {
    proposalId,
    readyMembers,
    requiredMembers: projected.length,
    readyToConfirm: projected.length > 0 && readyMembers === projected.length,
    approvals: projected,
  }
}
