import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { users } from './users'
import { weddings } from './weddings'
import type {
  ProposedExternalAction,
  ProposedMemoryClaim,
  ProposedMoment,
  ProposedTask,
  ProposedVendor,
} from '../../agent/types'

export const planningThreads = pgTable('planning_threads', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  questKey: text('quest_key').notNull(),
  // Decision threads are permanently scoped to one authored question. Null is
  // reserved for non-decision intake and system threads.
  questionKey: text('question_key'),
  title: text('title').notNull(),
  status: text('status').notNull().default('open').$type<
    'open' | 'exploring' | 'contested' | 'ready' | 'parked'
  >(),
  openedBy: text('opened_by').references(() => users.id),
  // The database column name is retained for migration compatibility. Its
  // presence is independent of the conversation status above.
  currentDecisionId: text('resolved_decision_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, table => ({
  weddingStatusIdx: index('planning_threads_wedding_status_idx')
    .on(table.weddingId, table.status),
  weddingQuestionIdx: uniqueIndex('planning_threads_wedding_question_idx')
    .on(table.weddingId, table.questKey, table.questionKey),
}))

// Agent runs can span multiple model and tool calls, so a transaction lock
// would keep a database transaction open for the whole conversation turn.
// This short-lived lease serializes runs per permanent question thread while
// still recovering automatically if an API process exits mid-run.
export const threadRunLeases = pgTable('thread_run_leases', {
  threadId: text('thread_id').primaryKey().references(() => planningThreads.id, { onDelete: 'cascade' }),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  leaseId: text('lease_id').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, table => ({
  weddingExpiryIdx: index('thread_run_leases_wedding_expiry_idx')
    .on(table.weddingId, table.expiresAt),
}))

export const threadMessages = pgTable('thread_messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  threadId: text('thread_id').notNull().references(() => planningThreads.id, { onDelete: 'cascade' }),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  authorType: text('author_type').notNull().$type<'user' | 'assistant' | 'tool' | 'system'>(),
  authorUserId: text('author_user_id').references(() => users.id),
  content: text('content').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => ({
  threadCreatedIdx: index('thread_messages_thread_created_idx')
    .on(table.threadId, table.createdAt),
}))

export const agentRuns = pgTable('agent_runs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  threadId: text('thread_id').references(() => planningThreads.id, { onDelete: 'set null' }),
  mode: text('mode').notNull().$type<'companion' | 'decision' | 'research' | 'moment'>(),
  goal: text('goal').notNull(),
  artifactBundleId: text('artifact_bundle_id').notNull(),
  modelId: text('model_id').notNull(),
  promptVersion: text('prompt_version').notNull(),
  toolsVersion: text('tools_version').notNull(),
  steps: integer('steps').notNull().default(0),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  costMicros: integer('cost_micros').notNull().default(0),
  latencyMs: integer('latency_ms'),
  stopReason: text('stop_reason'),
  outcome: text('outcome').notNull().default('running').$type<
    'running' | 'proposal_created' | 'completed' | 'parked' | 'failed'
  >(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
}, table => ({
  weddingStartedIdx: index('agent_runs_wedding_started_idx')
    .on(table.weddingId, table.startedAt),
}))

export const agentSpans = pgTable('agent_spans', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  runId: text('run_id').notNull().references(() => agentRuns.id, { onDelete: 'cascade' }),
  parentSpanId: text('parent_span_id'),
  kind: text('kind').notNull(),
  name: text('name').notNull(),
  input: jsonb('input'),
  output: jsonb('output'),
  error: jsonb('error').$type<{ code: string; message: string; retryable: boolean }>(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  costMicros: integer('cost_micros'),
  startedAt: timestamp('started_at').notNull(),
  endedAt: timestamp('ended_at').notNull(),
}, table => ({
  runStartedIdx: index('agent_spans_run_started_idx').on(table.runId, table.startedAt),
}))

export const agentFeedback = pgTable('agent_feedback', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  runId: text('run_id').notNull().references(() => agentRuns.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  dimension: text('dimension').notNull().$type<
    'understood_us' | 'represented_both' | 'reduced_pressure'
  >(),
  rating: integer('rating').notNull().$type<-1 | 1>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, table => ({
  runMemberDimensionUnique: uniqueIndex('agent_feedback_run_member_dimension_unique')
    .on(table.runId, table.userId, table.dimension),
  weddingCreatedIdx: index('agent_feedback_wedding_created_idx')
    .on(table.weddingId, table.createdAt),
}))

export const agentArtifactBundles = pgTable('agent_artifact_bundles', {
  id: text('id').primaryKey(),
  packKey: text('pack_key').notNull(),
  mode: text('mode').notNull(),
  promptVersion: text('prompt_version').notNull(),
  toolsVersion: text('tools_version').notNull(),
  domainPackVersion: text('domain_pack_version').notNull(),
  policyVersion: text('policy_version').notNull(),
  modelPolicyVersion: text('model_policy_version').notNull(),
  evalSuiteVersion: text('eval_suite_version').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => ({
  packCreatedIdx: index('agent_artifact_bundles_pack_created_idx').on(table.packKey, table.createdAt),
}))

export const agentDeployments = pgTable('agent_deployments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  packKey: text('pack_key').notNull(),
  bundleId: text('bundle_id').notNull().references(() => agentArtifactBundles.id, { onDelete: 'restrict' }),
  stage: text('stage').notNull().$type<'stable' | 'canary'>(),
  allocationBasisPoints: integer('allocation_basis_points').notNull(),
  status: text('status').notNull().default('active').$type<'active' | 'completed' | 'rolled_back'>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
}, table => ({
  packStatusCreatedIdx: index('agent_deployments_pack_status_created_idx')
    .on(table.packKey, table.status, table.createdAt),
}))

export const agentReleaseAssignments = pgTable('agent_release_assignments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  packKey: text('pack_key').notNull(),
  deploymentId: text('deployment_id').notNull().references(() => agentDeployments.id, { onDelete: 'restrict' }),
  bundleId: text('bundle_id').notNull().references(() => agentArtifactBundles.id, { onDelete: 'restrict' }),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
}, table => ({
  weddingPackUnique: uniqueIndex('agent_release_assignments_wedding_pack_unique')
    .on(table.weddingId, table.packKey),
  deploymentIdx: index('agent_release_assignments_deployment_idx').on(table.deploymentId),
}))

export const agentReleaseControls = pgTable('agent_release_controls', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  scope: text('scope').notNull().$type<'global' | 'pack' | 'capability'>(),
  key: text('key').notNull(),
  killed: boolean('killed').notNull().default(false),
  reason: text('reason'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, table => ({
  scopeKeyUnique: uniqueIndex('agent_release_controls_scope_key_unique').on(table.scope, table.key),
}))

export const decisionProposals = pgTable('decision_proposals', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  threadId: text('thread_id').notNull().references(() => planningThreads.id, { onDelete: 'cascade' }),
  agentRunId: text('agent_run_id').references(() => agentRuns.id, { onDelete: 'set null' }),
  schemaVersion: integer('schema_version').notNull().default(1),
  version: integer('version').notNull().default(1),
  questKey: text('quest_key').notNull(),
  questionKey: text('question_key').notNull(),
  state: text('state').notNull().$type<'contested' | 'ready'>(),
  summary: text('summary').notNull(),
  proposedChoice: text('proposed_choice'),
  reason: text('reason'),
  alternativesConsidered: jsonb('alternatives_considered')
    .$type<Array<{ value: string; tradeoff: string }>>().notNull(),
  memberInputs: jsonb('member_inputs').$type<Array<{
    memberId: string
    stance: string
    reason: string | null
    sourceMessageIds: string[]
  }>>().notNull(),
  taskEffects: jsonb('task_effects').$type<ProposedTask[]>().notNull(),
  memoryEffects: jsonb('memory_effects').$type<ProposedMemoryClaim[]>().notNull(),
  externalActions: jsonb('external_actions').$type<ProposedExternalAction[]>().notNull(),
  vendorEffects: jsonb('vendor_effects').$type<ProposedVendor[]>().notNull().default([]),
  momentCandidate: jsonb('moment_candidate').$type<ProposedMoment>(),
  status: text('status').notNull().default('pending').$type<
    'pending' | 'confirmed' | 'superseded' | 'rejected' | 'deferred'
  >(),
  confirmedBy: text('confirmed_by').references(() => users.id),
  confirmedAt: timestamp('confirmed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => ({
  threadVersionUnique: uniqueIndex('decision_proposals_thread_version_unique')
    .on(table.threadId, table.version),
  weddingStatusIdx: index('decision_proposals_wedding_status_idx')
    .on(table.weddingId, table.status),
}))

export const decisions = pgTable('decisions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  threadId: text('thread_id').notNull().references(() => planningThreads.id, { onDelete: 'cascade' }),
  questKey: text('quest_key').notNull(),
  questionKey: text('question_key').notNull(),
  choice: text('choice').notNull(),
  reason: text('reason'),
  decidedBy: text('decided_by').notNull().$type<'member' | 'both' | 'assumed'>(),
  confidence: text('confidence').notNull().$type<'high' | 'medium' | 'low'>(),
  wasContested: boolean('was_contested').notNull().default(false),
  proposalId: text('proposal_id').notNull().references(() => decisionProposals.id),
  supersedesId: text('supersedes_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => ({
  proposalUnique: uniqueIndex('decisions_proposal_unique').on(table.proposalId),
  weddingQuestCreatedIdx: index('decisions_wedding_quest_created_idx')
    .on(table.weddingId, table.questKey, table.createdAt),
}))

