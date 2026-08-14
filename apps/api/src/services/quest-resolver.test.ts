/**
 * The Sprint 3 checkpoint (DESIGN.md §7): "rent" and "custom" produce two
 * different, good lists, with no model call anywhere in the path.
 *
 * If these tests pass, the product thesis in PRD.md §3 holds mechanically —
 * everything after this is quality of content and quality of conversation.
 */

import { describe, expect, it } from 'bun:test'
import {
  flattenTasks,
  resolveAnswers,
  resolveTree,
  tasksForQuest,
  type ResolverInput,
} from './quest-resolver'
import {
  validateContent,
  validateQuestPrerequisites,
} from '../content/validate-content'
import type { QuestTemplate } from '../content/quest-templates'

const attireKeys = (input: ResolverInput) =>
  tasksForQuest(resolveTree(input), 'attire_beauty').map(t => t.taskKey)

const foodKeys = (input: ResolverInput) =>
  tasksForQuest(resolveTree(input), 'food_beverage').map(t => t.taskKey)

// ─── The checkpoint ───────────────────────────────────────────────────────────

describe('rent vs custom', () => {
  const rent = attireKeys({ answers: { 'attire.dress_acquisition': 'rent' } })
  const custom = attireKeys({ answers: { 'attire.dress_acquisition': 'buy_custom' } })

  it('produces two different lists', () => {
    expect(rent).not.toEqual(custom)
  })

  it('never mentions alterations to someone who is renting', () => {
    for (const key of ['first_fitting', 'second_fitting', 'final_fitting_and_bustle', 'learn_the_bustle']) {
      expect(rent).not.toContain(key)
      expect(custom).toContain(key)
    }
  })

  it('gives the renter the tasks renting actually involves', () => {
    expect(rent).toContain('reserve_rental_gown')
    expect(rent).toContain('confirm_rental_window_and_return')
    expect(custom).not.toContain('reserve_rental_gown')
  })

  it('keeps what is true for everyone', () => {
    for (const key of ['collect_gown_inspiration', 'go_dress_shopping', 'buy_undergarments', 'break_in_shoes']) {
      expect(rent).toContain(key)
      expect(custom).toContain(key)
    }
  })

  it('makes the renter list shorter, because it genuinely is', () => {
    expect(rent.length).toBeLessThan(custom.length)
  })

  it('collapses the gown lead time that decides whether a plan fits', () => {
    // This is the number the scheduler turns into negative slack. A custom gown
    // is a six-month commitment; a rental is three weeks. Scoped to the gown
    // section on purpose: booking a hair and makeup artist is its own long lead
    // and would mask the difference at quest level.
    const gownLead = (acquisition: string) =>
      tasksForQuest(
        resolveTree({ answers: { 'attire.dress_acquisition': acquisition } }),
        'attire_beauty',
      )
        .filter(t => t.sectionKey === 'gown')
        .reduce((max, t) => Math.max(max, t.leadTimeDays), 0)

    expect(gownLead('buy_custom')).toBe(180)
    expect(gownLead('buy_offrack')).toBe(60)
    expect(gownLead('rent')).toBeLessThanOrEqual(30)
  })
})

describe('off the rack is its own answer, not a synonym', () => {
  const offrack = attireKeys({ answers: { 'attire.dress_acquisition': 'buy_offrack' } })
  const custom = attireKeys({ answers: { 'attire.dress_acquisition': 'buy_custom' } })

  it('gets two fittings, not three', () => {
    expect(offrack).toContain('first_fitting')
    expect(offrack).toContain('final_fitting_and_bustle')
    expect(offrack).not.toContain('second_fitting')
    expect(custom).toContain('second_fitting')
  })

  it('buys rather than orders', () => {
    expect(offrack).toContain('buy_the_gown_offrack')
    expect(offrack).not.toContain('order_the_gown')
  })
})

// ─── Generality: the same machinery on a second quest ─────────────────────────

