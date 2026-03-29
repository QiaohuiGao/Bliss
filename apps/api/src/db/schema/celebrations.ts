import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { weddings } from './weddings'

export const celebrations = pgTable('celebrations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  triggerKey: text('trigger_key').notNull(),
  shownAt: timestamp('shown_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
