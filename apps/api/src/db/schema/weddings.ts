import { pgTable, text, timestamp, integer, boolean, pgEnum, date, char, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { users } from './users'

/** Tiers sized for the US market (2026 national average is 117 guests). */
export const guestCountRangeEnum = pgEnum('guest_count_range', [
  'under_50', '50_100', '100_150', '150_250', 'over_250',
])

/** USD bands. Regional cost varies widely, so copy must say so. */
export const budgetTierEnum = pgEnum('budget_tier', [
  'under_20k', '20k_40k', '40k_75k', 'over_75k',
])

export const weddingTypeEnum = pgEnum('wedding_type', [
  'traditional', 'micro', 'elopement', 'destination', 'courthouse',
])

/** A venue coordinator works for the venue, not the couple — different task set. */
export const plannerTypeEnum = pgEnum('planner_type', [
  'full', 'partial', 'day_of', 'venue_only', 'none',
])

export const memberRoleEnum = pgEnum('member_role', ['owner', 'partner'])

export const weddings = pgTable('weddings', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingDate: date('wedding_date'),

  // Location. State is required for marriage-license rules, which are state-level.
  state: char('state', { length: 2 }),
  city: text('city'),

  // Currency is a property of the wedding, not of the reader's display locale.
  currency: text('currency').notNull().default('USD'),

  weddingType: weddingTypeEnum('wedding_type').notNull().default('traditional'),

  /** Human planning capacity. Lead time is modeled separately on tasks. */
  weeklyCapacityHours: integer('weekly_capacity_hours').notNull().default(5),

  /** Heritages selected by the couple. Drives additive cultural quest packs. */
  cultures: text('cultures').array().notNull().default(sql`'{}'`),

  // Exact count is primary; the range is the fallback for couples who don't know yet.
  guestCountExact: integer('guest_count_exact'),
  guestCountRange: guestCountRangeEnum('guest_count_range'),

  styles: text('styles').array().notNull().default(sql`'{}'`),

  budgetTier: budgetTierEnum('budget_tier'),
  budgetTotalCents: integer('budget_total_cents'),
  budgetMinCents: integer('budget_min_cents'),
  budgetMaxCents: integer('budget_max_cents'),

  venuePreferences: text('venue_preferences').array().notNull().default(sql`'{}'`),

  hasPlanner: boolean('has_planner').notNull().default(false),
  plannerType: plannerTypeEnum('planner_type').notNull().default('none'),

  specialNeeds: text('special_needs').array().notNull().default(sql`'{}'`),
  inviteToken: text('invite_token').unique(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const weddingMembers = pgTable('wedding_members', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),
  role: memberRoleEnum('role').notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, table => ({
  // v1 intentionally supports one shared wedding workspace per person.
  userUnique: uniqueIndex('wedding_members_user_unique').on(table.userId),
  weddingUserUnique: uniqueIndex('wedding_members_wedding_user_unique')
    .on(table.weddingId, table.userId),
}))
