import { pgTable, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core'
import { weddings } from './weddings'
import { modules } from './modules'

export const moduleCelebrations = pgTable('module_celebrations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  moduleId: text('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  daysTaken: integer('days_taken'),
  tasksCompleted: integer('tasks_completed'),
  photosUploaded: integer('photos_uploaded'),

  /**
   * Message key plus params, resolved against the shared catalog in the
   * reader's locale. Never store pre-rendered copy here: two partners may read
   * the same celebration in different languages.
   */
  encouragementKey: text('encouragement_key'),
  encouragementParams: jsonb('encouragement_params'),

  shownAt: timestamp('shown_at'),
  completedAt: timestamp('completed_at').defaultNow().notNull(),
})

export const milestones = pgTable('milestones', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  triggerKey: text('trigger_key').notNull(),
  i18nKey: text('i18n_key'),
  params: jsonb('params'),
  shownAt: timestamp('shown_at'),
  triggeredAt: timestamp('triggered_at').defaultNow().notNull(),
})