describe('service style changes the food list', () => {
  it('asks for meal choices only when the meal is plated', () => {
    const plated = foodKeys({ answers: { 'food.service_style': 'plated' } })
    const buffet = foodKeys({ answers: { 'food.service_style': 'buffet' } })

    expect(plated).toContain('collect_meal_choices_with_rsvp')
    expect(plated).toContain('build_meal_key_for_place_cards')
    expect(buffet).not.toContain('collect_meal_choices_with_rsvp')
    expect(buffet).toContain('confirm_line_count_and_flow')
  })

  it('turns BYOB into the three tasks BYOB actually is', () => {
    const byob = foodKeys({ answers: { 'food.bar_package': 'byob' } })
    const open = foodKeys({ answers: { 'food.bar_package': 'open_bar' } })

    for (const key of ['check_corkage_and_byob', 'buy_alcohol_and_estimate_quantities', 'hire_licensed_bartender']) {
      expect(byob).toContain(key)
      expect(open).not.toContain(key)
    }
  })

  it('drops the bartender ratio for a dry wedding but keeps the drinks', () => {
    const dry = foodKeys({ answers: { 'food.bar_package': 'dry' } })
    expect(dry).not.toContain('confirm_bartender_ratio')
    expect(dry).toContain('plan_nonalcoholic_menu')
  })

  it('drops the whole cake section when there is no dessert', () => {
    const none = resolveTree({ answers: { 'food.dessert': 'none' } })
    const sections = none.quests
      .find(q => q.template.key === 'food_beverage')!
      .sections.map(s => s.section.key)
    expect(sections).not.toContain('cake')
    expect(sections).toContain('menu')
  })
})

describe('venue choices change only the work they actually create', () => {
  const venueKeys = (answers: Record<string, string>) => tasksForQuest(
    resolveTree({ answers }),
    'venue_date',
  ).map(task => task.taskKey)

  it('distinguishes a fixed date, a flexible window, and venue-first planning', () => {
    expect(venueKeys({ 'venue.date_flexibility': 'fixed_date' })).toContain('confirm_fixed_date_constraints')
    expect(venueKeys({ 'venue.date_flexibility': 'preferred_window' })).toContain('compare_date_options')
    expect(venueKeys({ 'venue.date_flexibility': 'venue_first' })).toContain('rank_venue_before_date')
  })

  it('prices each venue model through its real hidden work', () => {
    expect(venueKeys({ 'venue.venue_style': 'full_service' })).toContain('audit_full_service_inclusions')
    expect(venueKeys({ 'venue.venue_style': 'blank_canvas' })).toContain('build_blank_canvas_cost_model')
    expect(venueKeys({ 'venue.venue_style': 'restaurant_hotel' })).toContain('confirm_restaurant_buyout_terms')
    expect(venueKeys({ 'venue.venue_style': 'outdoor' })).toContain('verify_outdoor_infrastructure')
  })

  it('turns a two-site plan into transport work instead of a room-flip task', () => {
    const oneSite = venueKeys({ 'venue.site_plan': 'same_site' })
    const twoSites = venueKeys({ 'venue.site_plan': 'separate_sites' })
    expect(oneSite).toContain('confirm_room_flip_and_guest_flow')
    expect(oneSite).not.toContain('measure_transfer_time_and_transport')
    expect(twoSites).toContain('measure_transfer_time_and_transport')
    expect(twoSites).not.toContain('confirm_room_flip_and_guest_flow')
  })
})

describe('foundation decisions turn relationship agreements into concrete setup work', () => {
  const foundationKeys = (answers: Record<string, string>) => tasksForQuest(
    resolveTree({ answers }),
    'foundation',
  ).map(task => task.taskKey)

  it('keeps four different family-funding boundaries distinct', () => {
    expect(foundationKeys({ 'foundation.funding_boundaries': 'couple_funded' })).toContain('write_couple_funded_guardrails')
    expect(foundationKeys({ 'foundation.funding_boundaries': 'family_gift' })).toContain('confirm_family_gift_boundaries')
    expect(foundationKeys({ 'foundation.funding_boundaries': 'family_with_input' })).toContain('write_family_input_boundaries')
    expect(foundationKeys({ 'foundation.funding_boundaries': 'still_unclear' })).toContain('clarify_family_contributions')
  })

  it('creates one decision anchor rather than five generic priorities', () => {
    const meaning = foundationKeys({ 'foundation.tradeoff_anchor': 'meaning_tradition' })
    expect(meaning).toContain('define_meaning_tradition_anchor')
    expect(meaning).not.toContain('define_guest_experience_anchor')
    expect(meaning).not.toContain('define_low_stress_anchor')
  })

  it('supports ownership, shared decisions, a check-in, or a written protocol', () => {
    expect(foundationKeys({ 'foundation.decision_rhythm': 'domain_owners' })).toContain('map_domain_owners')
    expect(foundationKeys({ 'foundation.decision_rhythm': 'shared_big_decisions' })).toContain('define_two_yes_decisions')
    expect(foundationKeys({ 'foundation.decision_rhythm': 'weekly_checkin' })).toContain('schedule_weekly_planning_checkin')
    expect(foundationKeys({ 'foundation.decision_rhythm': 'needs_structure' })).toContain('write_decision_protocol')
  })
})

