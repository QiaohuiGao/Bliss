import { pgTable, text, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core'
import { weddings } from './weddings'

export const guestSideEnum = pgEnum('guest_side', ['partner_a', 'partner_b', 'mutual'])
export const guestPriorityEnum = pgEnum('guest_priority', ['must_invite', 'nice_to_have'])
export const rsvpStatusEnum = pgEnum('rsvp_status', ['pending', 'yes', 'no'])

export const guests = pgTable('guests', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  address: text('address'),
  side: guestSideEnum('side').notNull().default('mutual'),
  priority: guestPriorityEnum('priority').notNull().default('must_invite'),
  rsvpStatus: rsvpStatusEnum('rsvp_status').notNull().default('pending'),
  dietaryNotes: text('dietary_notes'),
  plusOne: boolean('plus_one').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
