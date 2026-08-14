// ─── Locale ───────────────────────────────────────────────────────────────────
// Only `en` ships today. The union is the single place a new locale is declared;
// adding one must not require touching any other file. See docs/I18N.md.

export const SUPPORTED_LOCALES = ['en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'

/** Locales that are planned but not yet shipped. Kept separate so `Locale` stays honest. */
export type PlannedLocale = 'es' | 'zh'

// ─── Enums ────────────────────────────────────────────────────────────────────

/** Tiers sized for the US market (2026 national average is 117 guests). */
export type GuestCountRange =
  | 'under_50'
  | '50_100'
  | '100_150'
  | '150_250'
  | 'over_250'

/** USD budget bands. Regional cost varies widely (NYC/CA/NJ high, Midwest/South lower). */
export type BudgetTier = 'under_20k' | '20k_40k' | '40k_75k' | 'over_75k'

export type WeddingType =
  | 'traditional'
  | 'micro' // 50 guests or fewer
  | 'elopement'
  | 'destination'
  | 'courthouse'

/**
 * Cultural heritages that unlock additive quest packs. A couple may select
 * several. Culture is independent of locale: a Chinese-American couple may want
 * an English UI with the Chinese tradition pack. See docs/CULTURAL-TRADITIONS.md.
 */
export type Culture =
  | 'south_asian'
  | 'chinese'
  | 'jewish'
  | 'korean'
  | 'nigerian'
  | 'mexican'
  | 'persian'
  | 'filipino'
  | 'vietnamese'
  | 'ethiopian'
  | 'greek'
  | 'italian'
  | 'polish'
  | 'hmong'
  | 'armenian'
  | 'arab'

/**
 * A venue coordinator works for the venue, not for the couple — the distinction
 * changes which tasks the couple still owns.
 */
export type PlannerType = 'full' | 'partial' | 'day_of' | 'venue_only' | 'none'

/** Stable slugs. Only the labels are translated; these values reach the database. */
export type WeddingStyle =
  | 'classic'
  | 'modern'
  | 'rustic'
  | 'garden'
  | 'beach_coastal'
  | 'boho'
  | 'black_tie'
  | 'destination'
  | 'backyard'
  | 'minimalist'
  | 'vintage'

export type VenuePreference =
  | 'hotel_ballroom'
  | 'barn_farm'
  | 'vineyard'
  | 'estate_mansion'
  | 'garden_park'
  | 'beach'
  | 'church_temple'
  | 'restaurant'
  | 'museum_gallery'
  | 'backyard'
  | 'all_inclusive_resort'
  | 'courthouse'

export type MemberRole = 'owner' | 'partner'
export type ModuleStatus = 'locked' | 'active' | 'completed'
export type TaskStatus = 'todo' | 'done' | 'skipped'

/** ISO 4217. The US market ships USD; currency is a wedding property, not a locale one. */
export type Currency = 'USD'

// ─── Core Models ──────────────────────────────────────────────────────────────

export interface User {
  id: string
  clerkId: string
  displayName: string | null
  email: string
  avatarUrl: string | null
  /** Display language. Independent of the wedding's currency. */
  locale: Locale
  timeZone: string | null
  createdAt: string
}

export interface Wedding {
  id: string
  weddingDate: string | null
  /** Two-letter USPS code. Drives marriage-license rules, which are state-level. */
  state: string | null
  city: string | null
  currency: Currency
  weddingType: WeddingType
  weeklyCapacityHours: number
  cultures: Culture[]
  /** Exact count is primary; the range is a fallback for couples who don't know yet. */
  guestCountExact: number | null
  guestCountRange: GuestCountRange | null
  styles: WeddingStyle[]
  budgetTier: BudgetTier | null
  budgetTotalCents: number | null
  budgetMinCents: number | null
  budgetMaxCents: number | null
  venuePreferences: VenuePreference[]
  hasPlanner: boolean
  plannerType: PlannerType
  specialNeeds: string[]
  inviteToken: string | null
  createdAt: string
}

export interface WeddingMember {
  id: string
  weddingId: string
  userId: string
  role: MemberRole
  joinedAt: string
}

export interface WeddingMemberSummary extends WeddingMember {
  displayName: string | null
  avatarUrl: string | null
  isCurrentUser: boolean
}

export interface Module {
  id: string
  weddingId: string
  templateKey: string | null
  /**
   * Source of truth for display. `title` below is a rendered fallback and a
   * search field only. NULL means the row is user-authored and never translated.
   */
  i18nKey: string | null
  title: string
  subtitle: string | null
  description: string | null
  sortOrder: number
  status: ModuleStatus
  isOptional: boolean
  isCustom: boolean
  /** Non-null when the module came from a cultural pack rather than the base tree. */
  culture: Culture | null
  estimatedDays: number | null
  suggestedDeadline: string | null
  userDeadline: string | null
  actualStartedAt: string | null
  completedAt: string | null
  prerequisites: string[]
  createdAt: string
}

export interface SubModule {
  id: string
  moduleId: string
  i18nKey: string | null
  title: string
  sortOrder: number
  isOptional: boolean
  createdAt: string
}

export interface Task {
  id: string
  subModuleId: string
  weddingId: string
  i18nKey: string | null
  templateKey: string | null
  title: string
  description: string | null
  sortOrder: number
  status: TaskStatus
  source: 'template' | 'ai' | 'user'
  confidence: 'decided' | 'assumed' | null
  rationale: string | null
  decisionId: string | null
  isOptional: boolean
  assigneeId: string | null
  dueDate: string | null
  /** Booking lead time in days, surfaced as "book 9-12 months out" guidance. */
  leadTimeDays: number | null
  effortMinutes: number
  computedLatestStart: string | null
  plannedWeekStart: string | null
  slackDays: number | null
  onCriticalPath: boolean
  rating: number | null
  notes: string | null
  costCents: number | null
  costCategory: BudgetCategory | null
  completedAt: string | null
  createdAt: string
}

/** Planner-standard allocation categories. See docs/MARKET.md §2. */
export type BudgetCategory =
  | 'venue_catering'
  | 'photo_video'
  | 'flowers_decor'
  | 'attire_beauty'
  | 'music_entertainment'
  | 'rings'
  | 'stationery'
  | 'transportation'
  | 'favors_gifts'
  | 'buffer_tips'

export interface TaskPhoto {
  id: string
  taskId: string
  url: string
  caption: string | null
  createdAt: string
}

export interface TaskVendor {
  id: string
  taskId: string
  vendorName: string | null
  contactInfo: string | null
  priceQuoteCents: number | null
  website: string | null
  notes: string | null
}

export interface ModuleCelebration {
  id: string
  moduleId: string
  weddingId: string
  daysTaken: number | null
  tasksCompleted: number | null
  photosUploaded: number | null
  /** Message key plus params; the client renders it in the reader's locale. */
  encouragementKey: string | null
  shownAt: string | null
  completedAt: string
}

export interface Milestone {
  id: string
  weddingId: string
  triggerKey: string
  i18nKey: string | null
  shownAt: string | null
  triggeredAt: string
}

// ─── Marriage license (US-specific, state-level) ──────────────────────────────

export type MarriageLicenseFieldKey =
  | 'waiting_period'
  | 'validity_window'
  | 'appearance'
  | 'witnesses'
  | 'officiant'
  | 'documents'

export interface MarriageLicenseAuthoritySource {
  publisher: string
  title: string
  url: string
  retrievedAt: string
  fieldKeys: MarriageLicenseFieldKey[]
}

/**
 * Informational only — never presented as legal advice. Every populated rule is
 * fresh, jurisdiction-matched, and field-covered by official authority sources.
 * The API returns unavailable rather than filling a missing field from defaults
 * or model knowledge.
 */
export interface MarriageLicenseRule {
  state: string
  county: string | null
  waitingPeriodHours: number
  validityDays: number
  bothPartiesMustAppear: boolean
  witnessesRequired: number
  onlineOrdinationAccepted: 'yes' | 'no' | 'varies_by_county' | 'not_verified'
  documentsRequired: string[]
  notes: string[]
  sources: MarriageLicenseAuthoritySource[]
  verifiedAt: string
  expiresAt: string
}

export type MarriageLicenseLookupResponse =
  | {
      status: 'verified'
      provider: string
      rule: MarriageLicenseRule
      window: {
        earliest: string
        latest: string
        waitingPeriodHours: number
      } | null
      untrustedExternalContent: true
      disclaimerKey: string
    }
  | {
      status: 'verification_required'
      code: 'LEGAL_AUTHORITY_NOT_COVERED'
      state: string
      county: string | null
      rule: null
      window: null
      disclaimerKey: string
    }

// ─── API Response Types ────────────────────────────────────────────────────────

export interface ModuleProgress {
  total: number
  completed: number
  percentage: number
}

export interface ModuleWithProgress extends Module {
  progress: ModuleProgress
  subModuleCount: number
}

export interface ModulesResponse {
  totalProgress: number
  daysRemaining: number | null
  modules: ModuleWithProgress[]
}

export interface TaskWithMeta extends Task {
  photoCount: number
}

export interface SubModuleWithTasks extends SubModule {
  tasks: TaskWithMeta[]
}

export interface ModuleDetailResponse extends Module {
  progress: ModuleProgress
  celebration: ModuleCelebration | null
  subModules: SubModuleWithTasks[]
}

export interface DashboardResponse {
  wedding: Wedding & {
    daysRemaining: number | null
    totalProgress: number
  }
  todayTasks: Task[]
  activeModules: Module[]
  budget: {
    totalBudgetCents: number
    spentCents: number
  }
  reminders: Array<{
    id: string
    weddingId: string
    action: string
    targetType: string | null
    targetId: string | null
    metadata: Record<string, unknown> | null
    createdAt: string
  }>
  schedule: {
    blockingCount: number
    warningCount: number
    issues: ScheduleIssue[]
  }
  couple: {
    members: WeddingMemberSummary[]
    canInvitePartner: boolean
  }
}

export interface ScheduleIssue {
  id: string
  weddingId: string
  type: 'negative_slack' | 'weekly_overload'
  severity: 'warning' | 'blocking'
  taskId: string | null
  decisionId: string | null
  questKey: string | null
  weekStart: string | null
  slackDays: number | null
  overloadMinutes: number | null
  createdAt: string
  taskTitle?: string | null
}

export interface OnboardingPayload {
  weddingDate?: string
  state?: string
  city?: string
  weddingType?: WeddingType
  weeklyCapacityHours?: number
  cultures?: Culture[]
  guestCountRange?: GuestCountRange
  guestCountExact?: number
  styles?: WeddingStyle[]
  budgetTier?: BudgetTier
  budgetTotalCents?: number
  budgetMinCents?: number
  budgetMaxCents?: number
  venuePreferences?: VenuePreference[]
  hasPlanner?: boolean
  plannerType?: PlannerType
  specialNeeds?: string[]
}

// ─── Agent planning ───────────────────────────────────────────────────────────

export type PlanningThreadStatus =
  | 'open'
  | 'exploring'
  | 'contested'
  | 'ready'
  | 'resolved'
  | 'parked'

export interface PlanningThread {
  id: string
  weddingId: string
  questKey: string
  title: string
  status: PlanningThreadStatus
  openedBy: string | null
  resolvedDecisionId: string | null
  createdAt: string
  updatedAt: string
}

export interface QuestScopingOverview {
  questKey: string
  titleI18nKey: string
  subtitleI18nKey: string
  questions: Array<{
    questionKey: string
    promptI18nKey: string
    helpI18nKey: string
    options: Array<{ value: string; labelI18nKey: string }>
    currentChoice: string
    source: 'confirmed' | 'assumed'
    allowsDefer: boolean
  }>
}

export interface ThreadMessage {
  id: string
  threadId: string
  weddingId: string
  authorType: 'user' | 'assistant' | 'tool' | 'system'
  authorUserId: string | null
  content: string
  metadata: Record<string, unknown> | null
  createdAt: string
  isCurrentUser: boolean
}

export interface DecisionMemberInput {
  memberId: string
  stance: string
  reason: string | null
  sourceMessageIds: string[]
}

export interface ProposedTaskEffect {
  taskKey: string
  rationale: string
}

export interface ProposedMemoryEffect {
  subjectType: 'wedding' | 'couple' | 'member'
  subjectId: string | null
  kind: 'fact' | 'preference' | 'priority' | 'constraint' | 'ruled_out'
  key: string
  value: unknown
  source: 'explicit' | 'inferred' | 'decision'
  confidenceBasisPoints: number
  evidenceMessageIds: string[]
}

export interface ProposedExternalAction {
  kind: 'draft_email' | 'send_email' | 'calendar_event' | 'reminder' | 'vendor_shortlist'
  payload: Record<string, unknown>
  requiresApproval: true
}

export interface DecisionProposal {
  id: string
  weddingId: string
  threadId: string
  agentRunId: string | null
  schemaVersion: number
  version: number
  questKey: string
  questionKey: string
  state: 'contested' | 'ready'
  summary: string
  proposedChoice: string | null
  reason: string | null
  alternativesConsidered: Array<{ value: string; tradeoff: string }>
  memberInputs: DecisionMemberInput[]
  taskEffects: ProposedTaskEffect[]
  memoryEffects: ProposedMemoryEffect[]
  externalActions: ProposedExternalAction[]
  vendorEffects: Array<{
    candidateId: string
    rationale: string
    pros: string[]
    concerns: string[]
    candidate?: VendorCandidate | null
  }>
  momentCandidate: {
    title: string
    narrative: string
    sourceMessageIds: string[]
  } | null
  status: 'pending' | 'confirmed' | 'superseded' | 'rejected' | 'deferred'
  confirmedBy: string | null
  confirmedAt: string | null
  createdAt: string
}

export interface VendorCandidate {
  id: string
  weddingId: string
  searchId: string
  providerVendorId: string
  category: string
  name: string
  website: string | null
  sourceUrl: string
  city: string | null
  state: string | null
  priceLevel: string | null
  summary: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export interface AgentFeedback {
  id: string
  weddingId: string
  runId: string
  userId: string
  dimension: 'understood_us' | 'represented_both' | 'reduced_pressure'
  rating: -1 | 1
  createdAt: string
  updatedAt: string
}

export interface AttireAgentRunResult {
  runId: string
  stopReason: string
  message: string | null
  proposal: { proposalId: string; version: number; status: 'pending' } | null
  usage: {
    steps: number
    inputTokens: number
    outputTokens: number
    costMicros: number
  }
}

export interface ConfirmDecisionResult {
  proposalId: string
  decisionId: string
  taskIds: string[]
  memoryClaimIds: string[]
  externalActionIds: string[]
  momentId: string | null
  vendorShortlistItemIds: string[]
  replayed: boolean
}

export interface MemoryProfileClaim {
  id: string
  subjectType: 'wedding' | 'couple' | 'member'
  subjectId: string | null
  kind: 'fact' | 'preference' | 'priority' | 'constraint' | 'ruled_out'
  key: string
  value: unknown
  source: 'explicit' | 'inferred' | 'decision'
  confidenceBasisPoints: number
  createdAt: string
}

export interface MemoryProfile {
  wedding: MemoryProfileClaim[]
  couple: MemoryProfileClaim[]
  members: Record<string, MemoryProfileClaim[]>
  memberNames: Record<string, string | null>
}

export interface MomentAsset {
  id: string
  momentId: string
  weddingId: string
  kind: 'memory' | 'before' | 'after' | 'reference'
  url: string
  caption: string | null
  sortOrder: number
  createdAt: string
}

export interface MediaUploadIntent {
  id: string
  provider: string
  purpose: 'moment'
  contentType: 'image/jpeg' | 'image/png' | 'image/webp'
  sizeBytes: number
  uploadUrl: string
  uploadHeaders: Record<string, string>
  expiresAt: string
}

export interface BlissMoment {
  id: string
  weddingId: string
  decisionId: string
  status: 'suggested' | 'saved' | 'dismissed'
  title: string
  narrative: string
  sourceMessageIds: string[]
  createdByAgentRunId: string | null
  savedBy: string | null
  createdAt: string
  savedAt: string | null
  assets: MomentAsset[]
}

export type ExternalActionKind = 'draft_email' | 'send_email' | 'calendar_event' | 'reminder' | 'vendor_shortlist'
export type ExternalActionStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'executing'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export interface ExternalAction {
  id: string
  weddingId: string
  decisionId: string
  kind: ExternalActionKind
  payload: Record<string, unknown>
  status: ExternalActionStatus
  approvedBy: string | null
  approvedPayload: Record<string, unknown> | null
  approvedAt: string | null
  idempotencyKey: string | null
  provider: string | null
  attemptCount: number
  nextAttemptAt: string | null
  leaseExpiresAt: string | null
  lastErrorCode: string | null
  lastErrorAt: string | null
  result: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  executedAt: string | null
}

export interface ApprovedActionResult {
  actionId: string
  kind: ExternalActionKind
  status: 'approved' | 'succeeded'
  result: Record<string, unknown>
  replayed: boolean
}

// ─── Localized API envelope ───────────────────────────────────────────────────

/**
 * The API returns keys plus params wherever the client can render, and
 * pre-rendered text only for push notifications and email.
 */
export interface LocalizedMessage {
  key: string
  params?: Record<string, string | number>
}