describe('guest policy decisions become consistent household and invitation work', () => {
  const guestKeys = (answers: Record<string, string>) => tasksForQuest(
    resolveTree({ answers }),
    'guests_stationery',
  ).map(task => task.taskKey)

  it('distinguishes open plus-ones, named partners, exceptions, and named guests only', () => {
    expect(guestKeys({ 'guests.plus_one_policy': 'all_adults' })).toContain('budget_open_plus_ones')
    expect(guestKeys({ 'guests.plus_one_policy': 'named_partners' })).toContain('name_established_partners')
    expect(guestKeys({ 'guests.plus_one_policy': 'case_by_case' })).toContain('review_plus_one_exceptions')
    expect(guestKeys({ 'guests.plus_one_policy': 'no_plus_ones' })).toContain('word_no_plus_one_invitations')
  })

  it('turns each children policy into one consistent implementation task', () => {
    expect(guestKeys({ 'guests.kids_policy': 'all_kids' })).toContain('count_children_and_plan_seating')
    expect(guestKeys({ 'guests.kids_policy': 'immediate_family_only' })).toContain('list_kid_exceptions_by_household')
    expect(guestKeys({ 'guests.kids_policy': 'age_cutoff' })).toContain('set_and_publish_age_cutoff')
    expect(guestKeys({ 'guests.kids_policy': 'adults_only' })).toContain('word_adults_only_consistently')
  })

  it('does not hand a digital-first couple a paper production checklist', () => {
    const paper = guestKeys({ 'guests.invitation_format': 'paper_suite' })
    const digital = guestKeys({ 'guests.invitation_format': 'digital_first' })
    const hybrid = guestKeys({ 'guests.invitation_format': 'hybrid' })
    expect(paper).toContain('order_invitations')
    expect(paper).not.toContain('choose_digital_invitation_platform')
    expect(digital).toContain('choose_digital_invitation_platform')
    expect(digital).not.toContain('order_invitations')
    expect(hybrid).toContain('order_invitations')
    expect(hybrid).toContain('build_digital_rsvp_flow')
  })
})

describe('wedding-party choices respect relationships, consent, and personal style', () => {
  const partyKeys = (answers: Record<string, string>) => tasksForQuest(
    resolveTree({ answers }),
    'wedding_party',
  ).map(task => task.taskKey)

  it('supports traditional sides, one shared circle, a small VIP group, or no formal party', () => {
    expect(partyKeys({ 'party.structure': 'traditional_sides' })).toContain('map_traditional_party_sides')
    expect(partyKeys({ 'party.structure': 'shared_circle' })).toContain('build_one_shared_circle')
    expect(partyKeys({ 'party.structure': 'small_vips' })).toContain('name_small_vip_circle')
    const none = partyKeys({ 'party.structure': 'no_formal_party' })
    expect(none).toContain('define_vip_roles_without_a_party')
    expect(none).not.toContain('ask_wedding_party')
    expect(none).not.toContain('order_party_attire')
  })

  it('never turns a celebratory title into unagreed labor', () => {
    const celebratory = partyKeys({ 'party.support_level': 'celebratory_only' })
    const active = partyKeys({ 'party.support_level': 'active_team' })
    expect(celebratory).toContain('tell_party_presence_is_enough')
    expect(celebratory).not.toContain('assign_day_of_jobs')
    expect(active).toContain('confirm_active_team_responsibilities')
    expect(active).toContain('assign_day_of_jobs')
  })

  it('only adds purchasing logistics to the matching-look branch', () => {
    const matching = partyKeys({ 'party.attire_direction': 'matching_look' })
    const palette = partyKeys({ 'party.attire_direction': 'palette_guided' })
    const existing = partyKeys({ 'party.attire_direction': 'wear_what_you_own' })
    const none = partyKeys({ 'party.attire_direction': 'no_group_attire' })
    expect(matching).toContain('order_party_attire')
    expect(palette).toContain('share_palette_and_fit_guardrails')
    expect(palette).not.toContain('order_party_attire')
    expect(existing).toContain('review_existing_outfits_for_comfort')
    expect(none).toContain('confirm_no_required_outfit_purchase')
    expect(none).not.toContain('set_party_attire_direction')
  })
})

