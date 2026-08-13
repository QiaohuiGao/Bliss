import { pgTable, text, timestamp, integer, boolean, pgEnum, date } from 'drizzle-orm/pg-core'
import { weddings } from './weddings'
import { subModules } from './modules'
import { users } from './users'

export const taskStatusEnum = pgEnum('task_status_v2', ['todo', 'done', 'skipped'])

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  subModuleId: text('sub_module_id').notNull().references(() => subModules.id, { onDelete: 'cascade' }),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),

  /** NULL means user-authored: rendered verbatim, never translated. */
  i18nKey: text('i18n_key'),

  title: text('title').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  status: taskStatusEnum('status').notNull().default('todo'),
  isOptional: boolean('is_optional').default(false),
  assigneeId: text('assignee_id').references(() => users.id),
  dueDate: date('due_date'),

  /** Booking lead time in days, e.g. gown alterations at 42-56. Drives scheduling. */
  leadTimeDays: integer('lead_time_days'),
  rating: integer('rating'),
  notes: text('notes'),
  costCents: integer('cost_cents'),
  costCategory: text('cost_category'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const taskPhotos = pgTable('task_photos', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  caption: text('caption'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const taskVendors = pgTable('task_vendors', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  vendorName: text('vendor_name'),
  contactInfo: text('contact_info'),
  priceQuoteCents: integer('price_quote_cents'),
  website: text('website'),
  notes: text('notes'),
})