export const memoryClaims = pgTable('memory_claims', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  decisionId: text('decision_id').references(() => decisions.id, { onDelete: 'set null' }),
  subjectType: text('subject_type').notNull().$type<'wedding' | 'couple' | 'member'>(),
  subjectId: text('subject_id'),
  kind: text('kind').notNull().$type<'fact' | 'preference' | 'priority' | 'constraint' | 'ruled_out'>(),
  key: text('key').notNull(),
  value: jsonb('value').notNull(),
  source: text('source').notNull().$type<'explicit' | 'inferred' | 'decision'>(),
  confidenceBasisPoints: integer('confidence_basis_points').notNull(),
  status: text('status').notNull().default('confirmed').$type<'proposed' | 'confirmed' | 'superseded'>(),
  evidenceMessageIds: text('evidence_message_ids').array().notNull(),
  createdBy: text('created_by').references(() => users.id),
  supersedesId: text('supersedes_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => ({
  weddingKeyIdx: index('memory_claims_wedding_key_idx').on(table.weddingId, table.key),
}))

export const externalActions = pgTable('external_actions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  decisionId: text('decision_id').notNull().references(() => decisions.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  status: text('status').notNull().default('draft').$type<
    'draft' | 'pending_approval' | 'approved' | 'executing' | 'succeeded' | 'failed' | 'cancelled'
  >(),
  approvedBy: text('approved_by').references(() => users.id),
  approvedPayload: jsonb('approved_payload').$type<Record<string, unknown>>(),
  approvedAt: timestamp('approved_at'),
  idempotencyKey: text('idempotency_key'),
  provider: text('provider'),
  attemptCount: integer('attempt_count').notNull().default(0),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
  leaseId: text('lease_id'),
  leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
  lastErrorCode: text('last_error_code'),
  lastErrorAt: timestamp('last_error_at', { withTimezone: true }),
  result: jsonb('result'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  executedAt: timestamp('executed_at'),
}, table => ({
  idempotencyUnique: uniqueIndex('external_actions_idempotency_unique')
    .on(table.idempotencyKey),
  workerDueIdx: index('external_actions_worker_due_idx')
    .on(table.status, table.nextAttemptAt, table.leaseExpiresAt),
}))