describe('guest-experience choices add only the travel support guests need', () => {
  const travelKeys = (answers: Record<string, string>) => tasksForQuest(
    resolveTree({ answers }),
    'guest_experience',
  ).map(task => task.taskKey)

  it('does not create a hotel-block project for an almost entirely local guest list', () => {
    const local = travelKeys({ 'travel.guest_mix': 'mostly_local' })
    const domestic = travelKeys({ 'travel.guest_mix': 'domestic_travelers' })
    const international = travelKeys({ 'travel.guest_mix': 'international_travelers' })
    expect(local).toContain('confirm_lodging_help_not_needed')
    expect(local).not.toContain('block_hotel_rooms')
    expect(domestic).toContain('estimate_domestic_room_demand')
    expect(international).toContain('map_international_arrival_needs')
    expect(international).toContain('write_visa_invitation_letters')
    expect(domestic).not.toContain('write_visa_invitation_letters')
  })

  it('turns each mobility model into its real safety and access work', () => {
    expect(travelKeys({ 'travel.mobility_plan': 'walkable_transit' })).toContain('publish_walkable_route_and_accessibility')
    expect(travelKeys({ 'travel.mobility_plan': 'guest_self_transport' })).toContain('publish_parking_and_ride_details')
    const shuttle = travelKeys({ 'travel.mobility_plan': 'hosted_shuttles' })
    expect(shuttle).toContain('arrange_shuttles')
    expect(shuttle).toContain('set_shuttle_schedule_and_capacity')
    expect(travelKeys({ 'travel.mobility_plan': 'mixed_access' })).toContain('map_transport_by_guest_need')
  })

  it('distinguishes useful information, a drop-in, and a hosted event', () => {
    const guide = travelKeys({ 'travel.welcome_level': 'guide_only' })
    const casual = travelKeys({ 'travel.welcome_level': 'casual_gathering' })
    const hosted = travelKeys({ 'travel.welcome_level': 'hosted_event' })
    expect(guide).toContain('send_concise_arrival_guide')
    expect(guide).not.toContain('plan_welcome_party')
    expect(casual).toContain('plan_drop_in_welcome')
    expect(hosted).toContain('plan_welcome_party')
  })
})

describe('design choices expose the real floral and production workload', () => {
  const designKeys = (answers: Record<string, string>) => tasksForQuest(
    resolveTree({ answers }),
    'design_flowers',
  ).map(task => task.taskKey)

  it('distinguishes immersive, focal, and deliberately minimal design', () => {
    expect(designKeys({ 'design.scope': 'immersive' })).toContain('map_immersive_design_zones')
    expect(designKeys({ 'design.scope': 'focal_moments' })).toContain('choose_focal_design_moments')
    const minimal = designKeys({ 'design.scope': 'minimal' })
    expect(minimal).toContain('write_minimal_design_rules')
    expect(minimal).not.toContain('plan_lighting')
    expect(minimal).not.toContain('design_escort_display')
  })

  it('does not give a non-floral design a florist checklist', () => {
    const fresh = designKeys({ 'design.floral_approach': 'fresh_full_service' })
    const seasonal = designKeys({ 'design.floral_approach': 'seasonal_flexible' })
    const reusable = designKeys({ 'design.floral_approach': 'low_flower_reusable' })
    const nonFloral = designKeys({ 'design.floral_approach': 'non_floral' })
    expect(fresh).toContain('write_fresh_floral_brief')
    expect(seasonal).toContain('approve_seasonal_substitution_rules')
    expect(reusable).toContain('design_low_flower_reuse_plan')
    expect(nonFloral).toContain('design_non_floral_tablescape')
    expect(nonFloral).not.toContain('book_florist')
    expect(nonFloral).not.toContain('finalize_floral_list')
  })

  it('counts DIY as production work rather than free savings', () => {
    const serviced = designKeys({ 'design.production_owner': 'full_service_team' })
    const split = designKeys({ 'design.production_owner': 'split_vendor_diy' })
    const diy = designKeys({ 'design.production_owner': 'couple_diy' })
    expect(serviced).toContain('confirm_full_service_install_plan')
    expect(split).toContain('write_vendor_diy_responsibility_matrix')
    expect(split).toContain('pack_and_label_diy_decor')
    expect(diy).toContain('build_full_diy_setup_plan')
    expect(diy).toContain('recruit_diy_setup_and_strike_crew')
    expect(diy).toContain('mock_up_and_inventory_diy_decor')
  })
})

