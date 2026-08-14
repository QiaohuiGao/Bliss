import type { BudgetCategory, Culture, WeddingType } from '@bliss/types'
import type { PredicateSource } from './predicates'

/**
 * Structural quest templates. **No human-readable copy lives here** — every
 * string a couple sees is a key resolved against
 * `packages/i18n/src/content/<locale>/quests.json`. That is what makes a Spanish
 * or Chinese quest tree a translation job rather than a code fork.
 *
 * Key shape:
 *   quest.<questKey>.title | .subtitle | .celebration
 *   quest.<questKey>.section.<sectionKey>
 *   quest.<questKey>.task.<taskKey>.title | .description
 */

export interface TaskTemplate {
  /** Unique within its quest. */
  key: string
  isOptional: boolean
  /** Calendar days the outside world needs, regardless of the couple's effort. */
  leadTimeDays?: number
  /** Active couple effort; deliberately separate from lead time. Defaults to one hour. */
  effortMinutes?: number
  /** Prerequisite task keys within this quest. */
  dependsOn?: string[]
  costCategory?: BudgetCategory
  /** Absent means the task applies to every wedding type. */
  weddingTypes?: WeddingType[]
  /** Task exists only when the couple has no planner of the listed strength. */
  requiresNoPlanner?: boolean
  /**
   * Predicates over scoping answers and wedding facts, ANDed together. Absent
   * means unconditional. Grammar and evaluator in `./predicates.ts`.
   */
  appliesWhen?: PredicateSource[]
}

export interface SectionTemplate {
  key: string
  isOptional: boolean
  tasks: TaskTemplate[]
  /** Drops the whole section, tasks included. */
  appliesWhen?: PredicateSource[]
}

/**
 * A question the couple answers before a quest produces a list. Two or three per
 * quest is the budget — the point is to cut the list, not to conduct an interview.
 *
 * `defaultValue` is what the resolver assumes when the question has not been
 * answered. It is what makes "you decide for me" a first-class path and what
 * guarantees a couple who types nothing still gets a complete, sane plan
 * (PRD.md §11). It should be the US median choice, not the cheapest or the
 * fanciest.
 */
export interface ScopingQuestion {
  /** Unqualified. The resolver prefixes it with the quest's answer namespace. */
  key: string
  options: string[]
  defaultValue: string
  /** Free text is always allowed alongside; this flags the "you decide" path. */
  allowsDefer: boolean
}

export interface QuestTemplate {
  key: string
  order: number
  isOptional: boolean
  /** [shortEngagement, longEngagement] — interpolated against time available. */
  estimatedDaysRange: [number, number]
  prerequisites: string[]
  /** Absent means the quest applies to every wedding type. */
  weddingTypes?: WeddingType[]
  /** Set only on culture-pack quests. */
  culture?: Culture
  /**
   * Answer namespace for this quest's scoping questions, e.g. `attire`. Answer
   * keys are `<answerNamespace>.<question.key>`. Kept separate from `key` so a
   * predicate can read another quest's answer without depending on quest naming.
   */
  answerNamespace?: string
  scopingQuestions?: ScopingQuestion[]
  sections: SectionTemplate[]
}

export const questI18nKey = (questKey: string, suffix: string) =>
  `quest.${questKey}.${suffix}`
export const sectionI18nKey = (questKey: string, sectionKey: string) =>
  `quest.${questKey}.section.${sectionKey}`
export const taskI18nKey = (questKey: string, taskKey: string) =>
  `quest.${questKey}.task.${taskKey}`
export const questionI18nKey = (questKey: string, questionKey: string) =>
  `quest.${questKey}.question.${questionKey}`

const ALL_BUT_ELOPEMENT: WeddingType[] = ['traditional', 'micro', 'destination']
const FULL_SCALE_ONLY: WeddingType[] = ['traditional', 'destination']

