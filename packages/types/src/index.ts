// ─── Enums ────────────────────────────────────────────────────────────────────

export type GuestCountMode = 'micro' | 'intimate' | 'classic' | 'grand'
export type PlanningStyle = 'full_diy' | 'mixed' | 'vendor_led' | 'full_service'
export type TimelineMode = 'fast' | 'medium' | 'comfortable' | 'relaxed'
export type TaskStatus = 'pending' | 'in_progress' | 'complete' | 'skipped'
export type GuestSide = 'partner_a' | 'partner_b' | 'mutual'
export type GuestPriority = 'must_invite' | 'nice_to_have'
export type RSVPStatus = 'pending' | 'yes' | 'no'
export type BudgetCategory =
  | 'venue'
  | 'catering'
  | 'photography'
  | 'music'
  | 'florals'
  | 'attire'
  | 'stationery'
  | 'other'
export type Mood = 'great' | 'okay' | 'overwhelmed' | 'stressed' | 'lost'
export type CelebrationTrigger =
  | 'venue_booked'
  | 'photographer_booked'
  | 'save_dates_sent'
  | 'stage_1_complete'
  | 'stage_2_complete'
  | 'stage_3_complete'
  | 'stage_4_complete'
  | 'stage_5_complete'
  | 'stage_6_complete'
  | 'stage_7_complete'
  | 'task_batch_3'

// ─── Core Models ──────────────────────────────────────────────────────────────

export interface User {
  id: string
  clerkId: string
  displayName: string | null
  email: string
  pushToken: string | null
  createdAt: string
}

export interface Wedding {
  id: string
  partnerAId: string
  partnerBId: string | null
  weddingDate: string | null
  guestCountMode: GuestCountMode
  planningStyle: PlanningStyle
  timelineMode: TimelineMode
  vibeTags: string[]
  priorityTags: string[]
  currentStage: number
  locationMode: 'urban' | 'suburban' | 'rural'
  createdAt: string
}

export interface Task {
  id: string
  weddingId: string
  stage: number
  title: string
  whyItMatters: string
  howToDoIt: string
  doneDefinition: string
  status: TaskStatus
  assignedTo: string | null
  dueGuidance: string
  isDeliverable: boolean
  completedAt: string | null
  celebrationTrigger: CelebrationTrigger | null
}

export interface Guest {
  id: string
  weddingId: string
  name: string
  email: string | null
  address: string | null
  side: GuestSide
  priority: GuestPriority
  rsvpStatus: RSVPStatus
  dietaryNotes: string | null
  plusOne: boolean
  createdAt: string
}

export interface BudgetItem {
  id: string
  weddingId: string
  category: BudgetCategory
  label: string
  estimatedCents: number
  actualCents: number
  isDiy: boolean
  vendorName: string | null
  paidAt: string | null
  createdAt: string
}

export interface StressCheckIn {
  id: string
  weddingId: string
  userId: string
  mood: Mood
  contextTag: string
  createdAt: string
}

export interface Celebration {
  id: string
  weddingId: string
  triggerKey: CelebrationTrigger
  shownAt: string | null
  createdAt: string
}

// ─── API Response Types ────────────────────────────────────────────────────────

export interface StageProgress {
  stage: number
  title: string
  completedDeliverables: number
  totalDeliverables: number
  isUnlocked: boolean
  isComplete: boolean
}

export interface BudgetSummary {
  totalEstimatedCents: number
  totalActualCents: number
  byCategory: Record<BudgetCategory, { estimatedCents: number; actualCents: number }>
  estimateRanges: BudgetEstimateRange[]
}

export interface BudgetEstimateRange {
  category: BudgetCategory
  label: string
  lowCents: number
  highCents: number
}

export interface DashboardData {
  wedding: Wedding
  partnerA: User
  partnerB: User | null
  nextTasks: Task[]
  stageProgress: StageProgress[]
  daysUntilWedding: number | null
  budgetSnapshot: { totalEstimatedCents: number; totalActualCents: number } | null
  pendingCelebration: Celebration | null
  stressCheckInDue: boolean
}

export interface StressResponse {
  mood: Mood
  contextTag: string
  validation: string
  honestTip: string
  actionTiles: string[]
}

export interface OnboardingPayload {
  vibeTags: string[]
  priorityTags: string[]
  guestCountMode: GuestCountMode
  planningStyle: PlanningStyle
  timelineMode: TimelineMode
  weddingDate?: string
  locationMode: 'urban' | 'suburban' | 'rural'
  partnerName?: string
}

export interface InvitePartnerPayload {
  email: string
  partnerName: string
}

export interface GuestStats {
  total: number
  confirmed: number
  declined: number
  pending: number
  plusOnes: number
}

// ─── Stage Content ─────────────────────────────────────────────────────────────

export interface StageDecision {
  question: string
  options: Array<{
    label: string
    description: string
    pros: string[]
    cons: string[]
  }>
}

export interface StageContent {
  stage: number
  title: string
  subtitle: string
  timeframe: string
  keyDecision: StageDecision
}