describe('ceremony choices preserve meaning, privacy, and clear guest boundaries', () => {
  const ceremonyKeys = (answers: Record<string, string>) => tasksForQuest(
    resolveTree({ answers }),
    'ceremony',
  ).map(task => task.taskKey)

  it('keeps a traditional, story-led, and blended ceremony distinct', () => {
    const traditional = ceremonyKeys({ 'ceremony.structure': 'traditional' })
    const personal = ceremonyKeys({ 'ceremony.structure': 'personal_story_led' })
    const blended = ceremonyKeys({ 'ceremony.structure': 'blended_traditions' })
    expect(traditional).toContain('confirm_traditional_ceremony_elements')
    expect(personal).toContain('interview_each_other_for_ceremony_story')
    expect(personal).not.toContain('plan_interfaith_blend')
    expect(blended).toContain('map_blended_ceremony_elements')
    expect(blended).toContain('plan_interfaith_blend')
    expect(blended).toContain('brief_both_officiants')
  })

  it('supports public, private, or guided vows without treating one as more sincere', () => {
    const publicVows = ceremonyKeys({ 'ceremony.vow_format': 'personal_in_ceremony' })
    const privateVows = ceremonyKeys({ 'ceremony.vow_format': 'private_before' })
    const guided = ceremonyKeys({ 'ceremony.vow_format': 'guided_or_standard' })
    expect(publicVows).toContain('share_public_vows_for_timing')
    expect(privateVows).toContain('plan_private_vow_exchange')
    expect(guided).toContain('select_guided_vow_language')
    expect(guided).not.toContain('write_vows')
  })

  it('turns guest-photo preferences into one precise boundary', () => {
    expect(ceremonyKeys({ 'ceremony.guest_photos': 'fully_unplugged' })).toContain('communicate_phone_free_ceremony')
    expect(ceremonyKeys({ 'ceremony.guest_photos': 'vows_unplugged' })).toContain('designate_vow_photo_boundary')
    const welcome = ceremonyKeys({ 'ceremony.guest_photos': 'photos_welcome' })
    expect(welcome).toContain('publish_respectful_guest_photo_rules')
    expect(welcome).not.toContain('decide_unplugged')
  })
})

describe('rings, registry, and honeymoon choices avoid inherited obligations', () => {
  const lifeKeys = (answers: Record<string, string>) => tasksForQuest(
    resolveTree({ answers }),
    'registry_rings_honeymoon',
  ).map(task => task.taskKey)

  it('distinguishes ready-made, custom, and heirloom rings', () => {
    expect(lifeKeys({ 'life.ring_plan': 'ready_made' })).toContain('confirm_ready_made_stock_and_sizing')
    expect(lifeKeys({ 'life.ring_plan': 'custom_made' })).toContain('approve_custom_ring_design')
    const heirloom = lifeKeys({ 'life.ring_plan': 'heirloom_existing' })
    expect(heirloom).toContain('assess_heirloom_resize_and_restoration')
    expect(heirloom).toContain('record_heirloom_ring_story')
    expect(heirloom).not.toContain('order_bands')
    expect(heirloom).not.toContain('set_ring_budget')
  })

  it('supports objects, funds, both, or a real no-gifts choice', () => {
    const objects = lifeKeys({ 'life.registry_style': 'objects' })
    const mixed = lifeKeys({ 'life.registry_style': 'objects_and_funds' })
    const funds = lifeKeys({ 'life.registry_style': 'funds_only' })
    const none = lifeKeys({ 'life.registry_style': 'no_registry' })
    expect(objects).toContain('audit_home_and_life_needs')
    expect(objects).not.toContain('add_cash_funds')
    expect(mixed).toContain('audit_home_and_life_needs')
    expect(mixed).toContain('write_specific_fund_descriptions')
    expect(funds).toContain('write_specific_fund_descriptions')
    expect(funds).not.toContain('add_range_of_price_points')
    expect(none).toContain('publish_no_gifts_message')
    expect(none).not.toContain('open_registry')
  })

  it('does not force an immediate honeymoon onto the wedding deadline', () => {
    expect(lifeKeys({ 'life.honeymoon_timing': 'immediate_trip' })).toContain('protect_post_wedding_departure_buffer')
    expect(lifeKeys({ 'life.honeymoon_timing': 'delayed_trip' })).toContain('set_delayed_trip_savings_timeline')
    expect(lifeKeys({ 'life.honeymoon_timing': 'mini_moon' })).toContain('plan_simple_mini_moon')
    const later = lifeKeys({ 'life.honeymoon_timing': 'later_undecided' })
    expect(later).toContain('park_honeymoon_without_pressure')
    expect(later).not.toContain('book_travel')
    expect(later).not.toContain('request_time_off')
  })
})

