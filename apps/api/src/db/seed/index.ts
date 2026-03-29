import { db } from '../index'
import { users, weddings, tasks } from '../schema'
import { STAGE_TASKS } from './stage-tasks'
import type { PlanningStyle } from '@bliss/types'

export async function generateTasksForWedding(
  weddingId: string,
  planningStyle: PlanningStyle
) {
  const taskRows = STAGE_TASKS.map((t) => ({
    weddingId,
    stage: t.stage,
    title: t.title,
    whyItMatters: t.whyItMatters,
    howToDoIt: t.howToDoIt[planningStyle],
    doneDefinition: t.doneDefinition,
    dueGuidance: t.dueGuidance,
    isDeliverable: t.isDeliverable,
    celebrationTrigger: t.celebrationTrigger ?? null,
    sortOrder: t.sortOrder,
    status: 'pending' as const,
  }))

  await db.insert(tasks).values(taskRows)
  console.log(`Generated ${taskRows.length} tasks for wedding ${weddingId}`)
}

// Run as standalone seed for development
async function seed() {
  console.log('Seeding development data...')

  const [userA] = await db
    .insert(users)
    .values({
      clerkId: 'dev_user_a',
      displayName: 'Alex',
      email: 'alex@example.com',
    })
    .returning()

  const [userB] = await db
    .insert(users)
    .values({
      clerkId: 'dev_user_b',
      displayName: 'Jordan',
      email: 'jordan@example.com',
    })
    .returning()

  const [wedding] = await db
    .insert(weddings)
    .values({
      partnerAId: userA!.id,
      partnerBId: userB!.id,
      partnerAName: 'Alex',
      partnerBName: 'Jordan',
      guestCountMode: 'intimate',
      planningStyle: 'mixed',
      timelineMode: 'comfortable',
      locationMode: 'suburban',
      vibeTags: ['romantic', 'outdoor', 'intimate'],
      priorityTags: ['photography', 'food', 'music'],
      currentStage: 1,
    })
    .returning()

  await generateTasksForWedding(wedding!.id, 'mixed')

  console.log('Seed complete.')
  console.log(`Wedding ID: ${wedding!.id}`)
  process.exit(0)
}

// Run only when executed directly: bun run src/db/seed/index.ts
if (import.meta.main) {
  seed().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
