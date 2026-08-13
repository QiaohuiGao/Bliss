import { pgTable, text, timestamp, integer, boolean, pgEnum, date } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { weddings } from './weddings'

export const moduleStatusEnum = pgEnum('module_status', ['locked', 'active', 'completed'])

export const modules = pgTable('modules', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  templateKey: text('template_key'),

  /**
   * Source of truth for display. `title` / `subtitle` below are rendered
   * fallbacks and search fields only. NULL means the row is user-authored and
   * must never be translated. See docs/I18N.md.
   */
  i18nKey: text('i18n_key'),

  title: text('title').notNull(),
  subtitle: text('subtitle'),
  description: text('description'),

  sortOrder: integer('sort_order').notNull(),
  status: moduleStatusEnum('status').notNull().default('locked'),
  isOptional: boolean('is_optional').default(false),
  isCustom: boolean('is_custom').default(false),

  /** Set when this module came from a cultural pack rather than the base tree. */
  culture: text('culture'),

  estimatedDays: integer('estimated_days'),
  suggestedDeadline: date('suggested_deadline'),
  userDeadline: date('user_deadline'),
  actualStartedAt: timestamp('actual_started_at'),
  completedAt: timestamp('completed_at'),
  prerequisites: text('prerequisites').array().default(sql`'{}'`),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const subModules = pgTable('sub_modules', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  moduleId: text('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
  i18nKey: text('i18n_key'),
  title: text('title').notNull(),
  sortOrder: integer('sort_order').notNull(),
  isOptional: boolean('is_optional').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