describe('legal workflow choices never replace authoritative rules', () => {
  const legalKeys = (answers: Record<string, string>) => tasksForQuest(
    resolveTree({ answers }),
    'legal',
  ).map(task => task.taskKey)

  it('routes special documents back to the issuing clerk', () => {
    expect(legalKeys({ 'legal.document_context': 'standard_documents' })).toContain('confirm_standard_document_set_with_clerk')
    expect(legalKeys({ 'legal.document_context': 'prior_marriage_records' })).toContain('collect_prior_marriage_records_for_clerk')
    const foreign = legalKeys({ 'legal.document_context': 'foreign_documents' })
    expect(foreign).toContain('confirm_foreign_document_acceptance_with_clerk')
    expect(foreign).toContain('translate_foreign_documents')
  })

  it('does not assume marriage requires either partner to change a name', () => {
    const keep = legalKeys({ 'legal.name_plan': 'keep_names' })
    const one = legalKeys({ 'legal.name_plan': 'one_partner_changes' })
    const both = legalKeys({ 'legal.name_plan': 'both_change_or_new_name' })
    expect(keep).toContain('confirm_no_name_change_workflow')
    expect(keep).not.toContain('change_name_social_security')
    expect(one).toContain('map_one_partner_name_change_accounts')
    expect(one).toContain('change_name_social_security')
    expect(both).toContain('map_both_partner_name_change_accounts')
  })

  it('adds immigration counsel work only when the couple identifies a context', () => {
    const none = legalKeys({ 'legal.immigration_context': 'none' })
    const k1 = legalKeys({ 'legal.immigration_context': 'k1_or_fiance_visa' })
    const other = legalKeys({ 'legal.immigration_context': 'other_status_or_unsure' })
    expect(none).not.toContain('consult_immigration_attorney')
    expect(k1).toContain('note_k1_ninety_day_window')
    expect(k1).toContain('consult_immigration_attorney')
    expect(other).toContain('prepare_questions_for_immigration_counsel')
    expect(other).not.toContain('note_k1_ninety_day_window')
  })
})

describe('pre-wedding event choices protect time, guests, and hosting energy', () => {
  const eventKeys = (answers: Record<string, string>) => tasksForQuest(
    resolveTree({ answers }),
    'pre_wedding_events',
  ).map(task => task.taskKey)

  it('supports no extra events, outside hosts, one joint gathering, or several events', () => {
    expect(eventKeys({ 'events.lead_up': 'none' })).toContain('protect_no_extra_events_boundary')
    expect(eventKeys({ 'events.lead_up': 'hosted_by_others' })).toContain('set_boundaries_for_events_others_host')
    const joint = eventKeys({ 'events.lead_up': 'one_joint_gathering' })
    expect(joint).toContain('plan_one_joint_pre_wedding_gathering')
    expect(joint).not.toContain('coordinate_showers')
    const several = eventKeys({ 'events.lead_up': 'several_events' })
    expect(several).toContain('map_event_calendar_and_guest_overlap')
    expect(several).toContain('plan_engagement_party')
  })

  it('does not assume a formal rehearsal dinner', () => {
    expect(eventKeys({ 'events.rehearsal_hospitality': 'formal_dinner' })).toContain('book_rehearsal_dinner')
    const casual = eventKeys({ 'events.rehearsal_hospitality': 'casual_meal' })
    expect(casual).toContain('plan_casual_post_rehearsal_meal')
    expect(casual).not.toContain('book_rehearsal_dinner')
    const only = eventKeys({ 'events.rehearsal_hospitality': 'rehearsal_only' })
    expect(only).toContain('communicate_rehearsal_only_plan')
    expect(only).not.toContain('decide_rehearsal_guest_list')
  })

  it('creates only the closing events the couple wants', () => {
    const none = eventKeys({ 'events.closing_events': 'none' })
    expect(none).toContain('protect_unstructured_post_wedding_time')
    expect(none).not.toContain('plan_after_party')
    expect(eventKeys({ 'events.closing_events': 'after_party' })).toContain('plan_after_party')
    expect(eventKeys({ 'events.closing_events': 'farewell_brunch' })).toContain('plan_farewell_brunch')
    const both = eventKeys({ 'events.closing_events': 'both' })
    expect(both).toContain('coordinate_two_closing_events_without_overlap')
    expect(both).toContain('plan_after_party')
    expect(both).toContain('plan_farewell_brunch')
  })
})

