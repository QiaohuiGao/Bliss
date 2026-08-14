import { strict as assert } from 'node:assert'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../src/db'
import { activityFeed, users, weddingMembers, weddings } from '../src/db/schema'
import { createPartnerInvite, joinWeddingByInvite } from '../src/services/couple-workspace'

const userIds: string[] = []
const weddingIds: string[] = []

try {
  const createdUsers = await db.insert(users).values([
    { clerkId: `couple-owner-${crypto.randomUUID()}`, email: `owner-${crypto.randomUUID()}@bliss.invalid`, displayName: 'Alex' },
    { clerkId: `couple-partner-a-${crypto.randomUUID()}`, email: `partner-a-${crypto.randomUUID()}@bliss.invalid`, displayName: 'Jordan' },
    { clerkId: `couple-partner-b-${crypto.randomUUID()}`, email: `partner-b-${crypto.randomUUID()}@bliss.invalid`, displayName: 'Taylor' },
  ]).returning({ id: users.id })
  userIds.push(...createdUsers.map(user => user.id))
  const [owner, partnerA, partnerB] = createdUsers

  const [wedding] = await db.insert(weddings).values({
    weddingDate: '2027-06-12',
    state: 'NY',
    city: 'Brooklyn',
    weddingType: 'traditional',
    cultures: [],
    plannerType: 'none',
  }).returning({ id: weddings.id })
  weddingIds.push(wedding!.id)
  await db.insert(weddingMembers).values({
    weddingId: wedding!.id,
    userId: owner!.id,
    role: 'owner',
  })

  const firstInvite = await createPartnerInvite({
    weddingId: wedding!.id,
    userId: owner!.id,
    webUrl: 'https://bliss.invalid/',
  })
  const replayedInvite = await createPartnerInvite({
    weddingId: wedding!.id,
    userId: owner!.id,
    webUrl: 'https://bliss.invalid',
  })
  assert.equal(firstInvite.status, 'created')
  assert.equal(replayedInvite.status, 'created')
  assert.equal(
    firstInvite.status === 'created' && firstInvite.inviteUrl,
    replayedInvite.status === 'created' && replayedInvite.inviteUrl,
  )
  const token = new URL(firstInvite.status === 'created' ? firstInvite.inviteUrl : '').searchParams.get('token')
  assert.ok(token)

  const joinResults = await Promise.all([
    joinWeddingByInvite({ userId: partnerA!.id, token }),
    joinWeddingByInvite({ userId: partnerB!.id, token }),
  ])
  assert.equal(joinResults.filter(result => result.status === 'joined').length, 1)
  assert.equal(joinResults.filter(result => result.status === 'invalid').length, 1)
  const joinedIndex = joinResults.findIndex(result => result.status === 'joined')
  const joinedUserId = joinedIndex === 0 ? partnerA!.id : partnerB!.id

  const members = await db.select().from(weddingMembers)
    .where(eq(weddingMembers.weddingId, wedding!.id))
  assert.equal(members.length, 2)
  assert.equal(members.filter(member => member.role === 'owner').length, 1)
  assert.equal(members.filter(member => member.role === 'partner').length, 1)

  const [storedWedding] = await db.select({ inviteToken: weddings.inviteToken })
    .from(weddings).where(eq(weddings.id, wedding!.id))
  assert.equal(storedWedding!.inviteToken, null)
  const joinedActivity = await db.select().from(activityFeed).where(eq(
    activityFeed.weddingId,
    wedding!.id,
  ))
  assert.equal(joinedActivity.filter(item => item.action === 'member_joined').length, 1)

  const nonOwnerInvite = await createPartnerInvite({
    weddingId: wedding!.id,
    userId: joinedUserId,
    webUrl: 'https://bliss.invalid',
  })
  assert.equal(nonOwnerInvite.status, 'forbidden')
  const fullInvite = await createPartnerInvite({
    weddingId: wedding!.id,
    userId: owner!.id,
    webUrl: 'https://bliss.invalid',
  })
  assert.equal(fullInvite.status, 'full')

  console.log('PASS: couple workspace database smoke test')
  console.log('  owner invite: stable and owner-only')
  console.log('  concurrent join: exactly one partner admitted')
  console.log('  workspace membership: exactly two attributed people')
  console.log('  invite token: single-use and consumed atomically')
} finally {
  if (weddingIds.length) await db.delete(weddings).where(inArray(weddings.id, weddingIds))
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds))
}

process.exit(0)
