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
  title: string
  description: string | null
  sortOrder: number
  status: TaskStatus
  isOptional: boolean
  assigneeId: string | null
  dueDate: string | null
  /** Booking lead time in days, surfaced as "book 9-12 months out" guidance. */
  leadTimeDays: number | null
  rating: number | null
  notes: string | null
  costCents: number | null
  costCategory: BudgetCategory | null
  completedAt: string | null
  createdAt: string
}

/** Planner-standard allocation categories. See docs/US-MARKET-PLAN.md §1.2. */
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

/**
 * Informational only — never presented as legal advice. Sourced from a lookup
 * table, never from a model. A miscalculated waiting period can make a wedding
 * legally impossible on the planned date.
 */
export interface MarriageLicenseRule {
  state: string
  waitingPeriodHours: number
  validityDays: number
  bothPartiesMustAppear: boolean
  witnessesRequired: number
  onlineOrdinationAccepted: 'yes' | 'no' | 'varies_by_county'
  documentsRequired: string[]
  /** i18n keys for state-specific caveats. */
  noteKeys: string[]
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
}

export interface OnboardingPayload {
  weddingDate?: string
  state?: string
  city?: string
  weddingType?: WeddingType
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

// ─── Localized API envelope ───────────────────────────────────────────────────

/**
 * The API returns keys plus params wherever the client can render, and
 * pre-rendered text only for push notifications and email.
 */
export interface LocalizedMessage {
  key: string
  params?: Record<string, string | number>
}