export const scheduledTriggers = pgTable('scheduled_triggers', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  externalActionId: text('external_action_id').notNull().references(() => externalActions.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull().$type<'reminder'>(),
  triggerAt: timestamp('trigger_at', { withTimezone: true }).notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  status: text('status').notNull().default('pending').$type<'pending' | 'fired' | 'cancelled' | 'failed'>(),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  firedAt: timestamp('fired_at', { withTimezone: true }),
}, table => ({
  actionUnique: uniqueIndex('scheduled_triggers_action_unique').on(table.externalActionId),
  dueIdx: index('scheduled_triggers_due_idx').on(table.status, table.triggerAt),
}))

export const vendorSearches = pgTable('vendor_searches', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  threadId: text('thread_id').notNull().references(() => planningThreads.id, { onDelete: 'cascade' }),
  agentRunId: text('agent_run_id').references(() => agentRuns.id, { onDelete: 'set null' }),
  provider: text('provider').notNull(),
  query: jsonb('query').$type<Record<string, unknown>>().notNull(),
  status: text('status').notNull().default('running').$type<'running' | 'succeeded' | 'failed'>(),
  resultCount: integer('result_count').notNull().default(0),
  errorCode: text('error_code'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, table => ({
  weddingCreatedIdx: index('vendor_searches_wedding_created_idx').on(table.weddingId, table.createdAt),
}))

export const vendorCandidates = pgTable('vendor_candidates', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  searchId: text('search_id').notNull().references(() => vendorSearches.id, { onDelete: 'cascade' }),
  providerVendorId: text('provider_vendor_id').notNull(),
  category: text('category').notNull(),
  name: text('name').notNull(),
  website: text('website'),
  sourceUrl: text('source_url').notNull(),
  city: text('city'),
  state: text('state'),
  priceLevel: text('price_level'),
  summary: text('summary'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => ({
  searchProviderUnique: uniqueIndex('vendor_candidates_search_provider_unique')
    .on(table.searchId, table.providerVendorId),
  weddingCategoryIdx: index('vendor_candidates_wedding_category_idx')
    .on(table.weddingId, table.category),
}))

export const vendorShortlistItems = pgTable('vendor_shortlist_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  decisionId: text('decision_id').notNull().references(() => decisions.id, { onDelete: 'cascade' }),
  candidateId: text('candidate_id').notNull().references(() => vendorCandidates.id, { onDelete: 'restrict' }),
  rank: integer('rank').notNull(),
  rationale: text('rationale').notNull(),
  pros: text('pros').array().notNull(),
  concerns: text('concerns').array().notNull(),
  status: text('status').notNull().default('considering').$type<'considering' | 'contacted' | 'ruled_out' | 'booked'>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => ({
  decisionCandidateUnique: uniqueIndex('vendor_shortlist_decision_candidate_unique')
    .on(table.decisionId, table.candidateId),
  weddingStatusIdx: index('vendor_shortlist_wedding_status_idx').on(table.weddingId, table.status),
}))

export const moments = pgTable('moments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  decisionId: text('decision_id').notNull().references(() => decisions.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('suggested').$type<'suggested' | 'saved' | 'dismissed'>(),
  title: text('title').notNull(),
  narrative: text('narrative').notNull(),
  sourceMessageIds: text('source_message_ids').array().notNull(),
  createdByAgentRunId: text('created_by_agent_run_id').references(() => agentRuns.id, { onDelete: 'set null' }),
  savedBy: text('saved_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  savedAt: timestamp('saved_at'),
})

export const momentAssets = pgTable('moment_assets', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  momentId: text('moment_id').notNull().references(() => moments.id, { onDelete: 'cascade' }),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull().default('memory').$type<'memory' | 'before' | 'after' | 'reference'>(),
  url: text('url').notNull(),
  caption: text('caption'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => ({
  momentSortIdx: index('moment_assets_moment_sort_idx').on(table.momentId, table.sortOrder),
}))

export const mediaUploadIntents = pgTable('media_upload_intents', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  purpose: text('purpose').notNull().$type<'moment'>(),
  contentType: text('content_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  originalFilename: text('original_filename').notNull(),
  objectKey: text('object_key').notNull(),
  assetUrl: text('asset_url').notNull(),
  status: text('status').notNull().default('pending').$type<'pending' | 'attached' | 'expired'>(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  attachedAt: timestamp('attached_at', { withTimezone: true }),
}, table => ({
  weddingStatusIdx: index('media_upload_intents_wedding_status_idx')
    .on(table.weddingId, table.status, table.expiresAt),
  objectKeyUnique: uniqueIndex('media_upload_intents_object_key_unique').on(table.objectKey),
}))

export const idempotencyRecords = pgTable('idempotency_records', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  weddingId: text('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  operation: text('operation').notNull(),
  key: text('key').notNull(),
  response: jsonb('response'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => ({
  operationKeyUnique: uniqueIndex('idempotency_records_operation_key_unique')
    .on(table.weddingId, table.operation, table.key),
}))