describe('final-month choices make the handoff, weather call, and closeout explicit', () => {
  const finaleKeys = (answers: Record<string, string>) => tasksForQuest(
    resolveTree({ answers }),
    'final_30_and_day_of',
  ).map(task => task.taskKey)

  it('supports professional, trusted-person, or tightly reduced couple-led coordination', () => {
    expect(finaleKeys({ 'finale.coordination_handoff': 'professional' })).toContain('confirm_professional_command_chain')
    expect(finaleKeys({ 'finale.coordination_handoff': 'trusted_person' })).toContain('brief_trusted_day_of_lead')
    const couple = finaleKeys({ 'finale.coordination_handoff': 'couple_led' })
    expect(couple).toContain('reduce_and_assign_couple_led_decisions')
    expect(couple).not.toContain('hand_off_to_point_person')
    expect(couple).not.toContain('assign_someone_to_hand_out_tips')
  })

  it('creates weather work only for the actual exposure model', () => {
    const indoor = finaleKeys({ 'finale.weather_exposure': 'indoors' })
    expect(indoor).toContain('confirm_indoor_access_and_climate')
    expect(indoor).not.toContain('confirm_weather_backup')
    const outdoor = finaleKeys({ 'finale.weather_exposure': 'outdoor_with_backup' })
    expect(outdoor).toContain('set_outdoor_weather_decision_deadline')
    expect(outdoor).toContain('confirm_weather_backup')
    expect(finaleKeys({ 'finale.weather_exposure': 'mixed_spaces' })).toContain('map_weather_plan_by_space')
  })

  it('makes the post-wedding workload visible before assigning it', () => {
    expect(finaleKeys({ 'finale.closeout_owner': 'delegated' })).toContain('confirm_delegated_closeout_manifest')
    expect(finaleKeys({ 'finale.closeout_owner': 'shared_with_helpers' })).toContain('split_closeout_shifts_with_helpers')
    expect(finaleKeys({ 'finale.closeout_owner': 'couple_managed' })).toContain('protect_couple_managed_closeout_buffer')
  })
})

// ─── The most important test in the suite (PRD.md §11) ────────────────────────

