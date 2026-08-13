import type { BudgetCategory, Culture, WeddingType } from '@bliss/types'

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
  costCategory?: BudgetCategory
  /** Absent means the task applies to every wedding type. */
  weddingTypes?: WeddingType[]
  /** Task exists only when the couple has no planner of the listed strength. */
  requiresNoPlanner?: boolean
}

export interface SectionTemplate {
  key: string
  isOptional: boolean
  tasks: TaskTemplate[]
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
  sections: SectionTemplate[]
}

export const questI18nKey = (questKey: string, suffix: string) =>
  `quest.${questKey}.${suffix}`
export const sectionI18nKey = (questKey: string, sectionKey: string) =>
  `quest.${questKey}.section.${sectionKey}`
export const taskI18nKey = (questKey: string, taskKey: string) =>
  `quest.${questKey}.task.${taskKey}`

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
        ],
      },
      {
        key: 'shape',
        isOptional: false,
        tasks: [
          { key: 'draft_guest_count', isOptional: false },
          { key: 'pick_three_priorities', isOptional: false },
          { key: 'agree_non_negotiables', isOptional: false },
        ],
      },
      {
        key: 'support',
        isOptional: false,
        tasks: [
          { key: 'decide_planner_level', isOptional: false },
          { key: 'interview_planners', isOptional: true, leadTimeDays: 21 },
          { key: 'buy_wedding_insurance', isOptional: true, weddingTypes: ALL_BUT_ELOPEMENT },
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
    sections: [
      {
        key: 'date',
        isOptional: false,
        tasks: [
          { key: 'pick_season_and_range', isOptional: false },
          { key: 'check_family_conflicts', isOptional: false },
          { key: 'consider_offpeak_pricing', isOptional: true },
          { key: 'check_holiday_weekends', isOptional: true },
        ],
      },
      {
        key: 'search',
        isOptional: false,
        tasks: [
          { key: 'write_venue_requirements', isOptional: false },
          { key: 'shortlist_venues', isOptional: false },
          { key: 'check_availability', isOptional: false, leadTimeDays: 14 },
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
    sections: [
      {
        key: 'photo',
        isOptional: false,
        tasks: [
          { key: 'define_photo_style', isOptional: false },
          { key: 'shortlist_photographers', isOptional: false },
          { key: 'review_full_galleries', isOptional: false },
          { key: 'book_photographer', isOptional: false, leadTimeDays: 270, costCategory: 'photo_video' },
          { key: 'book_videographer', isOptional: true, leadTimeDays: 270, costCategory: 'photo_video' },
          { key: 'book_content_creator', isOptional: true, costCategory: 'photo_video' },
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
    sections: [
      {
        key: 'asks',
        isOptional: false,
        tasks: [
          { key: 'decide_party_size', isOptional: false },
          { key: 'ask_wedding_party', isOptional: false },
          { key: 'choose_honor_attendants', isOptional: false },
          { key: 'ask_kid_attendants', isOptional: true },
        ],
      },
      {
        key: 'roles',
        isOptional: false,
        tasks: [
          { key: 'explain_duties_and_costs', isOptional: false },
          { key: 'assign_day_of_jobs', isOptional: false },
          { key: 'name_a_point_person', isOptional: false },
          { key: 'set_up_group_chat', isOptional: false },
        ],
      },
      {
        key: 'party_attire',
        isOptional: false,
        tasks: [
          { key: 'set_party_attire_direction', isOptional: false, costCategory: 'attire_beauty' },
          { key: 'collect_party_sizes', isOptional: false, leadTimeDays: 30 },
          { key: 'order_party_attire', isOptional: false, leadTimeDays: 90, costCategory: 'attire_beauty' },
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
    sections: [
      {
        key: 'gown',
        isOptional: false,
        tasks: [
          { key: 'collect_gown_inspiration', isOptional: false },
          { key: 'set_gown_budget', isOptional: false, costCategory: 'attire_beauty' },
          { key: 'book_salon_appointments', isOptional: false, leadTimeDays: 21 },
          { key: 'go_dress_shopping', isOptional: false },
          { key: 'order_the_gown', isOptional: false, leadTimeDays: 180, costCategory: 'attire_beauty' },
          { key: 'first_fitting', isOptional: false, leadTimeDays: 56 },
          { key: 'second_fitting', isOptional: false, leadTimeDays: 28 },
          { key: 'final_fitting_and_bustle', isOptional: false, leadTimeDays: 14 },
          { key: 'learn_the_bustle', isOptional: false },
          { key: 'buy_undergarments', isOptional: false },
        ],
      },
      {
        key: 'suit',
        isOptional: false,
        tasks: [
          { key: 'decide_suit_or_tux', isOptional: false },
          { key: 'order_suit', isOptional: false, leadTimeDays: 90, costCategory: 'attire_beauty' },
          { key: 'suit_alterations', isOptional: false, leadTimeDays: 21 },
          { key: 'buy_accessories', isOptional: false, costCategory: 'attire_beauty' },
        ],
      },
      {
        key: 'shoes',
        isOptional: false,
        tasks: [
          { key: 'buy_shoes', isOptional: false, costCategory: 'attire_beauty' },
          { key: 'break_in_shoes', isOptional: false },
        ],
      },
      {
        key: 'beauty',
        isOptional: false,
        tasks: [
          { key: 'book_hair_makeup', isOptional: false, leadTimeDays: 180, costCategory: 'attire_beauty' },
          { key: 'do_hair_makeup_trial', isOptional: false, leadTimeDays: 60 },
          { key: 'book_party_beauty', isOptional: true, costCategory: 'attire_beauty' },
          { key: 'plan_skin_timeline', isOptional: true },
          { key: 'book_nails', isOptional: true, costCategory: 'attire_beauty' },
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
          { key: 'design_invitation_suite', isOptional: false, costCategory: 'stationery' },
          { key: 'order_invitations', isOptional: false, leadTimeDays: 42, costCategory: 'stationery' },
          { key: 'address_and_stuff', isOptional: false, leadTimeDays: 14 },
          { key: 'mail_invitations', isOptional: false },
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
    sections: [
      {
        key: 'lodging',
        isOptional: false,
        tasks: [
          { key: 'block_hotel_rooms', isOptional: false, leadTimeDays: 120 },
          { key: 'share_booking_links', isOptional: false },
          { key: 'watch_block_release_date', isOptional: false },
        ],
      },
      {
        key: 'transport',
        isOptional: true,
        tasks: [
          { key: 'arrange_shuttles', isOptional: true, leadTimeDays: 60, costCategory: 'transportation' },
          { key: 'plan_couple_transport', isOptional: true, costCategory: 'transportation' },
          { key: 'plan_late_night_rides', isOptional: true },
        ],
      },
      {
        key: 'welcome',
        isOptional: true,
        tasks: [
          { key: 'assemble_welcome_bags', isOptional: true, costCategory: 'favors_gifts' },
          { key: 'write_area_guide', isOptional: true },
          { key: 'plan_welcome_party', isOptional: true },
        ],
      },
      {
        key: 'international',
        isOptional: true,
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
        ],
      },
      {
        key: 'bar',
        isOptional: false,
        tasks: [
          { key: 'choose_bar_package', isOptional: false, costCategory: 'venue_catering' },
          { key: 'check_corkage_and_byob', isOptional: true },
          { key: 'pick_signature_drinks', isOptional: true },
          { key: 'confirm_bartender_ratio', isOptional: false },
        ],
      },
      {
        key: 'cake',
        isOptional: true,
        tasks: [
          { key: 'book_baker', isOptional: true, leadTimeDays: 120, costCategory: 'venue_catering' },
          { key: 'cake_tasting', isOptional: true },
          { key: 'check_cake_cutting_fee', isOptional: true },
          { key: 'plan_dessert_table', isOptional: true, costCategory: 'venue_catering' },
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
    sections: [
      {
        key: 'direction',
        isOptional: false,
        tasks: [
          { key: 'build_mood_board', isOptional: false },
          { key: 'choose_palette', isOptional: false },
          { key: 'set_decor_budget', isOptional: false, costCategory: 'flowers_decor' },
        ],
      },
      {
        key: 'florals',
        isOptional: false,
        tasks: [
          { key: 'book_florist', isOptional: false, leadTimeDays: 180, costCategory: 'flowers_decor' },
          { key: 'confirm_seasonal_availability', isOptional: false },
          { key: 'finalize_floral_list', isOptional: false },
          { key: 'plan_flower_reuse', isOptional: true },
        ],
      },
      {
        key: 'rentals',
        isOptional: false,
        tasks: [
          { key: 'confirm_what_venue_provides', isOptional: false },
          { key: 'book_rentals', isOptional: false, leadTimeDays: 90, costCategory: 'flowers_decor' },
          { key: 'plan_lighting', isOptional: true, costCategory: 'flowers_decor' },
          { key: 'confirm_setup_strike_times', isOptional: false },
        ],
      },
      {
        key: 'signage',
        isOptional: true,
        tasks: [
          { key: 'plan_signage', isOptional: true, costCategory: 'stationery' },
          { key: 'design_escort_display', isOptional: true, costCategory: 'stationery' },
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
    sections: [
      {
        key: 'script',
        isOptional: false,
        tasks: [
          { key: 'choose_ceremony_structure', isOptional: false },
          { key: 'draft_ceremony_script', isOptional: false },
          { key: 'write_vows', isOptional: false },
          { key: 'choose_readings', isOptional: true },
          { key: 'ask_readers', isOptional: true },
        ],
      },
      {
        key: 'ritual',
        isOptional: true,
        tasks: [
          { key: 'choose_unity_ritual', isOptional: true },
          { key: 'plan_interfaith_blend', isOptional: true },
          { key: 'brief_both_officiants', isOptional: true },
        ],
      },
      {
        key: 'logistics',
        isOptional: false,
        tasks: [
          { key: 'set_processional_order', isOptional: false },
          { key: 'choose_ceremony_music', isOptional: false },
          { key: 'confirm_ceremony_sound', isOptional: false },
          { key: 'decide_unplugged', isOptional: true },
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
    sections: [
      {
        key: 'rings',
        isOptional: false,
        tasks: [
          { key: 'set_ring_budget', isOptional: false, costCategory: 'rings' },
          { key: 'try_on_bands', isOptional: false },
          { key: 'order_bands', isOptional: false, leadTimeDays: 60, costCategory: 'rings' },
          { key: 'engrave_bands', isOptional: true, leadTimeDays: 14 },
          { key: 'insure_rings', isOptional: true },
        ],
      },
      {
        key: 'registry',
        isOptional: false,
        tasks: [
          { key: 'open_registry', isOptional: false },
          { key: 'add_range_of_price_points', isOptional: false },
          { key: 'add_cash_funds', isOptional: true },
        ],
      },
      {
        key: 'honeymoon',
        isOptional: true,
        tasks: [
          { key: 'choose_destination', isOptional: true },
          { key: 'check_passport_validity', isOptional: true, leadTimeDays: 90 },
          { key: 'request_time_off', isOptional: true, leadTimeDays: 60 },
          { key: 'book_travel', isOptional: true, leadTimeDays: 60 },
          { key: 'buy_travel_insurance', isOptional: true },
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
    sections: [
      {
        key: 'license',
        isOptional: false,
        tasks: [
          { key: 'look_up_county_rules', isOptional: false },
          { key: 'gather_license_documents', isOptional: false },
          { key: 'translate_foreign_documents', isOptional: true, leadTimeDays: 30 },
          { key: 'book_clerk_appointment', isOptional: false, leadTimeDays: 21 },
          { key: 'get_marriage_license', isOptional: false },
          { key: 'observe_waiting_period', isOptional: false },
          { key: 'check_license_expiry', isOptional: false },
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
          { key: 'change_name_social_security', isOptional: true },
          { key: 'change_name_drivers_license', isOptional: true },
          { key: 'change_name_passport', isOptional: true },
          { key: 'change_name_banks_and_work', isOptional: true },
        ],
      },
      {
        key: 'immigration',
        isOptional: true,
        tasks: [
          { key: 'note_k1_ninety_day_window', isOptional: true },
          { key: 'consult_immigration_attorney', isOptional: true },
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
    sections: [
      {
        key: 'parties',
        isOptional: true,
        tasks: [
          { key: 'plan_engagement_party', isOptional: true },
          { key: 'coordinate_showers', isOptional: true },
          { key: 'coordinate_bachelor_parties', isOptional: true },
        ],
      },
      {
        key: 'rehearsal',
        isOptional: false,
        tasks: [
          { key: 'book_rehearsal_time', isOptional: false, leadTimeDays: 60 },
          { key: 'book_rehearsal_dinner', isOptional: false, leadTimeDays: 90, costCategory: 'venue_catering' },
          { key: 'decide_rehearsal_guest_list', isOptional: false },
          { key: 'plan_toasts', isOptional: true },
        ],
      },
      {
        key: 'after_events',
        isOptional: true,
        tasks: [
          { key: 'plan_after_party', isOptional: true },
          { key: 'plan_farewell_brunch', isOptional: true },
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
        ],
      },
      {
        key: 'money_close_out',
        isOptional: false,
        tasks: [
          { key: 'pay_final_balances', isOptional: false, leadTimeDays: 14 },
          { key: 'prepare_tip_envelopes', isOptional: false, costCategory: 'buffer_tips' },
          { key: 'assign_someone_to_hand_out_tips', isOptional: false },
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
          { key: 'confirm_weather_backup', isOptional: false },
          { key: 'hand_off_to_point_person', isOptional: false },
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
        ],
      },
    ],
  },
]

export const QUEST_TEMPLATE_BY_KEY = new Map(QUEST_TEMPLATES.map(q => [q.key, q]))
