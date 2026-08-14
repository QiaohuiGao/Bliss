import { and, asc, eq } from 'drizzle-orm'
import { db } from '../../db'
import { memoryClaims, users, weddingMembers } from '../../db/schema'
import { projectMemoryProfile, type MemoryProfile } from './projection'
export type { MemoryProfile, MemoryProfileClaim } from './projection'
export { projectMemoryProfile } from './projection'

export async function loadMemoryProfile(weddingId: string): Promise<MemoryProfile> {
  const claims = await db
    .select({
      id: memoryClaims.id,
      subjectType: memoryClaims.subjectType,
      subjectId: memoryClaims.subjectId,
      kind: memoryClaims.kind,
      key: memoryClaims.key,
      value: memoryClaims.value,
      source: memoryClaims.source,
      confidenceBasisPoints: memoryClaims.confidenceBasisPoints,
      createdAt: memoryClaims.createdAt,
    })
    .from(memoryClaims)
    .where(and(
      eq(memoryClaims.weddingId, weddingId),
      eq(memoryClaims.status, 'confirmed'),
    ))
    .orderBy(asc(memoryClaims.createdAt))
  const profile = projectMemoryProfile(claims)
  const members = await db.select({
    userId: weddingMembers.userId,
    displayName: users.displayName,
  }).from(weddingMembers)
    .innerJoin(users, eq(users.id, weddingMembers.userId))
    .where(eq(weddingMembers.weddingId, weddingId))
  profile.memberNames = Object.fromEntries(
    members.map(member => [member.userId, member.displayName]),
  )
  return profile
}
