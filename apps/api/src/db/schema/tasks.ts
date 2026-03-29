import { pgTable, text, timestamp, integer, boolean, pgEnum } from 'drizzle-orm/pg-core'
import { weddings } from './weddings'
import { users } from './users'

export const taskStatusEnum = pgEnum('task_status', ['pending', 'in_progress', 'complete', 'skipped'])

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  stage: integer('stage').notNull(),
  title: text('title').notNull(),
  whyItMatters: text('why_it_matters').notNull(),
  howToDoIt: text('how_to_do_it').notNull(),
  doneDefinition: text('done_definition').notNull(),
  status: taskStatusEnum('status').notNull().default('pending'),
  assignedTo: text('assigned_to').references(() => users.id),
  dueGuidance: text('due_guidance').notNull(),
  isDeliverable: boolean('is_deliverable').notNull().default(false),
  celebrationTrigger: text('celebration_trigger'),
  sortOrder: integer('sort_order').notNull().default(0),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