describe('a couple who answers nothing', () => {
  const tree = resolveTree({})

  it('still gets a complete plan', () => {
    expect(tree.quests.length).toBeGreaterThanOrEqual(13)
    expect(flattenTasks(tree).length).toBeGreaterThan(150)
  })

  it('gets a coherent plan, not a union of every branch', () => {
    const attire = tasksForQuest(tree, 'attire_beauty').map(t => t.taskKey)
    // Defaulting to off-the-rack must not also hand them the rental tasks.
    expect(attire).toContain('buy_the_gown_offrack')
    expect(attire).not.toContain('reserve_rental_gown')
    expect(attire).not.toContain('order_the_gown')
  })

  it('marks every answer as assumed, so the assistant can revisit it', () => {
    expect(tree.answers.length).toBeGreaterThan(0)
    expect(tree.answers.every(a => a.source === 'assumed')).toBe(true)
  })

  it('has a section for every quest it returns', () => {
    for (const quest of tree.quests) {
      expect(quest.sections.length).toBeGreaterThan(0)
      for (const { section } of quest.sections) {
        expect(section.tasks.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('answers', () => {
  it('records a real choice as decided and the rest as assumed', () => {
    const answers = resolveAnswers({ answers: { 'attire.dress_acquisition': 'rent' } })
    const dress = answers.find(a => a.key === 'attire.dress_acquisition')!
    expect(dress).toEqual({ key: 'attire.dress_acquisition', value: 'rent', source: 'decided' })
    expect(answers.filter(a => a.source === 'assumed').length).toBeGreaterThan(0)
  })

  it('falls back to the default when handed a value that is not an option', () => {
    // A stale client or a bad agent write must not poison the tree.
    const answers = resolveAnswers({ answers: { 'attire.dress_acquisition': 'borrow_from_mom' } })
    const dress = answers.find(a => a.key === 'attire.dress_acquisition')!
    expect(dress.value).toBe('buy_offrack')
    expect(dress.source).toBe('assumed')
  })

  it('includes questions from culture-pack quests', () => {
    const withPack = resolveAnswers({ cultures: ['chinese'] })
    const without = resolveAnswers({})
    expect(withPack.length).toBeGreaterThanOrEqual(without.length)
  })
})

// ─── Determinism ──────────────────────────────────────────────────────────────

describe('determinism', () => {
  const input: ResolverInput = {
    weddingType: 'traditional',
    cultures: ['chinese', 'jewish'],
    plannerType: 'none',
    guestCount: 180,
    state: 'WA',
    answers: { 'attire.dress_acquisition': 'buy_custom', 'food.service_style': 'buffet' },
  }

  it('is byte-identical across runs', () => {
    const a = JSON.stringify(flattenTasks(resolveTree(input)))
    const b = JSON.stringify(flattenTasks(resolveTree(input)))
    expect(a).toBe(b)
  })

  it('does not depend on the order answers arrive in', () => {
    const reversed: ResolverInput = {
      ...input,
      answers: {
        'food.service_style': 'buffet',
        'attire.dress_acquisition': 'buy_custom',
      },
    }
    expect(JSON.stringify(flattenTasks(resolveTree(input)))).toBe(
      JSON.stringify(flattenTasks(resolveTree(reversed))),
    )
  })
})

// ─── Existing pruning must keep working ───────────────────────────────────────

describe('wedding type and planner pruning still apply', () => {
  it('prunes an elopement down', () => {
    const elopement = resolveTree({ weddingType: 'elopement' })
    const traditional = resolveTree({ weddingType: 'traditional' })
    expect(elopement.quests.length).toBeLessThan(traditional.quests.length)
    expect(elopement.quests.map(q => q.template.key)).not.toContain('food_beverage')
  })

  it('grafts culture packs additively', () => {
    const base = resolveTree({})
    const chinese = resolveTree({ cultures: ['chinese'] })
    expect(chinese.quests.length).toBeGreaterThan(base.quests.length)
    expect(flattenTasks(chinese).length).toBeGreaterThan(flattenTasks(base).length)
  })

  it('drops self-coordination tasks for a couple with a full planner', () => {
    const solo = flattenTasks(resolveTree({ plannerType: 'none' })).length
    const planned = flattenTasks(resolveTree({ plannerType: 'full' })).length
    expect(planned).toBeLessThan(solo)
  })
})

// ─── Content integrity ────────────────────────────────────────────────────────

describe('authored content', () => {
  it('has no unparseable predicates, undeclared answer keys, or dead questions', () => {
    const problems = validateContent()
    if (problems.length) {
      console.error(problems.map(p => `  ${p.where}: ${p.problem}`).join('\n'))
    }
    expect(problems).toEqual([])
  })

  it('rejects missing and forward quest prerequisites', () => {
    const template = (
      key: string,
      order: number,
      prerequisites: string[],
    ): QuestTemplate => ({
      key,
      order,
      prerequisites,
      isOptional: false,
      estimatedDaysRange: [1, 1],
      sections: [],
    })

    const problems = validateQuestPrerequisites([
      template('foundation', 1, []),
      template('venue', 2, ['photographer']),
      template('photographer', 3, ['missing']),
    ])

    expect(problems.map(p => p.problem)).toEqual([
      'prerequisite photographer must have a lower order than venue',
      'unknown prerequisite: missing',
    ])
  })
})
