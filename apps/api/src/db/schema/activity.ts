import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { weddings } from './weddings'
import { users } from './users'

export const activityFeed = pgTable('activity_feed', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id),
  action: text('action').notNull(),
  targetType: text('target_type'),
  targetId: text('target_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
