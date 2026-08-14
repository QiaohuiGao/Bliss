import { index, pgTable, text, timestamp, integer, boolean, pgEnum, date, uniqueIndex } from 'drizzle-orm/pg-core'
import { weddings } from './weddings'
import { subModules } from './modules'
import { users } from './users'
import { decisions } from './agent'

export const taskStatusEnum = pgEnum('task_status_v2', ['todo', 'done', 'skipped'])

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  subModuleId: text('sub_module_id').notNull().references(() => subModules.id, { onDelete: 'cascade' }),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),

  /** NULL means user-authored: rendered verbatim, never translated. */
  i18nKey: text('i18n_key'),
  templateKey: text('template_key'),

  title: text('title').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  status: taskStatusEnum('status').notNull().default('todo'),
  source: text('source').notNull().default('template').$type<'template' | 'ai' | 'user'>(),
  confidence: text('confidence').$type<'decided' | 'assumed'>(),
  rationale: text('rationale'),
  decisionId: text('decision_id').references(() => decisions.id, { onDelete: 'set null' }),
  isOptional: boolean('is_optional').default(false),
  assigneeId: text('assignee_id').references(() => users.id),
  dueDate: date('due_date'),

  /** Booking lead time in days, e.g. gown alterations at 42-56. Drives scheduling. */
  leadTimeDays: integer('lead_time_days'),
  /** Couple effort. Never conflated with outside-world lead time. */
  effortMinutes: integer('effort_minutes').notNull().default(60),
  computedLatestStart: date('computed_latest_start'),
  plannedWeekStart: date('planned_week_start'),
  slackDays: integer('slack_days'),
  onCriticalPath: boolean('on_critical_path').notNull().default(false),
  rating: integer('rating'),
  notes: text('notes'),
  costCents: integer('cost_cents'),
  costCategory: text('cost_category'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => ({
  decisionTemplateUnique: uniqueIndex('tasks_decision_template_unique')
    .on(table.decisionId, table.templateKey),
}))

export const taskDependencies = pgTable('task_dependencies', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  dependsOnTaskId: text('depends_on_task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
}, table => ({
  edgeUnique: uniqueIndex('task_dependencies_edge_unique').on(table.taskId, table.dependsOnTaskId),
  prerequisiteIdx: index('task_dependencies_prerequisite_idx').on(table.dependsOnTaskId),
}))

export const scheduleIssues = pgTable('schedule_issues', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  type: text('type').notNull().$type<'negative_slack' | 'weekly_overload'>(),
  severity: text('severity').notNull().$type<'warning' | 'blocking'>(),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  decisionId: text('decision_id').references(() => decisions.id, { onDelete: 'set null' }),
  questKey: text('quest_key'),
  weekStart: date('week_start'),
  slackDays: integer('slack_days'),
  overloadMinutes: integer('overload_minutes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => ({
  weddingSeverityIdx: index('schedule_issues_wedding_severity_idx')
    .on(table.weddingId, table.severity),
}))

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
