import crypto from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db'
import { activityFeed, users, weddingMembers, weddings } from '../db/schema'

export type CreatePartnerInviteResult =
  | { status: 'created'; inviteUrl: string }
  | { status: 'forbidden' }
  | { status: 'full' }

export async function createPartnerInvite(input: {
  weddingId: string
  userId: string
  webUrl: string
}): Promise<CreatePartnerInviteResult> {
  const members = await db
    .select()
    .from(weddingMembers)
    .where(eq(weddingMembers.weddingId, input.weddingId))
  const currentMembership = members.find(member => member.userId === input.userId)
  if (currentMembership?.role !== 'owner') return { status: 'forbidden' }
  if (members.length >= 2) return { status: 'full' }

  const [wedding] = await db.select({ inviteToken: weddings.inviteToken })
    .from(weddings).where(eq(weddings.id, input.weddingId)).limit(1)
  if (!wedding) return { status: 'forbidden' }
  const inviteToken = wedding.inviteToken ?? crypto.randomBytes(32).toString('hex')
  if (!wedding.inviteToken) {
    await db.update(weddings).set({ inviteToken, updatedAt: new Date() })
      .where(eq(weddings.id, input.weddingId))
  }
  const webUrl = input.webUrl.replace(/\/$/, '')
  return {
    status: 'created',
    inviteUrl: `${webUrl}/join?token=${encodeURIComponent(inviteToken)}`,
  }
}

export type JoinWeddingResult =
  | { status: 'joined'; wedding: typeof weddings.$inferSelect }
  | { status: 'invalid' }
  | { status: 'already_has_wedding' }
  | { status: 'full' }

export async function joinWeddingByInvite(input: {
  userId: string
  token: string
}): Promise<JoinWeddingResult> {
  return db.transaction(async tx => {
    // Serialize attempts on one invite. A second concurrent request resumes
    // only after the first has consumed the token, so the workspace stays at
    // exactly two people.
    await tx.execute(sql`
      SELECT ${weddings.id}
      FROM ${weddings}
      WHERE ${weddings.inviteToken} = ${input.token}
      FOR UPDATE
    `)
    const [wedding] = await tx
      .select()
      .from(weddings)
      .where(eq(weddings.inviteToken, input.token))
      .limit(1)
    if (!wedding) return { status: 'invalid' as const }

    const [existingMembership] = await tx
      .select({ weddingId: weddingMembers.weddingId })
      .from(weddingMembers)
      .where(eq(weddingMembers.userId, input.userId))
      .limit(1)
    if (existingMembership) return { status: 'already_has_wedding' as const }

    const existingMembers = await tx
      .select({ id: weddingMembers.id })
      .from(weddingMembers)
      .where(eq(weddingMembers.weddingId, wedding.id))
    if (existingMembers.length >= 2) return { status: 'full' as const }

    await tx.insert(weddingMembers).values({
      weddingId: wedding.id,
      userId: input.userId,
      role: 'partner',
    })
    const [joiningUser] = await tx.select({ displayName: users.displayName })
      .from(users).where(eq(users.id, input.userId)).limit(1)
    await tx.insert(activityFeed).values({
      weddingId: wedding.id,
      userId: input.userId,
      action: 'member_joined',
      targetType: 'wedding',
      targetId: wedding.id,
      metadata: { name: joiningUser?.displayName ?? 'Partner' },
    })
    const [updated] = await tx
      .update(weddings)
      .set({ inviteToken: null, updatedAt: new Date() })
      .where(eq(weddings.id, wedding.id))
      .returning()
    return { status: 'joined' as const, wedding: updated! }
  })
}
