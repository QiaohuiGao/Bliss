import { pgTable, text, timestamp, integer, boolean, pgEnum } from 'drizzle-orm/pg-core'
import { weddings } from './weddings'

export const budgetCategoryEnum = pgEnum('budget_category', [
  'venue', 'catering', 'photography', 'music', 'florals', 'attire', 'stationery', 'other'
])

export const budgetItems = pgTable('budget_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  category: budgetCategoryEnum('category').notNull(),
  label: text('label').notNull(),
  estimatedCents: integer('estimated_cents').notNull().default(0),
  actualCents: integer('actual_cents').notNull().default(0),
  isDiy: boolean('is_diy').notNull().default(false),
  vendorName: text('vendor_name'),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
