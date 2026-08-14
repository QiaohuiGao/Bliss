export interface MemoryProfileClaim {
  id: string
  subjectType: 'wedding' | 'couple' | 'member'
  subjectId: string | null
  kind: 'fact' | 'preference' | 'priority' | 'constraint' | 'ruled_out'
  key: string
  value: unknown
  source: 'explicit' | 'inferred' | 'decision'
  confidenceBasisPoints: number
  createdAt: Date
}

export interface MemoryProfile {
  wedding: MemoryProfileClaim[]
  couple: MemoryProfileClaim[]
  members: Record<string, MemoryProfileClaim[]>
  memberNames: Record<string, string | null>
}

/** Pure projection kept separate so retrieval behavior is deterministic and testable. */
export function projectMemoryProfile(claims: MemoryProfileClaim[]): MemoryProfile {
  const profile: MemoryProfile = { wedding: [], couple: [], members: {}, memberNames: {} }
  for (const claim of claims) {
    if (claim.subjectType === 'wedding') profile.wedding.push(claim)
    if (claim.subjectType === 'couple') profile.couple.push(claim)
    if (claim.subjectType === 'member' && claim.subjectId) {
      ;(profile.members[claim.subjectId] ??= []).push(claim)
    }
  }
  return profile
}