export const QUEST_TEMPLATES: QuestTemplate[] = [
  // ── 1 ─────────────────────────────────────────────────────────────────────
  {
    key: 'foundation',
    order: 1,
    isOptional: false,
    estimatedDaysRange: [7, 21],
    prerequisites: [],
    answerNamespace: 'foundation',
    scopingQuestions: [
      {
        key: 'funding_boundaries',
        options: ['couple_funded', 'family_gift', 'family_with_input', 'still_unclear'],
        defaultValue: 'still_unclear',
        allowsDefer: true,
      },
      {
        key: 'tradeoff_anchor',
        options: ['guest_experience', 'atmosphere_design', 'food_celebration', 'meaning_tradition', 'low_stress'],
        defaultValue: 'guest_experience',
        allowsDefer: true,
      },
      {
        key: 'decision_rhythm',
        options: ['domain_owners', 'shared_big_decisions', 'weekly_checkin', 'needs_structure'],
        defaultValue: 'shared_big_decisions',
        allowsDefer: true,
      },
    ],
    sections: [
      {
        key: 'money',
        isOptional: false,
        tasks: [
          { key: 'set_total_budget', isOptional: false },
          { key: 'agree_who_pays', isOptional: false },
          { key: 'allocate_categories', isOptional: false },
          { key: 'reserve_buffer', isOptional: false, costCategory: 'buffer_tips' },
          { key: 'open_wedding_account', isOptional: true },
          {
            key: 'write_couple_funded_guardrails',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['foundation.funding_boundaries == couple_funded'],
          },
          {
            key: 'confirm_family_gift_boundaries',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['foundation.funding_boundaries == family_gift'],
          },
          {
            key: 'write_family_input_boundaries',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['foundation.funding_boundaries == family_with_input'],
          },
          {
            key: 'clarify_family_contributions',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['foundation.funding_boundaries == still_unclear'],
          },
        ],
      },
      {
        key: 'shape',
        isOptional: false,
        tasks: [
          { key: 'draft_guest_count', isOptional: false },
          { key: 'pick_three_priorities', isOptional: false },
          { key: 'agree_non_negotiables', isOptional: false },
          {
            key: 'define_guest_experience_anchor',
            isOptional: false,
            effortMinutes: 45,
            appliesWhen: ['foundation.tradeoff_anchor == guest_experience'],
          },
          {
            key: 'define_atmosphere_anchor',
            isOptional: false,
            effortMinutes: 45,
            appliesWhen: ['foundation.tradeoff_anchor == atmosphere_design'],
          },
          {
            key: 'define_food_party_anchor',
            isOptional: false,
            effortMinutes: 45,
            appliesWhen: ['foundation.tradeoff_anchor == food_celebration'],
          },
          {
            key: 'define_meaning_tradition_anchor',
            isOptional: false,
            effortMinutes: 45,
            appliesWhen: ['foundation.tradeoff_anchor == meaning_tradition'],
          },
          {
            key: 'define_low_stress_anchor',
            isOptional: false,
            effortMinutes: 45,
            appliesWhen: ['foundation.tradeoff_anchor == low_stress'],
          },
        ],
      },
      {
        key: 'support',
        isOptional: false,
        tasks: [
          { key: 'decide_planner_level', isOptional: false },
          { key: 'interview_planners', isOptional: true, leadTimeDays: 21 },
          { key: 'buy_wedding_insurance', isOptional: true, weddingTypes: ALL_BUT_ELOPEMENT },
          {
            key: 'map_domain_owners',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['foundation.decision_rhythm == domain_owners'],
          },
          {
            key: 'define_two_yes_decisions',
            isOptional: false,
            effortMinutes: 45,
            appliesWhen: ['foundation.decision_rhythm == shared_big_decisions'],
          },
          {
            key: 'schedule_weekly_planning_checkin',
            isOptional: false,
            effortMinutes: 30,
            appliesWhen: ['foundation.decision_rhythm == weekly_checkin'],
          },
          {
            key: 'write_decision_protocol',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['foundation.decision_rhythm == needs_structure'],
          },
        ],
      },
    ],
  },

  // ── 2 ─────────────────────────────────────────────────────────────────────
  {
    key: 'venue_date',
    order: 2,
    isOptional: false,
    estimatedDaysRange: [21, 45],
    prerequisites: ['foundation'],
    answerNamespace: 'venue',
    scopingQuestions: [
      {
        key: 'date_flexibility',
        options: ['fixed_date', 'preferred_window', 'venue_first'],
        defaultValue: 'preferred_window',
        allowsDefer: true,
      },
      {
        key: 'venue_style',
        options: ['full_service', 'blank_canvas', 'restaurant_hotel', 'outdoor'],
        defaultValue: 'full_service',
        allowsDefer: true,
      },
      {
        key: 'site_plan',
        options: ['same_site', 'separate_sites', 'undecided'],
        defaultValue: 'same_site',
        allowsDefer: true,
      },
    ],
    sections: [
      {
        key: 'date',
        isOptional: false,
        tasks: [
          { key: 'pick_season_and_range', isOptional: false },
          { key: 'check_family_conflicts', isOptional: false },
          { key: 'consider_offpeak_pricing', isOptional: true },
          { key: 'check_holiday_weekends', isOptional: true },
          {
            key: 'confirm_fixed_date_constraints',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['venue.date_flexibility == fixed_date'],
          },
          {
            key: 'compare_date_options',
            isOptional: false,
            effortMinutes: 120,
            appliesWhen: ['venue.date_flexibility == preferred_window'],
          },
          {
            key: 'rank_venue_before_date',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['venue.date_flexibility == venue_first'],
          },
        ],
      },
      {
        key: 'search',
        isOptional: false,
        tasks: [
          { key: 'write_venue_requirements', isOptional: false },
          { key: 'shortlist_venues', isOptional: false },
          { key: 'check_availability', isOptional: false, leadTimeDays: 14 },
          {
            key: 'audit_full_service_inclusions',
            isOptional: false,
            effortMinutes: 120,
            appliesWhen: ['venue.venue_style == full_service'],
          },
          {
            key: 'build_blank_canvas_cost_model',
            isOptional: false,
            effortMinutes: 180,
            appliesWhen: ['venue.venue_style == blank_canvas'],
          },
          {
            key: 'confirm_restaurant_buyout_terms',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['venue.venue_style == restaurant_hotel'],
          },
          {
            key: 'verify_outdoor_infrastructure',
            isOptional: false,
            effortMinutes: 180,
            appliesWhen: ['venue.venue_style == outdoor'],
          },
        ],
      },
      {
        key: 'tour',
        isOptional: false,
        tasks: [
          { key: 'book_tours', isOptional: false, leadTimeDays: 14 },
          { key: 'tour_with_checklist', isOptional: false },
          { key: 'ask_fb_minimum', isOptional: false },
          { key: 'ask_vendor_restrictions', isOptional: false },
          { key: 'ask_coi_requirements', isOptional: false },
          { key: 'confirm_rain_plan', isOptional: false },
          { key: 'ask_overtime_rate', isOptional: false },
          {
            key: 'confirm_room_flip_and_guest_flow',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['venue.site_plan == same_site'],
          },
          {
            key: 'measure_transfer_time_and_transport',
            isOptional: false,
            effortMinutes: 120,
            appliesWhen: ['venue.site_plan == separate_sites'],
          },
          {
            key: 'compare_one_site_vs_two',
            isOptional: false,
            effortMinutes: 120,
            appliesWhen: ['venue.site_plan == undecided'],
          },
        ],
      },
      {
        key: 'book',
        isOptional: false,
        tasks: [
          { key: 'compare_all_in_cost', isOptional: false },
          { key: 'review_contract', isOptional: false, costCategory: 'venue_catering' },
          { key: 'check_force_majeure', isOptional: false },
          { key: 'pay_retainer', isOptional: false, costCategory: 'venue_catering' },
          { key: 'lock_the_date', isOptional: false },
        ],
      },
    ],
  },

  // ── 3 ─────────────────────────────────────────────────────────────────────
  {
    key: 'vendor_team',
    order: 3,
    isOptional: false,
    estimatedDaysRange: [30, 60],
    prerequisites: ['venue_date'],
    answerNamespace: 'photo',
    scopingQuestions: [
      {
        key: 'coverage',
        options: ['photo_only', 'photo_video', 'photo_video_content'],
        defaultValue: 'photo_only',
        allowsDefer: true,
      },
    ],
    sections: [
      {
        key: 'photo',
        isOptional: false,
        tasks: [
          { key: 'define_photo_style', isOptional: false },
          { key: 'shortlist_photographers', isOptional: false },
          { key: 'review_full_galleries', isOptional: false },
          { key: 'book_photographer', isOptional: false, leadTimeDays: 270, costCategory: 'photo_video' },
          {
            key: 'book_videographer',
            isOptional: false,
            leadTimeDays: 270,
            costCategory: 'photo_video',
            appliesWhen: ['photo.coverage in (photo_video, photo_video_content)'],
          },
          {
            key: 'book_content_creator',
            isOptional: false,
            costCategory: 'photo_video',
            appliesWhen: ['photo.coverage == photo_video_content'],
          },
        ],
      },
      {
        key: 'music',
        isOptional: false,
        tasks: [
          { key: 'decide_dj_or_band', isOptional: false },
          { key: 'audition_music', isOptional: false },
          { key: 'book_music', isOptional: false, leadTimeDays: 240, costCategory: 'music_entertainment' },
        ],
      },
      {
        key: 'officiant',
        isOptional: false,
        tasks: [
          { key: 'choose_officiant', isOptional: false },
          { key: 'verify_officiant_credentials', isOptional: false },
          { key: 'book_officiant', isOptional: false },
        ],
      },
      {
        key: 'coordination',
        isOptional: true,
        tasks: [
          { key: 'book_day_of_coordinator', isOptional: true, requiresNoPlanner: true, leadTimeDays: 120 },
          { key: 'collect_vendor_cois', isOptional: false },
          { key: 'build_vendor_contact_sheet', isOptional: false },
        ],
      },
    ],
  },

  // ── 4 ─────────────────────────────────────────────────────────────────────
  {
    key: 'wedding_party',
    order: 4,
    isOptional: false,
    estimatedDaysRange: [14, 30],
    prerequisites: ['foundation'],
    weddingTypes: ALL_BUT_ELOPEMENT,
    answerNamespace: 'party',
    scopingQuestions: [
      {
        key: 'structure',
        options: ['traditional_sides', 'shared_circle', 'small_vips', 'no_formal_party'],
        defaultValue: 'shared_circle',
        allowsDefer: true,
      },
      {
        key: 'support_level',
        options: ['celebratory_only', 'light_support', 'active_team'],
        defaultValue: 'light_support',
        allowsDefer: true,
      },
      {
        key: 'attire_direction',
        options: ['matching_look', 'palette_guided', 'wear_what_you_own', 'no_group_attire'],
        defaultValue: 'palette_guided',
        allowsDefer: true,
      },
    ],
    sections: [
      {
        key: 'asks',
        isOptional: false,
        tasks: [
          { key: 'decide_party_size', isOptional: false, appliesWhen: ['party.structure != no_formal_party'] },
          { key: 'ask_wedding_party', isOptional: false, appliesWhen: ['party.structure != no_formal_party'] },
          { key: 'choose_honor_attendants', isOptional: false, appliesWhen: ['party.structure in (traditional_sides, shared_circle)'] },
          { key: 'ask_kid_attendants', isOptional: true, appliesWhen: ['party.structure != no_formal_party'] },
          {
            key: 'map_traditional_party_sides',
            isOptional: false,
            effortMinutes: 45,
            appliesWhen: ['party.structure == traditional_sides'],
          },
          {
            key: 'build_one_shared_circle',
            isOptional: false,
            effortMinutes: 45,
            appliesWhen: ['party.structure == shared_circle'],
          },
          {
            key: 'name_small_vip_circle',
            isOptional: false,
            effortMinutes: 30,
            appliesWhen: ['party.structure == small_vips'],
          },
          {
            key: 'define_vip_roles_without_a_party',
            isOptional: false,
            effortMinutes: 30,
            appliesWhen: ['party.structure == no_formal_party'],
          },
        ],
      },
      {
        key: 'roles',
        isOptional: false,
        tasks: [
          { key: 'explain_duties_and_costs', isOptional: false, appliesWhen: ['party.structure != no_formal_party'] },
          { key: 'assign_day_of_jobs', isOptional: false, appliesWhen: ['party.support_level == active_team'] },
          { key: 'name_a_point_person', isOptional: false, appliesWhen: ['party.support_level in (light_support, active_team)'] },
          { key: 'set_up_group_chat', isOptional: false, appliesWhen: ['party.structure != no_formal_party'] },
          {
            key: 'tell_party_presence_is_enough',
            isOptional: false,
            effortMinutes: 30,
            appliesWhen: ['party.support_level == celebratory_only'],
          },
          {
            key: 'agree_light_support_requests',
            isOptional: false,
            effortMinutes: 45,
            appliesWhen: ['party.support_level == light_support'],
          },
          {
            key: 'confirm_active_team_responsibilities',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['party.support_level == active_team'],
          },
        ],
      },
      {
        key: 'party_attire',
        isOptional: false,
        appliesWhen: ['party.structure != no_formal_party'],
        tasks: [
          {
            key: 'set_party_attire_direction',
            isOptional: false,
            costCategory: 'attire_beauty',
            appliesWhen: ['party.attire_direction != no_group_attire'],
          },
          { key: 'collect_party_sizes', isOptional: false, leadTimeDays: 30, appliesWhen: ['party.attire_direction == matching_look'] },
          { key: 'order_party_attire', isOptional: false, leadTimeDays: 90, costCategory: 'attire_beauty', appliesWhen: ['party.attire_direction == matching_look'] },
          {
            key: 'share_palette_and_fit_guardrails',
            isOptional: false,
            effortMinutes: 45,
            appliesWhen: ['party.attire_direction == palette_guided'],
          },
          {
            key: 'review_existing_outfits_for_comfort',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['party.attire_direction == wear_what_you_own'],
          },
          {
            key: 'confirm_no_required_outfit_purchase',
            isOptional: false,
            effortMinutes: 30,
            appliesWhen: ['party.attire_direction == no_group_attire'],
          },
          { key: 'buy_party_gifts', isOptional: true, costCategory: 'favors_gifts' },
        ],
      },
    ],
  },

  // ── 5 ─────────────────────────────────────────────────────────────────────
  {
    key: 'attire_beauty',
    order: 5,
    isOptional: false,
    estimatedDaysRange: [30, 75],
    prerequisites: ['foundation'],
    answerNamespace: 'attire',
    // The quest that makes the granularity argument concrete: renting is four
    // tasks and a two-week lead time, custom is nine tasks and six months.
    scopingQuestions: [
      {
        key: 'dress_acquisition',
        options: ['rent', 'buy_offrack', 'buy_custom'],
        // Off the rack is the US median: most couples buy a sample-line gown and
        // have it altered. Renting is growing but still the minority.
        defaultValue: 'buy_offrack',
        allowsDefer: true,
      },
      {
        key: 'suit_acquisition',
        options: ['rent', 'buy_offrack', 'custom_tailor'],
        defaultValue: 'rent',
        allowsDefer: true,
      },
      {
        key: 'beauty_approach',
        options: ['pro_team', 'pro_for_couple_only', 'diy'],
        defaultValue: 'pro_for_couple_only',
        allowsDefer: true,
      },
      {
        key: 'second_look',
        options: ['yes', 'no'],
        defaultValue: 'no',
        allowsDefer: true,
      },
    ],
    sections: [
      {
        key: 'gown',
        isOptional: false,
        tasks: [
          { key: 'collect_gown_inspiration', isOptional: false, effortMinutes: 120 },
          { key: 'set_gown_budget', isOptional: false, effortMinutes: 60, costCategory: 'attire_beauty' },
          { key: 'go_dress_shopping', isOptional: false, effortMinutes: 360, dependsOn: ['collect_gown_inspiration', 'set_gown_budget'] },
          { key: 'buy_undergarments', isOptional: false, effortMinutes: 60, dependsOn: ['go_dress_shopping'] },

          // ── Renting ──
          {
            key: 'book_rental_appointments',
            isOptional: false,
            leadTimeDays: 14,
            effortMinutes: 120,
            dependsOn: ['collect_gown_inspiration', 'set_gown_budget'],
            appliesWhen: ['attire.dress_acquisition == rent'],
          },
          {
            key: 'reserve_rental_gown',
            isOptional: false,
            leadTimeDays: 21,
            effortMinutes: 60,
            dependsOn: ['book_rental_appointments'],
            costCategory: 'attire_beauty',
            appliesWhen: ['attire.dress_acquisition == rent'],
          },
          {
            key: 'confirm_rental_window_and_return',
            isOptional: false,
            leadTimeDays: 7,
            effortMinutes: 30,
            dependsOn: ['reserve_rental_gown'],
            appliesWhen: ['attire.dress_acquisition == rent'],
          },

          // ── Buying, either way ──
          {
            key: 'book_salon_appointments',
            isOptional: false,
            leadTimeDays: 21,
            effortMinutes: 180,
            dependsOn: ['collect_gown_inspiration', 'set_gown_budget'],
            appliesWhen: ['attire.dress_acquisition in (buy_offrack, buy_custom)'],
          },
          {
            key: 'buy_the_gown_offrack',
            isOptional: false,
            leadTimeDays: 60,
            effortMinutes: 120,
            dependsOn: ['book_salon_appointments'],
            costCategory: 'attire_beauty',
            appliesWhen: ['attire.dress_acquisition == buy_offrack'],
          },
          {
            key: 'order_the_gown',
            isOptional: false,
            leadTimeDays: 180,
            effortMinutes: 120,
            dependsOn: ['book_salon_appointments'],
            costCategory: 'attire_beauty',
            appliesWhen: ['attire.dress_acquisition == buy_custom'],
          },
          {
            key: 'first_fitting',
            isOptional: false,
            leadTimeDays: 56,
            effortMinutes: 120,
            dependsOn: ['buy_the_gown_offrack', 'order_the_gown'],
            appliesWhen: ['attire.dress_acquisition in (buy_offrack, buy_custom)'],
          },
          // The third fitting exists because a custom gown is built to a body
          // that changes over six months. An off-the-rack gown needs two.
          {
            key: 'second_fitting',
            isOptional: false,
            leadTimeDays: 28,
            effortMinutes: 120,
            dependsOn: ['first_fitting'],
            appliesWhen: ['attire.dress_acquisition == buy_custom'],
          },
          {
            key: 'final_fitting_and_bustle',
            isOptional: false,
            leadTimeDays: 14,
            effortMinutes: 120,
            dependsOn: ['first_fitting', 'second_fitting'],
            appliesWhen: ['attire.dress_acquisition in (buy_offrack, buy_custom)'],
          },
          {
            key: 'learn_the_bustle',
            isOptional: false,
            effortMinutes: 30,
            dependsOn: ['final_fitting_and_bustle'],
            appliesWhen: ['attire.dress_acquisition in (buy_offrack, buy_custom)'],
          },

          // ── Second look ──
          {
            key: 'choose_second_look',
            isOptional: false,
            costCategory: 'attire_beauty',
            appliesWhen: ['attire.second_look == yes'],
          },
          {
            key: 'arrange_quick_change_help',
            isOptional: false,
            appliesWhen: ['attire.second_look == yes'],
          },
        ],
      },
      {
        key: 'suit',
        isOptional: false,
        tasks: [
          { key: 'decide_suit_or_tux', isOptional: false },
          { key: 'buy_accessories', isOptional: false, costCategory: 'attire_beauty' },
          {
            key: 'reserve_suit_rental',
            isOptional: false,
            leadTimeDays: 30,
            costCategory: 'attire_beauty',
            appliesWhen: ['attire.suit_acquisition == rent'],
          },
          {
            key: 'rental_pickup_and_try_on',
            isOptional: false,
            leadTimeDays: 5,
            appliesWhen: ['attire.suit_acquisition == rent'],
          },
          {
            key: 'order_suit',
            isOptional: false,
            leadTimeDays: 90,
            costCategory: 'attire_beauty',
            appliesWhen: ['attire.suit_acquisition in (buy_offrack, custom_tailor)'],
          },
          {
            key: 'custom_suit_measurements',
            isOptional: false,
            leadTimeDays: 120,
            appliesWhen: ['attire.suit_acquisition == custom_tailor'],
          },
          {
            key: 'suit_alterations',
            isOptional: false,
            leadTimeDays: 21,
            appliesWhen: ['attire.suit_acquisition in (buy_offrack, custom_tailor)'],
          },
        ],
      },
      {
        key: 'shoes',
        isOptional: false,
        tasks: [
          { key: 'buy_shoes', isOptional: false, costCategory: 'attire_beauty' },
          // Applies to every couple, including the one who rented everything.
          { key: 'break_in_shoes', isOptional: false },
        ],
      },
      {
        key: 'beauty',
        isOptional: false,
        tasks: [
          { key: 'plan_skin_timeline', isOptional: true },
          { key: 'book_nails', isOptional: true, costCategory: 'attire_beauty' },
          {
            key: 'book_hair_makeup',
            isOptional: false,
            leadTimeDays: 180,
            costCategory: 'attire_beauty',
            appliesWhen: ['attire.beauty_approach != diy'],
          },
          {
            key: 'do_hair_makeup_trial',
            isOptional: false,
            leadTimeDays: 60,
            appliesWhen: ['attire.beauty_approach != diy'],
          },
          {
            key: 'book_party_beauty',
            isOptional: false,
            costCategory: 'attire_beauty',
            appliesWhen: ['attire.beauty_approach == pro_team'],
          },
          {
            key: 'book_a_makeup_lesson',
            isOptional: true,
            appliesWhen: ['attire.beauty_approach == diy'],
          },
          {
            key: 'practice_the_diy_look',
            isOptional: false,
            leadTimeDays: 30,
            appliesWhen: ['attire.beauty_approach == diy'],
          },
        ],
      },
    ],
  },

  // ── 6 ─────────────────────────────────────────────────────────────────────
  {
    key: 'guests_stationery',
    order: 6,
    isOptional: false,
    estimatedDaysRange: [21, 45],
    prerequisites: ['venue_date'],
    weddingTypes: ALL_BUT_ELOPEMENT,
    answerNamespace: 'guests',
    scopingQuestions: [
      {
        key: 'plus_one_policy',
        options: ['all_adults', 'named_partners', 'case_by_case', 'no_plus_ones'],
        defaultValue: 'named_partners',
        allowsDefer: true,
      },
      {
        key: 'kids_policy',
        options: ['all_kids', 'immediate_family_only', 'age_cutoff', 'adults_only'],
        defaultValue: 'immediate_family_only',
        allowsDefer: true,
      },
      {
        key: 'invitation_format',
        options: ['paper_suite', 'digital_first', 'hybrid'],
        defaultValue: 'hybrid',
        allowsDefer: true,
      },
    ],
    sections: [
      {
        key: 'list',
        isOptional: false,
        tasks: [
          { key: 'draft_guest_list', isOptional: false },
          { key: 'set_plus_one_policy', isOptional: false },
          { key: 'set_kids_policy', isOptional: false },
          { key: 'negotiate_family_additions', isOptional: false },
          { key: 'collect_addresses', isOptional: false, leadTimeDays: 21 },
          { key: 'lock_final_list', isOptional: false },
          {
            key: 'budget_open_plus_ones',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['guests.plus_one_policy == all_adults'],
          },
          {
            key: 'name_established_partners',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['guests.plus_one_policy == named_partners'],
          },
          {
            key: 'review_plus_one_exceptions',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['guests.plus_one_policy == case_by_case'],
          },
          {
            key: 'word_no_plus_one_invitations',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['guests.plus_one_policy == no_plus_ones'],
          },
          {
            key: 'count_children_and_plan_seating',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['guests.kids_policy == all_kids'],
          },
          {
            key: 'list_kid_exceptions_by_household',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['guests.kids_policy == immediate_family_only'],
          },
          {
            key: 'set_and_publish_age_cutoff',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['guests.kids_policy == age_cutoff'],
          },
          {
            key: 'word_adults_only_consistently',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['guests.kids_policy == adults_only'],
          },
        ],
      },
      {
        key: 'website',
        isOptional: false,
        tasks: [
          { key: 'build_wedding_website', isOptional: false },
          { key: 'add_travel_and_dress_code', isOptional: false },
          { key: 'link_registry', isOptional: false },
        ],
      },
      {
        key: 'paper',
        isOptional: false,
        tasks: [
          { key: 'send_save_the_dates', isOptional: false, leadTimeDays: 30, costCategory: 'stationery' },
          {
            key: 'design_invitation_suite',
            isOptional: false,
            costCategory: 'stationery',
            appliesWhen: ['guests.invitation_format in (paper_suite, hybrid)'],
          },
          {
            key: 'order_invitations',
            isOptional: false,
            leadTimeDays: 42,
            costCategory: 'stationery',
            appliesWhen: ['guests.invitation_format in (paper_suite, hybrid)'],
          },
          {
            key: 'address_and_stuff',
            isOptional: false,
            leadTimeDays: 14,
            appliesWhen: ['guests.invitation_format in (paper_suite, hybrid)'],
          },
          {
            key: 'mail_invitations',
            isOptional: false,
            appliesWhen: ['guests.invitation_format in (paper_suite, hybrid)'],
          },
          {
            key: 'choose_digital_invitation_platform',
            isOptional: false,
            effortMinutes: 120,
            appliesWhen: ['guests.invitation_format == digital_first'],
          },
          {
            key: 'test_digital_delivery_and_rsvp',
            isOptional: false,
            effortMinutes: 90,
            dependsOn: ['choose_digital_invitation_platform'],
            appliesWhen: ['guests.invitation_format == digital_first'],
          },
          {
            key: 'plan_offline_guest_backup',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['guests.invitation_format == digital_first'],
          },
          {
            key: 'build_digital_rsvp_flow',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['guests.invitation_format == hybrid'],
          },
          { key: 'set_rsvp_deadline', isOptional: false },
          { key: 'chase_rsvps', isOptional: false },
        ],
      },
    ],
  },

  // ── 7 ─────────────────────────────────────────────────────────────────────
  {
    key: 'guest_experience',
    order: 7,
    isOptional: true,
    estimatedDaysRange: [14, 30],
    prerequisites: ['venue_date'],
    weddingTypes: FULL_SCALE_ONLY,
    answerNamespace: 'travel',
    scopingQuestions: [
      {
        key: 'guest_mix',
        options: ['mostly_local', 'domestic_travelers', 'international_travelers'],
        defaultValue: 'domestic_travelers',
        allowsDefer: true,
      },
      {
        key: 'mobility_plan',
        options: ['walkable_transit', 'guest_self_transport', 'hosted_shuttles', 'mixed_access'],
        defaultValue: 'guest_self_transport',
        allowsDefer: true,
      },
      {
        key: 'welcome_level',
        options: ['guide_only', 'casual_gathering', 'hosted_event'],
        defaultValue: 'casual_gathering',
        allowsDefer: true,
      },
    ],
    sections: [
      {
        key: 'lodging',
        isOptional: false,
        appliesWhen: ['travel.guest_mix != mostly_local'],
        tasks: [
          { key: 'block_hotel_rooms', isOptional: false, leadTimeDays: 120 },
          { key: 'share_booking_links', isOptional: false },
          { key: 'watch_block_release_date', isOptional: false },
          {
            key: 'estimate_domestic_room_demand',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['travel.guest_mix == domestic_travelers'],
          },
          {
            key: 'map_international_arrival_needs',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['travel.guest_mix == international_travelers'],
          },
        ],
      },
      {
        key: 'local',
        isOptional: true,
        appliesWhen: ['travel.guest_mix == mostly_local'],
        tasks: [
          {
            key: 'confirm_lodging_help_not_needed',
            isOptional: false,
            effortMinutes: 30,
          },
        ],
      },
      {
        key: 'transport',
        isOptional: true,
        tasks: [
          { key: 'arrange_shuttles', isOptional: true, leadTimeDays: 60, costCategory: 'transportation', appliesWhen: ['travel.mobility_plan == hosted_shuttles'] },
          { key: 'plan_couple_transport', isOptional: true, costCategory: 'transportation' },
          { key: 'plan_late_night_rides', isOptional: true, appliesWhen: ['travel.mobility_plan in (guest_self_transport, mixed_access)'] },
          {
            key: 'publish_walkable_route_and_accessibility',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['travel.mobility_plan == walkable_transit'],
          },
          {
            key: 'publish_parking_and_ride_details',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['travel.mobility_plan == guest_self_transport'],
          },
          {
            key: 'set_shuttle_schedule_and_capacity',
            isOptional: false,
            effortMinutes: 90,
            dependsOn: ['arrange_shuttles'],
            appliesWhen: ['travel.mobility_plan == hosted_shuttles'],
          },
          {
            key: 'map_transport_by_guest_need',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['travel.mobility_plan == mixed_access'],
          },
        ],
      },
      {
        key: 'welcome',
        isOptional: true,
        tasks: [
          { key: 'assemble_welcome_bags', isOptional: true, costCategory: 'favors_gifts', appliesWhen: ['travel.welcome_level in (casual_gathering, hosted_event)'] },
          { key: 'write_area_guide', isOptional: true },
          { key: 'plan_welcome_party', isOptional: true, appliesWhen: ['travel.welcome_level == hosted_event'] },
          {
            key: 'send_concise_arrival_guide',
            isOptional: false,
            effortMinutes: 45,
            appliesWhen: ['travel.welcome_level == guide_only'],
          },
          {
            key: 'plan_drop_in_welcome',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['travel.welcome_level == casual_gathering'],
          },
        ],
      },
      {
        key: 'international',
        isOptional: true,
        appliesWhen: ['travel.guest_mix == international_travelers'],
        tasks: [
          { key: 'send_early_stds_overseas', isOptional: true, leadTimeDays: 90 },
          { key: 'write_visa_invitation_letters', isOptional: true, leadTimeDays: 60 },
          { key: 'check_guest_passport_validity', isOptional: true },
        ],
      },
    ],
  },

  // ── 8 ─────────────────────────────────────────────────────────────────────
  {
    key: 'food_beverage',
    order: 8,
    isOptional: false,
    estimatedDaysRange: [21, 40],
    prerequisites: ['venue_date'],
    weddingTypes: ALL_BUT_ELOPEMENT,
    answerNamespace: 'food',
    scopingQuestions: [
      {
        key: 'service_style',
        options: ['plated', 'buffet', 'family_style', 'stations'],
        defaultValue: 'plated',
        allowsDefer: true,
      },
      {
        key: 'bar_package',
        options: ['open_bar', 'limited_bar', 'byob', 'dry'],
        defaultValue: 'open_bar',
        allowsDefer: true,
      },
      {
        key: 'dessert',
        options: ['cake', 'dessert_table', 'both', 'none'],
        defaultValue: 'cake',
        allowsDefer: true,
      },
    ],
    sections: [
      {
        key: 'menu',
        isOptional: false,
        tasks: [
          { key: 'choose_service_style', isOptional: false },
          { key: 'book_caterer', isOptional: false, leadTimeDays: 240, costCategory: 'venue_catering' },
          { key: 'attend_tasting', isOptional: false, leadTimeDays: 90 },
          { key: 'finalize_menu', isOptional: false },
          { key: 'collect_dietary_needs', isOptional: false },
          { key: 'budget_vendor_meals', isOptional: false, costCategory: 'venue_catering' },
          // A plated dinner is the reason meal choice appears on the RSVP card and
          // the reason place cards need a meal indicator. Buffets need neither.
          {
            key: 'collect_meal_choices_with_rsvp',
            isOptional: false,
            leadTimeDays: 45,
            appliesWhen: ['food.service_style == plated'],
          },
          {
            key: 'build_meal_key_for_place_cards',
            isOptional: false,
            leadTimeDays: 14,
            appliesWhen: ['food.service_style == plated'],
          },
          {
            key: 'confirm_line_count_and_flow',
            isOptional: false,
            appliesWhen: ['food.service_style in (buffet, stations)'],
          },
          {
            key: 'confirm_platters_per_table',
            isOptional: false,
            appliesWhen: ['food.service_style == family_style'],
          },
        ],
      },
      {
        key: 'bar',
        isOptional: false,
        tasks: [
          { key: 'choose_bar_package', isOptional: false, costCategory: 'venue_catering' },
          { key: 'plan_nonalcoholic_menu', isOptional: false },
          {
            key: 'confirm_bartender_ratio',
            isOptional: false,
            appliesWhen: ['food.bar_package != dry'],
          },
          {
            key: 'pick_signature_drinks',
            isOptional: true,
            appliesWhen: ['food.bar_package in (open_bar, limited_bar, byob)'],
          },
          {
            key: 'check_corkage_and_byob',
            isOptional: false,
            appliesWhen: ['food.bar_package == byob'],
          },
          {
            key: 'buy_alcohol_and_estimate_quantities',
            isOptional: false,
            leadTimeDays: 21,
            costCategory: 'venue_catering',
            appliesWhen: ['food.bar_package == byob'],
          },
          {
            key: 'hire_licensed_bartender',
            isOptional: false,
            leadTimeDays: 60,
            costCategory: 'venue_catering',
            appliesWhen: ['food.bar_package == byob'],
          },
        ],
      },
      {
        key: 'cake',
        isOptional: true,
        appliesWhen: ['food.dessert != none'],
        tasks: [
          {
            key: 'book_baker',
            isOptional: false,
            leadTimeDays: 120,
            costCategory: 'venue_catering',
            appliesWhen: ['food.dessert in (cake, both)'],
          },
          {
            key: 'cake_tasting',
            isOptional: false,
            appliesWhen: ['food.dessert in (cake, both)'],
          },
          {
            key: 'check_cake_cutting_fee',
            isOptional: false,
            appliesWhen: ['food.dessert in (cake, both)'],
          },
          {
            key: 'plan_dessert_table',
            isOptional: false,
            costCategory: 'venue_catering',
            appliesWhen: ['food.dessert in (dessert_table, both)'],
          },
        ],
      },
    ],
  },

  // ── 9 ─────────────────────────────────────────────────────────────────────
  {
    key: 'design_flowers',
    order: 9,
    isOptional: false,
    estimatedDaysRange: [21, 40],
    prerequisites: ['venue_date'],
    weddingTypes: ALL_BUT_ELOPEMENT,
    answerNamespace: 'design',
    scopingQuestions: [
      {
        key: 'scope',
        options: ['immersive', 'focal_moments', 'minimal'],
        defaultValue: 'focal_moments',
        allowsDefer: true,
      },
      {
        key: 'floral_approach',
        options: ['fresh_full_service', 'seasonal_flexible', 'low_flower_reusable', 'non_floral'],
        defaultValue: 'seasonal_flexible',
        allowsDefer: true,
      },
      {
        key: 'production_owner',
        options: ['full_service_team', 'split_vendor_diy', 'couple_diy'],
        defaultValue: 'full_service_team',
        allowsDefer: true,
      },
    ],
    sections: [
      {
        key: 'direction',
        isOptional: false,
        tasks: [
          { key: 'build_mood_board', isOptional: false },
          { key: 'choose_palette', isOptional: false },
          { key: 'set_decor_budget', isOptional: false, costCategory: 'flowers_decor' },
          {
            key: 'map_immersive_design_zones',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['design.scope == immersive'],
          },
          {
            key: 'choose_focal_design_moments',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['design.scope == focal_moments'],
          },
          {
            key: 'write_minimal_design_rules',
            isOptional: false,
            effortMinutes: 45,
            appliesWhen: ['design.scope == minimal'],
          },
        ],
      },
      {
        key: 'florals',
        isOptional: false,
        tasks: [
          { key: 'book_florist', isOptional: false, leadTimeDays: 180, costCategory: 'flowers_decor', appliesWhen: ['design.floral_approach != non_floral'] },
          { key: 'confirm_seasonal_availability', isOptional: false, appliesWhen: ['design.floral_approach != non_floral'] },
          { key: 'finalize_floral_list', isOptional: false, appliesWhen: ['design.floral_approach != non_floral'] },
          { key: 'plan_flower_reuse', isOptional: true, appliesWhen: ['design.floral_approach != non_floral'] },
          {
            key: 'write_fresh_floral_brief',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['design.floral_approach == fresh_full_service'],
          },
          {
            key: 'approve_seasonal_substitution_rules',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['design.floral_approach == seasonal_flexible'],
          },
          {
            key: 'design_low_flower_reuse_plan',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['design.floral_approach == low_flower_reusable'],
          },
          {
            key: 'design_non_floral_tablescape',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['design.floral_approach == non_floral'],
          },
        ],
      },
      {
        key: 'rentals',
        isOptional: false,
        tasks: [
          { key: 'confirm_what_venue_provides', isOptional: false },
          { key: 'book_rentals', isOptional: false, leadTimeDays: 90, costCategory: 'flowers_decor' },
          { key: 'plan_lighting', isOptional: true, costCategory: 'flowers_decor', appliesWhen: ['design.scope != minimal'] },
          { key: 'confirm_setup_strike_times', isOptional: false },
          {
            key: 'confirm_full_service_install_plan',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['design.production_owner == full_service_team'],
          },
          {
            key: 'write_vendor_diy_responsibility_matrix',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['design.production_owner == split_vendor_diy'],
          },
          {
            key: 'pack_and_label_diy_decor',
            isOptional: false,
            effortMinutes: 240,
            appliesWhen: ['design.production_owner == split_vendor_diy'],
          },
          {
            key: 'build_full_diy_setup_plan',
            isOptional: false,
            effortMinutes: 180,
            appliesWhen: ['design.production_owner == couple_diy'],
          },
          {
            key: 'recruit_diy_setup_and_strike_crew',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['design.production_owner == couple_diy'],
          },
          {
            key: 'mock_up_and_inventory_diy_decor',
            isOptional: false,
            effortMinutes: 240,
            appliesWhen: ['design.production_owner == couple_diy'],
          },
        ],
      },
      {
        key: 'signage',
        isOptional: true,
        tasks: [
          { key: 'plan_signage', isOptional: true, costCategory: 'stationery' },
          { key: 'design_escort_display', isOptional: true, costCategory: 'stationery', appliesWhen: ['design.scope != minimal'] },
          { key: 'plan_guest_book', isOptional: true },
        ],
      },
    ],
  },

  // ── 10 ────────────────────────────────────────────────────────────────────
  {
    key: 'ceremony',
    order: 10,
    isOptional: false,
    estimatedDaysRange: [14, 30],
    prerequisites: ['vendor_team'],
    answerNamespace: 'ceremony',
    scopingQuestions: [
      {
        key: 'structure',
        options: ['traditional', 'personal_story_led', 'blended_traditions'],
        defaultValue: 'personal_story_led',
        allowsDefer: true,
      },
      {
        key: 'vow_format',
        options: ['personal_in_ceremony', 'private_before', 'guided_or_standard'],
        defaultValue: 'personal_in_ceremony',
        allowsDefer: true,
      },
      {
        key: 'guest_photos',
        options: ['fully_unplugged', 'vows_unplugged', 'photos_welcome'],
        defaultValue: 'vows_unplugged',
        allowsDefer: true,
      },
    ],
    sections: [
      {
        key: 'script',
        isOptional: false,
        tasks: [
          { key: 'choose_ceremony_structure', isOptional: false },
          { key: 'draft_ceremony_script', isOptional: false },
          { key: 'write_vows', isOptional: false, appliesWhen: ['ceremony.vow_format in (personal_in_ceremony, private_before)'] },
          { key: 'choose_readings', isOptional: true },
          { key: 'ask_readers', isOptional: true },
          {
            key: 'confirm_traditional_ceremony_elements',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['ceremony.structure == traditional'],
          },
          {
            key: 'interview_each_other_for_ceremony_story',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['ceremony.structure == personal_story_led'],
          },
          {
            key: 'map_blended_ceremony_elements',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['ceremony.structure == blended_traditions'],
          },
          {
            key: 'share_public_vows_for_timing',
            isOptional: false,
            effortMinutes: 45,
            appliesWhen: ['ceremony.vow_format == personal_in_ceremony'],
          },
          {
            key: 'plan_private_vow_exchange',
            isOptional: false,
            effortMinutes: 45,
            appliesWhen: ['ceremony.vow_format == private_before'],
          },
          {
            key: 'select_guided_vow_language',
            isOptional: false,
            effortMinutes: 45,
            appliesWhen: ['ceremony.vow_format == guided_or_standard'],
          },
        ],
      },
      {
        key: 'ritual',
        isOptional: true,
        tasks: [
          { key: 'choose_unity_ritual', isOptional: true, appliesWhen: ['ceremony.structure in (traditional, blended_traditions)'] },
          { key: 'plan_interfaith_blend', isOptional: true, appliesWhen: ['ceremony.structure == blended_traditions'] },
          { key: 'brief_both_officiants', isOptional: true, appliesWhen: ['ceremony.structure == blended_traditions'] },
        ],
      },
      {
        key: 'logistics',
        isOptional: false,
        tasks: [
          { key: 'set_processional_order', isOptional: false },
          { key: 'choose_ceremony_music', isOptional: false },
          { key: 'confirm_ceremony_sound', isOptional: false },
          { key: 'decide_unplugged', isOptional: true, appliesWhen: ['ceremony.guest_photos in (fully_unplugged, vows_unplugged)'] },
          {
            key: 'communicate_phone_free_ceremony',
            isOptional: false,
            effortMinutes: 45,
            appliesWhen: ['ceremony.guest_photos == fully_unplugged'],
          },
          {
            key: 'designate_vow_photo_boundary',
            isOptional: false,
            effortMinutes: 30,
            appliesWhen: ['ceremony.guest_photos == vows_unplugged'],
          },
          {
            key: 'publish_respectful_guest_photo_rules',
            isOptional: false,
            effortMinutes: 30,
            appliesWhen: ['ceremony.guest_photos == photos_welcome'],
          },
        ],
      },
    ],
  },

  // ── 11 ────────────────────────────────────────────────────────────────────
  {
    key: 'registry_rings_honeymoon',
    order: 11,
    isOptional: false,
    estimatedDaysRange: [14, 35],
    prerequisites: ['foundation'],
    answerNamespace: 'life',
    scopingQuestions: [
      {
        key: 'ring_plan',
        options: ['ready_made', 'custom_made', 'heirloom_existing'],
        defaultValue: 'ready_made',
        allowsDefer: true,
      },
      {
        key: 'registry_style',
        options: ['objects', 'objects_and_funds', 'funds_only', 'no_registry'],
        defaultValue: 'objects_and_funds',
        allowsDefer: true,
      },
      {
        key: 'honeymoon_timing',
        options: ['immediate_trip', 'delayed_trip', 'mini_moon', 'later_undecided'],
        defaultValue: 'delayed_trip',
        allowsDefer: true,
      },
    ],
    sections: [
      {
        key: 'rings',
        isOptional: false,
        tasks: [
          { key: 'set_ring_budget', isOptional: false, costCategory: 'rings', appliesWhen: ['life.ring_plan != heirloom_existing'] },
          { key: 'try_on_bands', isOptional: false, appliesWhen: ['life.ring_plan != heirloom_existing'] },
          { key: 'order_bands', isOptional: false, leadTimeDays: 60, costCategory: 'rings', appliesWhen: ['life.ring_plan in (ready_made, custom_made)'] },
          { key: 'engrave_bands', isOptional: true, leadTimeDays: 14 },
          { key: 'insure_rings', isOptional: true },
          {
            key: 'confirm_ready_made_stock_and_sizing',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['life.ring_plan == ready_made'],
          },
          {
            key: 'approve_custom_ring_design',
            isOptional: false,
            leadTimeDays: 90,
            effortMinutes: 120,
            appliesWhen: ['life.ring_plan == custom_made'],
          },
          {
            key: 'assess_heirloom_resize_and_restoration',
            isOptional: false,
            leadTimeDays: 45,
            effortMinutes: 90,
            appliesWhen: ['life.ring_plan == heirloom_existing'],
          },
          {
            key: 'record_heirloom_ring_story',
            isOptional: true,
            effortMinutes: 45,
            appliesWhen: ['life.ring_plan == heirloom_existing'],
          },
        ],
      },
      {
        key: 'registry',
        isOptional: false,
        tasks: [
          { key: 'open_registry', isOptional: false, appliesWhen: ['life.registry_style != no_registry'] },
          { key: 'add_range_of_price_points', isOptional: false, appliesWhen: ['life.registry_style in (objects, objects_and_funds)'] },
          { key: 'add_cash_funds', isOptional: true, appliesWhen: ['life.registry_style in (objects_and_funds, funds_only)'] },
          {
            key: 'audit_home_and_life_needs',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['life.registry_style in (objects, objects_and_funds)'],
          },
          {
            key: 'write_specific_fund_descriptions',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['life.registry_style in (objects_and_funds, funds_only)'],
          },
          {
            key: 'publish_no_gifts_message',
            isOptional: false,
            effortMinutes: 30,
            appliesWhen: ['life.registry_style == no_registry'],
          },
        ],
      },
      {
        key: 'honeymoon',
        isOptional: true,
        tasks: [
          { key: 'choose_destination', isOptional: true, appliesWhen: ['life.honeymoon_timing != later_undecided'] },
          { key: 'check_passport_validity', isOptional: true, leadTimeDays: 90, appliesWhen: ['life.honeymoon_timing in (immediate_trip, delayed_trip)'] },
          { key: 'request_time_off', isOptional: true, leadTimeDays: 60, appliesWhen: ['life.honeymoon_timing != later_undecided'] },
          { key: 'book_travel', isOptional: true, leadTimeDays: 60, appliesWhen: ['life.honeymoon_timing != later_undecided'] },
          { key: 'buy_travel_insurance', isOptional: true, appliesWhen: ['life.honeymoon_timing in (immediate_trip, delayed_trip)'] },
          {
            key: 'protect_post_wedding_departure_buffer',
            isOptional: false,
            effortMinutes: 45,
            appliesWhen: ['life.honeymoon_timing == immediate_trip'],
          },
          {
            key: 'set_delayed_trip_savings_timeline',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['life.honeymoon_timing == delayed_trip'],
          },
          {
            key: 'plan_simple_mini_moon',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['life.honeymoon_timing == mini_moon'],
          },
          {
            key: 'park_honeymoon_without_pressure',
            isOptional: false,
            effortMinutes: 30,
            appliesWhen: ['life.honeymoon_timing == later_undecided'],
          },
        ],
      },
    ],
  },

  // ── 12 ────────────────────────────────────────────────────────────────────
  // US-critical. Getting this wrong makes the wedding legally impossible.
  {
    key: 'legal',
    order: 12,
    isOptional: false,
    estimatedDaysRange: [7, 21],
    prerequisites: ['venue_date'],
    answerNamespace: 'legal',
    scopingQuestions: [
      {
        key: 'document_context',
        options: ['standard_documents', 'prior_marriage_records', 'foreign_documents'],
        defaultValue: 'standard_documents',
        allowsDefer: true,
      },
      {
        key: 'name_plan',
        options: ['keep_names', 'one_partner_changes', 'both_change_or_new_name'],
        defaultValue: 'keep_names',
        allowsDefer: true,
      },
      {
        key: 'immigration_context',
        options: ['none', 'k1_or_fiance_visa', 'other_status_or_unsure'],
        defaultValue: 'none',
        allowsDefer: true,
      },
    ],
    sections: [
      {
        key: 'license',
        isOptional: false,
        tasks: [
          { key: 'look_up_county_rules', isOptional: false },
          { key: 'gather_license_documents', isOptional: false },
          { key: 'translate_foreign_documents', isOptional: true, leadTimeDays: 30, appliesWhen: ['legal.document_context == foreign_documents'] },
          { key: 'book_clerk_appointment', isOptional: false, leadTimeDays: 21 },
          { key: 'get_marriage_license', isOptional: false },
          { key: 'observe_waiting_period', isOptional: false },
          { key: 'check_license_expiry', isOptional: false },
          {
            key: 'confirm_standard_document_set_with_clerk',
            isOptional: false,
            effortMinutes: 45,
            appliesWhen: ['legal.document_context == standard_documents'],
          },
          {
            key: 'collect_prior_marriage_records_for_clerk',
            isOptional: false,
            leadTimeDays: 30,
            effortMinutes: 60,
            appliesWhen: ['legal.document_context == prior_marriage_records'],
          },
          {
            key: 'confirm_foreign_document_acceptance_with_clerk',
            isOptional: false,
            leadTimeDays: 45,
            effortMinutes: 60,
            appliesWhen: ['legal.document_context == foreign_documents'],
          },
        ],
      },
      {
        key: 'ceremony_legal',
        isOptional: false,
        tasks: [
          { key: 'verify_officiant_is_valid', isOptional: false },
          { key: 'line_up_witnesses', isOptional: false },
          { key: 'assign_license_carrier', isOptional: false },
          { key: 'confirm_license_return', isOptional: false },
        ],
      },
      {
        key: 'after',
        isOptional: false,
        tasks: [
          { key: 'order_certified_copies', isOptional: false, leadTimeDays: 21 },
          { key: 'change_name_social_security', isOptional: true, appliesWhen: ['legal.name_plan != keep_names'] },
          { key: 'change_name_drivers_license', isOptional: true, appliesWhen: ['legal.name_plan != keep_names'] },
          { key: 'change_name_passport', isOptional: true, appliesWhen: ['legal.name_plan != keep_names'] },
          { key: 'change_name_banks_and_work', isOptional: true, appliesWhen: ['legal.name_plan != keep_names'] },
          {
            key: 'confirm_no_name_change_workflow',
            isOptional: false,
            effortMinutes: 30,
            appliesWhen: ['legal.name_plan == keep_names'],
          },
          {
            key: 'map_one_partner_name_change_accounts',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['legal.name_plan == one_partner_changes'],
          },
          {
            key: 'map_both_partner_name_change_accounts',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['legal.name_plan == both_change_or_new_name'],
          },
        ],
      },
      {
        key: 'immigration',
        isOptional: true,
        appliesWhen: ['legal.immigration_context != none'],
        tasks: [
          { key: 'note_k1_ninety_day_window', isOptional: true, appliesWhen: ['legal.immigration_context == k1_or_fiance_visa'] },
          { key: 'consult_immigration_attorney', isOptional: false },
          {
            key: 'prepare_questions_for_immigration_counsel',
            isOptional: false,
            effortMinutes: 60,
          },
        ],
      },
    ],
  },

  // ── 13 ────────────────────────────────────────────────────────────────────
  {
    key: 'pre_wedding_events',
    order: 13,
    isOptional: true,
    estimatedDaysRange: [14, 40],
    prerequisites: ['guests_stationery'],
    weddingTypes: ALL_BUT_ELOPEMENT,
    answerNamespace: 'events',
    scopingQuestions: [
      {
        key: 'lead_up',
        options: ['none', 'hosted_by_others', 'one_joint_gathering', 'several_events'],
        defaultValue: 'hosted_by_others',
        allowsDefer: true,
      },
      {
        key: 'rehearsal_hospitality',
        options: ['formal_dinner', 'casual_meal', 'rehearsal_only'],
        defaultValue: 'casual_meal',
        allowsDefer: true,
      },
      {
        key: 'closing_events',
        options: ['none', 'after_party', 'farewell_brunch', 'both'],
        defaultValue: 'none',
        allowsDefer: true,
      },
    ],
    sections: [
      {
        key: 'parties',
        isOptional: true,
        tasks: [
          { key: 'plan_engagement_party', isOptional: true, appliesWhen: ['events.lead_up == several_events'] },
          { key: 'coordinate_showers', isOptional: true, appliesWhen: ['events.lead_up in (hosted_by_others, several_events)'] },
          { key: 'coordinate_bachelor_parties', isOptional: true, appliesWhen: ['events.lead_up in (hosted_by_others, several_events)'] },
          {
            key: 'protect_no_extra_events_boundary',
            isOptional: false,
            effortMinutes: 30,
            appliesWhen: ['events.lead_up == none'],
          },
          {
            key: 'set_boundaries_for_events_others_host',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['events.lead_up == hosted_by_others'],
          },
          {
            key: 'plan_one_joint_pre_wedding_gathering',
            isOptional: false,
            effortMinutes: 120,
            appliesWhen: ['events.lead_up == one_joint_gathering'],
          },
          {
            key: 'map_event_calendar_and_guest_overlap',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['events.lead_up == several_events'],
          },
        ],
      },
      {
        key: 'rehearsal',
        isOptional: false,
        tasks: [
          { key: 'book_rehearsal_time', isOptional: false, leadTimeDays: 60 },
          { key: 'book_rehearsal_dinner', isOptional: false, leadTimeDays: 90, costCategory: 'venue_catering', appliesWhen: ['events.rehearsal_hospitality == formal_dinner'] },
          { key: 'decide_rehearsal_guest_list', isOptional: false, appliesWhen: ['events.rehearsal_hospitality != rehearsal_only'] },
          { key: 'plan_toasts', isOptional: true, appliesWhen: ['events.rehearsal_hospitality == formal_dinner'] },
          {
            key: 'plan_casual_post_rehearsal_meal',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['events.rehearsal_hospitality == casual_meal'],
          },
          {
            key: 'communicate_rehearsal_only_plan',
            isOptional: false,
            effortMinutes: 30,
            appliesWhen: ['events.rehearsal_hospitality == rehearsal_only'],
          },
        ],
      },
      {
        key: 'after_events',
        isOptional: true,
        tasks: [
          { key: 'plan_after_party', isOptional: true, appliesWhen: ['events.closing_events in (after_party, both)'] },
          { key: 'plan_farewell_brunch', isOptional: true, appliesWhen: ['events.closing_events in (farewell_brunch, both)'] },
          {
            key: 'protect_unstructured_post_wedding_time',
            isOptional: false,
            effortMinutes: 30,
            appliesWhen: ['events.closing_events == none'],
          },
          {
            key: 'coordinate_two_closing_events_without_overlap',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['events.closing_events == both'],
          },
        ],
      },
    ],
  },

  // ── 14 ────────────────────────────────────────────────────────────────────
  {
    key: 'final_30_and_day_of',
    order: 14,
    isOptional: false,
    estimatedDaysRange: [14, 30],
    prerequisites: ['food_beverage', 'design_flowers', 'ceremony'],
    answerNamespace: 'finale',
    scopingQuestions: [
      {
        key: 'coordination_handoff',
        options: ['professional', 'trusted_person', 'couple_led'],
        defaultValue: 'trusted_person',
        allowsDefer: true,
      },
      {
        key: 'weather_exposure',
        options: ['indoors', 'outdoor_with_backup', 'mixed_spaces'],
        defaultValue: 'mixed_spaces',
        allowsDefer: true,
      },
      {
        key: 'closeout_owner',
        options: ['delegated', 'shared_with_helpers', 'couple_managed'],
        defaultValue: 'shared_with_helpers',
        allowsDefer: true,
      },
    ],
    sections: [
      {
        key: 'numbers',
        isOptional: false,
        tasks: [
          { key: 'give_final_headcount', isOptional: false, leadTimeDays: 10 },
          { key: 'build_seating_chart', isOptional: false, weddingTypes: ALL_BUT_ELOPEMENT },
          { key: 'print_escort_and_place_cards', isOptional: false, weddingTypes: ALL_BUT_ELOPEMENT, costCategory: 'stationery' },
          { key: 'confirm_dietary_counts', isOptional: false },
        ],
      },
      {
        key: 'run_of_show',
        isOptional: false,
        tasks: [
          { key: 'build_run_of_show', isOptional: false },
          { key: 'send_timeline_to_all_vendors', isOptional: false },
          { key: 'confirm_vendor_arrival_times', isOptional: false },
          { key: 'send_shot_list', isOptional: false, leadTimeDays: 14 },
          { key: 'plan_around_golden_hour', isOptional: true },
          {
            key: 'confirm_professional_command_chain',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['finale.coordination_handoff == professional'],
          },
          {
            key: 'brief_trusted_day_of_lead',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['finale.coordination_handoff == trusted_person'],
          },
          {
            key: 'reduce_and_assign_couple_led_decisions',
            isOptional: false,
            effortMinutes: 120,
            appliesWhen: ['finale.coordination_handoff == couple_led'],
          },
        ],
      },
      {
        key: 'money_close_out',
        isOptional: false,
        tasks: [
          { key: 'pay_final_balances', isOptional: false, leadTimeDays: 14 },
          { key: 'prepare_tip_envelopes', isOptional: false, costCategory: 'buffer_tips' },
          { key: 'assign_someone_to_hand_out_tips', isOptional: false, appliesWhen: ['finale.coordination_handoff != couple_led'] },
        ],
      },
      {
        key: 'day_of',
        isOptional: false,
        tasks: [
          { key: 'pack_emergency_kit', isOptional: false },
          { key: 'pack_getting_ready_bag', isOptional: false },
          { key: 'assign_item_carriers', isOptional: false },
          { key: 'run_the_rehearsal', isOptional: false },
          { key: 'confirm_weather_backup', isOptional: false, appliesWhen: ['finale.weather_exposure in (outdoor_with_backup, mixed_spaces)'] },
          { key: 'hand_off_to_point_person', isOptional: false, appliesWhen: ['finale.coordination_handoff != couple_led'] },
          {
            key: 'confirm_indoor_access_and_climate',
            isOptional: false,
            effortMinutes: 45,
            appliesWhen: ['finale.weather_exposure == indoors'],
          },
          {
            key: 'set_outdoor_weather_decision_deadline',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['finale.weather_exposure == outdoor_with_backup'],
          },
          {
            key: 'map_weather_plan_by_space',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['finale.weather_exposure == mixed_spaces'],
          },
        ],
      },
      {
        key: 'after',
        isOptional: true,
        tasks: [
          { key: 'return_rentals_and_attire', isOptional: true, leadTimeDays: 7 },
          { key: 'preserve_the_gown', isOptional: true },
          { key: 'write_thank_you_notes', isOptional: false, leadTimeDays: 60 },
          { key: 'order_album', isOptional: true },
          {
            key: 'confirm_delegated_closeout_manifest',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['finale.closeout_owner == delegated'],
          },
          {
            key: 'split_closeout_shifts_with_helpers',
            isOptional: false,
            effortMinutes: 60,
            appliesWhen: ['finale.closeout_owner == shared_with_helpers'],
          },
          {
            key: 'protect_couple_managed_closeout_buffer',
            isOptional: false,
            effortMinutes: 90,
            appliesWhen: ['finale.closeout_owner == couple_managed'],
          },
        ],
      },
    ],
  },
]

export const QUEST_TEMPLATE_BY_KEY = new Map(QUEST_TEMPLATES.map(q => [q.key, q]))
