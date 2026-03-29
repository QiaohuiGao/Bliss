import { pgTable, text, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { users } from './users'

export const guestCountModeEnum = pgEnum('guest_count_mode', ['micro', 'intimate', 'classic', 'grand'])
export const planningStyleEnum = pgEnum('planning_style', ['full_diy', 'mixed', 'vendor_led', 'full_service'])
export const timelineModeEnum = pgEnum('timeline_mode', ['fast', 'medium', 'comfortable', 'relaxed'])
export const locationModeEnum = pgEnum('location_mode', ['urban', 'suburban', 'rural'])

export const weddings = pgTable('weddings', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  partnerAId: text('partner_a_id').notNull().references(() => users.id),
  partnerBId: text('partner_b_id').references(() => users.id),
  weddingDate: timestamp('wedding_date'),
  guestCountMode: guestCountModeEnum('guest_count_mode').notNull().default('intimate'),
  planningStyle: planningStyleEnum('planning_style').notNull().default('mixed'),
  timelineMode: timelineModeEnum('timeline_mode').notNull().default('comfortable'),
  locationMode: locationModeEnum('location_mode').notNull().default('suburban'),
  vibeTags: text('vibe_tags').array().notNull().default(sql`'{}'`),
  priorityTags: text('priority_tags').array().notNull().default(sql`'{}'`),
  currentStage: integer('current_stage').notNull().default(1),
  partnerAName: text('partner_a_name'),
  partnerBName: text('partner_b_name'),
  inviteToken: text('invite_token'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
