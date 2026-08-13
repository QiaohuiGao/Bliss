import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  clerkId: text('clerk_id').notNull().unique(),
  displayName: text('display_name'),
  email: text('email').notNull(),
  avatarUrl: text('avatar_url'),

  /** Display language for notifications and email. Independent of wedding currency. */
  locale: text('locale').notNull().default('en'),
  timeZone: text('time_zone'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
