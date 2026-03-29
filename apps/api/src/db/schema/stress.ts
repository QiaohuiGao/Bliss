import { pgTable, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { weddings } from './weddings'
import { users } from './users'

export const moodEnum = pgEnum('mood', ['great', 'okay', 'overwhelmed', 'stressed', 'lost'])

export const stressCheckIns = pgTable('stress_check_ins', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),
  mood: moodEnum('mood').notNull(),
  contextTag: text('context_tag').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
