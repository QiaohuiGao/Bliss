import { strict as assert } from 'node:assert'
import { and, eq, inArray } from 'drizzle-orm'
import { AgentRuntime, type QuestScopingKey } from '../src/agent/runtime'
import { DatabaseDecisionCommitter } from '../src/agent/proposals/committer'
import type { AgentModel, AgentModelResult, ProposedTask } from '../src/agent/types'
import { db } from '../src/db'
import {
  decisionProposals,
  decisions,
  planningThreads,
  tasks,
  threadMessages,
  users,
  weddingMembers,
  weddings,
} from '../src/db/schema'
import { generateQuestsForWedding } from '../src/services/quest-generator'

interface ScriptChoice {
  questKey: QuestScopingKey
  questionKey: string
  choice: string
  reason: string
  taskEffects: ProposedTask[]
}

class QuestScopingSmokeModel implements AgentModel {
  readonly id = 'quest-scoping-smoke-v1'
  private step = 0

  constructor(
    private readonly evidence: { threadId: string; messageId: string; memberId: string },
    private readonly decision: ScriptChoice,
  ) {}

  async generate(): Promise<AgentModelResult> {
    this.step += 1
    if (this.step === 1) {
      return { toolCalls: [{ id: 'questions', name: 'get_scoping_questions', input: {} }] }
    }
    if (this.step === 2) {
      return {
        toolCalls: [{
          id: 'candidates',
          name: 'get_candidate_tasks',
          input: { questionKey: this.decision.questionKey, choice: this.decision.choice },
        }],
      }
    }
    return {
      text: 'This choice now reflects the way you want the celebration to feel.',
      toolCalls: [{
        id: 'proposal',
        name: 'propose_decision',
        input: {
          schemaVersion: 1,
          threadId: this.evidence.threadId,
          questKey: this.decision.questKey,
          questionKey: this.decision.questionKey,
          state: 'ready',
          summary: `The couple chose ${this.decision.choice} for a reason that is specific to them.`,
          proposedChoice: this.decision.choice,
          reason: this.decision.reason,
          alternativesConsidered: [],
          memberInputs: [{
            memberId: this.evidence.memberId,
            stance: this.decision.choice,
            reason: this.decision.reason,
            sourceMessageIds: [this.evidence.messageId],
          }],
          taskEffects: this.decision.taskEffects,
          memoryEffects: [],
          externalActions: [],
          vendorEffects: [],
          momentCandidate: null,
        },
      }],
    }
  }
}

let weddingId: string | null = null
let userId: string | null = null

async function decide(input: ScriptChoice & { message: string }) {
  let [thread] = await db.select({ id: planningThreads.id })
    .from(planningThreads)
    .where(and(
      eq(planningThreads.weddingId, weddingId!),
      eq(planningThreads.questKey, input.questKey),
      eq(planningThreads.questionKey, input.questionKey),
    ))
    .limit(1)
  if (!thread) {
    ;[thread] = await db.insert(planningThreads).values({
      weddingId: weddingId!,
      questKey: input.questKey,
      questionKey: input.questionKey,
      title: `Decide ${input.questionKey}`,
      openedBy: userId!,
    }).returning({ id: planningThreads.id })
  }
  const [message] = await db.insert(threadMessages).values({
    weddingId: weddingId!,
    threadId: thread!.id,
    authorType: 'user',
    authorUserId: userId!,
    content: input.message,
  }).returning({ id: threadMessages.id })
  const run = await new AgentRuntime(new QuestScopingSmokeModel({
    threadId: thread!.id,
    messageId: message!.id,
    memberId: userId!,
  }, input)).runQuestScopingDecision({
    weddingId: weddingId!,
    threadId: thread!.id,
    userId: userId!,
  }, input.questKey)
  assert.equal(run.stopReason, 'terminal_tool')
  const [proposal] = await db.select().from(decisionProposals).where(and(
    eq(decisionProposals.threadId, thread!.id),
    eq(decisionProposals.status, 'pending'),
  )).limit(1)
  assert.ok(proposal)
  return new DatabaseDecisionCommitter().confirm({
    proposalId: proposal.id,
    weddingId: weddingId!,
    userId: userId!,
    idempotencyKey: crypto.randomUUID(),
  })
}

try {
  const [user] = await db.insert(users).values({
    clerkId: `food-smoke-${crypto.randomUUID()}`,
    email: `food-smoke-${crypto.randomUUID()}@bliss.invalid`,
    displayName: 'Food Smoke Member',
  }).returning({ id: users.id })
  userId = user!.id
  const [wedding] = await db.insert(weddings).values({
    weddingDate: '2027-10-16',
    state: 'NY',
    city: 'Brooklyn',
    weddingType: 'traditional',
    cultures: [],
    plannerType: 'none',
  }).returning({ id: weddings.id })
  weddingId = wedding!.id
  await db.insert(weddingMembers).values({ weddingId, userId, role: 'owner' })
  await generateQuestsForWedding(weddingId, {
    weddingDate: '2027-10-16',
    state: 'NY',
    weddingType: 'traditional',
    cultures: [],
    plannerType: 'none',
    locale: 'en',
  })

  const buffet = await decide({
    questKey: 'food_beverage',
    questionKey: 'food.service_style',
    choice: 'buffet',
    reason: 'We want guests to choose their own portions and move around naturally.',
    message: 'We want a relaxed buffet where guests choose portions and keep mingling.',
    taskEffects: [{ taskKey: 'confirm_line_count_and_flow', rationale: 'Prevent a long buffet queue.' }],
  })
  const dryBar = await decide({
    questKey: 'food_beverage',
    questionKey: 'food.bar_package',
    choice: 'dry',
    reason: 'An alcohol-free celebration is important to both of us.',
    message: 'We both want an alcohol-free wedding with a thoughtful drinks menu.',
    taskEffects: [],
  })

  let branchTasks = await db.select({ templateKey: tasks.templateKey }).from(tasks).where(and(
    eq(tasks.weddingId, weddingId),
    inArray(tasks.templateKey, [
      'collect_meal_choices_with_rsvp',
      'confirm_line_count_and_flow',
      'confirm_bartender_ratio',
      'pick_signature_drinks',
    ]),
  ))
  assert.deepEqual(branchTasks, [{ templateKey: 'confirm_line_count_and_flow' }])

  const plated = await decide({
    questKey: 'food_beverage',
    questionKey: 'food.service_style',
    choice: 'plated',
    reason: 'We changed our minds because a formal seated dinner better fits the evening.',
    message: 'We changed our minds: a formal seated dinner now feels more like us.',
    taskEffects: [{
      taskKey: 'collect_meal_choices_with_rsvp',
      rationale: 'A plated meal requires each guest choice before stationery closes.',
    }],
  })
  const [platedDecision] = await db.select().from(decisions).where(
    eq(decisions.id, plated.decisionId),
  ).limit(1)
  branchTasks = await db.select({ templateKey: tasks.templateKey }).from(tasks).where(and(
    eq(tasks.weddingId, weddingId),
    inArray(tasks.templateKey, [
      'collect_meal_choices_with_rsvp',
      'confirm_line_count_and_flow',
      'confirm_bartender_ratio',
      'pick_signature_drinks',
    ]),
  ))
  assert.equal(platedDecision!.supersedesId, buffet.decisionId)
  assert.deepEqual(branchTasks, [{ templateKey: 'collect_meal_choices_with_rsvp' }])
  assert.notEqual(dryBar.decisionId, buffet.decisionId)

  await decide({
    questKey: 'venue_date',
    questionKey: 'venue.venue_style',
    choice: 'blank_canvas',
    reason: 'We want creative control and are willing to own the extra logistics.',
    message: 'We want a blank canvas and understand that it creates more production work.',
    taskEffects: [{
      taskKey: 'build_blank_canvas_cost_model',
      rationale: 'Compare the full production cost with serviced venues.',
    }],
  })
  await decide({
    questKey: 'venue_date',
    questionKey: 'venue.site_plan',
    choice: 'separate_sites',
    reason: 'The ceremony location is meaningful enough to justify the transfer.',
    message: 'The ceremony site matters to us, so we accept moving guests to the reception.',
    taskEffects: [{
      taskKey: 'measure_transfer_time_and_transport',
      rationale: 'Protect guests from an unrealistic transfer plan.',
    }],
  })
  const venueBranchTasks = await db.select({ templateKey: tasks.templateKey }).from(tasks).where(and(
    eq(tasks.weddingId, weddingId),
    inArray(tasks.templateKey, [
      'audit_full_service_inclusions',
      'build_blank_canvas_cost_model',
      'confirm_room_flip_and_guest_flow',
      'measure_transfer_time_and_transport',
    ]),
  ))
  assert.deepEqual(new Set(venueBranchTasks.map(task => task.templateKey)), new Set([
    'build_blank_canvas_cost_model',
    'measure_transfer_time_and_transport',
  ]))

  await decide({
    questKey: 'foundation',
    questionKey: 'foundation.funding_boundaries',
    choice: 'family_with_input',
    reason: 'We welcome input on the guest welcome, but contracts and total spending remain ours.',
    message: 'Family is contributing, and we want to agree exactly where their input begins and ends.',
    taskEffects: [{
      taskKey: 'write_family_input_boundaries',
      rationale: 'Make contribution expectations explicit before accepting money.',
    }],
  })
  await decide({
    questKey: 'foundation',
    questionKey: 'foundation.tradeoff_anchor',
    choice: 'meaning_tradition',
    reason: 'The rituals connecting both families are what make the wedding ours.',
    message: 'When tradeoffs get hard, protect the rituals that connect both of our families.',
    taskEffects: [{
      taskKey: 'define_meaning_tradition_anchor',
      rationale: 'Turn that priority into a criterion later decisions can reuse.',
    }],
  })
  const foundationBranchTasks = await db.select({ templateKey: tasks.templateKey }).from(tasks).where(and(
    eq(tasks.weddingId, weddingId),
    inArray(tasks.templateKey, [
      'clarify_family_contributions',
      'write_family_input_boundaries',
      'define_guest_experience_anchor',
      'define_meaning_tradition_anchor',
    ]),
  ))
  assert.deepEqual(new Set(foundationBranchTasks.map(task => task.templateKey)), new Set([
    'write_family_input_boundaries',
    'define_meaning_tradition_anchor',
  ]))

  await decide({
    questKey: 'guests_stationery',
    questionKey: 'guests.plus_one_policy',
    choice: 'no_plus_ones',
    reason: 'The venue limit only works when every invited seat is named.',
    message: 'Our venue limit means only named guests can be invited.',
    taskEffects: [{
      taskKey: 'word_no_plus_one_invitations',
      rationale: 'Make named-guest capacity and wording consistent.',
    }],
  })
  await decide({
    questKey: 'guests_stationery',
    questionKey: 'guests.kids_policy',
    choice: 'adults_only',
    reason: 'The late-night format and capacity make an adults-only celebration the honest choice.',
    message: 'We agree on an adults-only wedding and want to communicate it kindly.',
    taskEffects: [{
      taskKey: 'word_adults_only_consistently',
      rationale: 'Use one clear policy across invitations, RSVP, and website.',
    }],
  })
  await decide({
    questKey: 'guests_stationery',
    questionKey: 'guests.invitation_format',
    choice: 'digital_first',
    reason: 'Our guests are comfortable online and we value easy corrections over paper keepsakes.',
    message: 'We want digital invitations and RSVPs, with personal help for the few guests who need it.',
    // Intentionally preview only one effect. The deterministic core must still
    // materialize every required task in this authored branch.
    taskEffects: [{
      taskKey: 'choose_digital_invitation_platform',
      rationale: 'Choose the system that will hold invitation and RSVP data.',
    }],
  })
  const guestBranchTasks = await db.select({ templateKey: tasks.templateKey }).from(tasks).where(and(
    eq(tasks.weddingId, weddingId),
    inArray(tasks.templateKey, [
      'name_established_partners',
      'word_no_plus_one_invitations',
      'list_kid_exceptions_by_household',
      'word_adults_only_consistently',
      'design_invitation_suite',
      'order_invitations',
      'address_and_stuff',
      'mail_invitations',
      'build_digital_rsvp_flow',
      'choose_digital_invitation_platform',
      'test_digital_delivery_and_rsvp',
      'plan_offline_guest_backup',
    ]),
  ))
  assert.deepEqual(new Set(guestBranchTasks.map(task => task.templateKey)), new Set([
    'word_no_plus_one_invitations',
    'word_adults_only_consistently',
    'choose_digital_invitation_platform',
    'test_digital_delivery_and_rsvp',
    'plan_offline_guest_backup',
  ]))

  await decide({
    questKey: 'wedding_party',
    questionKey: 'party.structure',
    choice: 'small_vips',
    reason: 'We want only our closest people beside us, without creating ceremonial titles for a large group.',
    message: 'A tiny VIP circle feels intimate and honest for us.',
    taskEffects: [{
      taskKey: 'name_small_vip_circle',
      rationale: 'Name the few relationships the role should honor.',
    }],
  })
  await decide({
    questKey: 'wedding_party',
    questionKey: 'party.support_level',
    choice: 'celebratory_only',
    reason: 'We want our friends to feel loved, not recruited into unpaid planning work.',
    message: 'Their only job should be to celebrate with us.',
    taskEffects: [{
      taskKey: 'tell_party_presence_is_enough',
      rationale: 'Set the expectation before any asks expand.',
    }],
  })
  await decide({
    questKey: 'wedding_party',
    questionKey: 'party.attire_direction',
    choice: 'wear_what_you_own',
    reason: 'Comfort and avoiding unnecessary purchases matter more than a matched photograph.',
    message: 'We would rather everyone wear something they already feel good in.',
    // The exact stored proposal must include set_party_attire_direction too.
    taskEffects: [{
      taskKey: 'review_existing_outfits_for_comfort',
      rationale: 'Check weather, formality, and comfort without requiring a purchase.',
    }],
  })
  const weddingPartyBranchTasks = await db.select({ templateKey: tasks.templateKey }).from(tasks).where(and(
    eq(tasks.weddingId, weddingId),
    inArray(tasks.templateKey, [
      'choose_honor_attendants',
      'name_small_vip_circle',
      'assign_day_of_jobs',
      'name_a_point_person',
      'tell_party_presence_is_enough',
      'collect_party_sizes',
      'order_party_attire',
      'share_palette_and_fit_guardrails',
      'set_party_attire_direction',
      'review_existing_outfits_for_comfort',
    ]),
  ))
  assert.deepEqual(new Set(weddingPartyBranchTasks.map(task => task.templateKey)), new Set([
    'name_small_vip_circle',
    'tell_party_presence_is_enough',
    'set_party_attire_direction',
    'review_existing_outfits_for_comfort',
  ]))

  await decide({
    questKey: 'guest_experience',
    questionKey: 'travel.guest_mix',
    choice: 'mostly_local',
    reason: 'Nearly every household lives nearby, so a hotel block would create work without helping anyone.',
    message: 'Almost everyone is local; we only want to check whether a few people need lodging help.',
    taskEffects: [{
      taskKey: 'confirm_lodging_help_not_needed',
      rationale: 'Check the exceptions before removing the hotel-block project.',
    }],
  })
  await decide({
    questKey: 'guest_experience',
    questionKey: 'travel.mobility_plan',
    choice: 'hosted_shuttles',
    reason: 'The venue is not walkable and we do not want guests driving after the reception.',
    message: 'We want a shuttle so the last trip of the night is safe and simple.',
    taskEffects: [{
      taskKey: 'arrange_shuttles',
      rationale: 'Reserve transport before local availability tightens.',
    }],
  })
  await decide({
    questKey: 'guest_experience',
    questionKey: 'travel.welcome_level',
    choice: 'guide_only',
    reason: 'Guests need reliable information more than another scheduled event.',
    message: 'We want to welcome people with a really useful guide and leave their arrival night free.',
    taskEffects: [{
      taskKey: 'send_concise_arrival_guide',
      rationale: 'Put every arrival detail in one mobile-friendly place.',
    }],
  })
  await decide({
    questKey: 'guest_experience',
    questionKey: 'travel.guest_mix',
    choice: 'international_travelers',
    reason: 'Several close family members are crossing borders and need earlier, more personal travel support.',
    message: 'Some of our closest guests are flying internationally and may need visa letters and extra nights.',
    taskEffects: [{
      taskKey: 'map_international_arrival_needs',
      rationale: 'Map arrival and support needs household by household.',
    }],
  })
  const guestExperienceBranchTasks = await db.select({
    templateKey: tasks.templateKey,
    description: tasks.description,
  }).from(tasks).where(and(
    eq(tasks.weddingId, weddingId),
    inArray(tasks.templateKey, [
      'block_hotel_rooms',
      'estimate_domestic_room_demand',
      'confirm_lodging_help_not_needed',
      'map_international_arrival_needs',
      'send_early_stds_overseas',
      'write_visa_invitation_letters',
      'check_guest_passport_validity',
      'arrange_shuttles',
      'set_shuttle_schedule_and_capacity',
      'publish_parking_and_ride_details',
      'assemble_welcome_bags',
      'plan_drop_in_welcome',
      'plan_welcome_party',
      'send_concise_arrival_guide',
    ]),
  ))
  assert.deepEqual(new Set(guestExperienceBranchTasks.map(task => task.templateKey)), new Set([
    'block_hotel_rooms',
    'map_international_arrival_needs',
    'send_early_stds_overseas',
    'write_visa_invitation_letters',
    'check_guest_passport_validity',
    'arrange_shuttles',
    'set_shuttle_schedule_and_capacity',
    'send_concise_arrival_guide',
  ]))
  assert.match(
    guestExperienceBranchTasks.find(task => task.templateKey === 'map_international_arrival_needs')!.description!,
    /airports/i,
  )

  await decide({
    questKey: 'design_flowers',
    questionKey: 'design.scope',
    choice: 'minimal',
    reason: 'The venue architecture already carries the atmosphere, and we want the room to feel calm rather than filled.',
    message: 'We want a very intentional minimal look and do not need decorative lighting or a large escort display.',
    taskEffects: [{
      taskKey: 'write_minimal_design_rules',
      rationale: 'Protect intentional simplicity when new decor ideas appear.',
    }],
  })
  await decide({
    questKey: 'design_flowers',
    questionKey: 'design.floral_approach',
    choice: 'non_floral',
    reason: 'Lighting, linen, and the venue itself feel more like us than cut flowers.',
    message: 'We do not want a florist checklist; we want a non-floral tablescape.',
    taskEffects: [{
      taskKey: 'design_non_floral_tablescape',
      rationale: 'Build the atmosphere from the materials the couple actually values.',
    }],
  })
  await decide({
    questKey: 'design_flowers',
    questionKey: 'design.production_owner',
    choice: 'couple_diy',
    reason: 'We enjoy making the pieces and accept the labor, transport, and cleanup that come with that choice.',
    message: 'We are choosing mostly DIY, but we want the full workload visible now.',
    taskEffects: [{
      taskKey: 'build_full_diy_setup_plan',
      rationale: 'Test whether the DIY plan fits the access window and available people.',
    }],
  })
  const designBranchTasks = await db.select({ templateKey: tasks.templateKey }).from(tasks).where(and(
    eq(tasks.weddingId, weddingId),
    inArray(tasks.templateKey, [
      'choose_focal_design_moments',
      'write_minimal_design_rules',
      'plan_lighting',
      'design_escort_display',
      'book_florist',
      'approve_seasonal_substitution_rules',
      'design_non_floral_tablescape',
      'confirm_full_service_install_plan',
      'build_full_diy_setup_plan',
      'recruit_diy_setup_and_strike_crew',
      'mock_up_and_inventory_diy_decor',
    ]),
  ))
  assert.deepEqual(new Set(designBranchTasks.map(task => task.templateKey)), new Set([
    'write_minimal_design_rules',
    'design_non_floral_tablescape',
    'build_full_diy_setup_plan',
    'recruit_diy_setup_and_strike_crew',
    'mock_up_and_inventory_diy_decor',
  ]))

  await decide({
    questKey: 'ceremony',
    questionKey: 'ceremony.structure',
    choice: 'blended_traditions',
    reason: 'Both traditions connect us to family, and we want their meanings to meet rather than appear as separate inserts.',
    message: 'We want one coherent ceremony that carefully blends both of our traditions.',
    taskEffects: [{
      taskKey: 'map_blended_ceremony_elements',
      rationale: 'Map meaning and order before drafting the script.',
    }],
  })
  await decide({
    questKey: 'ceremony',
    questionKey: 'ceremony.vow_format',
    choice: 'private_before',
    reason: 'We will be more present and honest with our most personal promises in private.',
    message: 'We want to exchange personal vows privately before the ceremony.',
    taskEffects: [{
      taskKey: 'plan_private_vow_exchange',
      rationale: 'Protect the privacy, timing, and simple public promise.',
    }],
  })
  await decide({
    questKey: 'ceremony',
    questionKey: 'ceremony.guest_photos',
    choice: 'photos_welcome',
    reason: 'Guest photos feel joyful to us as long as aisles and private moments stay protected.',
    message: 'Guests can take photos; we just want respectful boundaries.',
    taskEffects: [{
      taskKey: 'publish_respectful_guest_photo_rules',
      rationale: 'State the few boundaries clearly instead of banning phones.',
    }],
  })
  const ceremonyBranchTasks = await db.select({ templateKey: tasks.templateKey }).from(tasks).where(and(
    eq(tasks.weddingId, weddingId),
    inArray(tasks.templateKey, [
      'interview_each_other_for_ceremony_story',
      'map_blended_ceremony_elements',
      'choose_unity_ritual',
      'plan_interfaith_blend',
      'brief_both_officiants',
      'write_vows',
      'share_public_vows_for_timing',
      'plan_private_vow_exchange',
      'decide_unplugged',
      'designate_vow_photo_boundary',
      'publish_respectful_guest_photo_rules',
    ]),
  ))
  assert.deepEqual(new Set(ceremonyBranchTasks.map(task => task.templateKey)), new Set([
    'map_blended_ceremony_elements',
    'choose_unity_ritual',
    'plan_interfaith_blend',
    'brief_both_officiants',
    'write_vows',
    'plan_private_vow_exchange',
    'publish_respectful_guest_photo_rules',
  ]))

  await decide({
    questKey: 'registry_rings_honeymoon',
    questionKey: 'life.ring_plan',
    choice: 'heirloom_existing',
    reason: 'The rings already carry the family story we want to continue, so restoration matters more than shopping.',
    message: 'We are using heirloom rings and want to preserve both their condition and their story.',
    taskEffects: [{
      taskKey: 'assess_heirloom_resize_and_restoration',
      rationale: 'Check what can safely change before altering the rings.',
    }],
  })
  await decide({
    questKey: 'registry_rings_honeymoon',
    questionKey: 'life.registry_style',
    choice: 'no_registry',
    reason: 'We have what we need and want guests to feel no pressure to give us anything.',
    message: 'We truly want no gifts, not a hidden cash alternative.',
    taskEffects: [{
      taskKey: 'publish_no_gifts_message',
      rationale: 'Give guests and family one clear, consistent message.',
    }],
  })
  await decide({
    questKey: 'registry_rings_honeymoon',
    questionKey: 'life.honeymoon_timing',
    choice: 'later_undecided',
    reason: 'We want to protect our energy and finances instead of attaching another deadline to the wedding.',
    message: 'We are choosing not to plan a honeymoon right now and want to revisit it later without pressure.',
    taskEffects: [{
      taskKey: 'park_honeymoon_without_pressure',
      rationale: 'Record one calm revisit point and remove the current travel project.',
    }],
  })
  const lifeBranchTasks = await db.select({ templateKey: tasks.templateKey }).from(tasks).where(and(
    eq(tasks.weddingId, weddingId),
    inArray(tasks.templateKey, [
      'set_ring_budget',
      'try_on_bands',
      'order_bands',
      'confirm_ready_made_stock_and_sizing',
      'assess_heirloom_resize_and_restoration',
      'record_heirloom_ring_story',
      'open_registry',
      'add_range_of_price_points',
      'add_cash_funds',
      'audit_home_and_life_needs',
      'write_specific_fund_descriptions',
      'publish_no_gifts_message',
      'choose_destination',
      'request_time_off',
      'book_travel',
      'set_delayed_trip_savings_timeline',
      'park_honeymoon_without_pressure',
    ]),
  ))
  assert.deepEqual(new Set(lifeBranchTasks.map(task => task.templateKey)), new Set([
    'assess_heirloom_resize_and_restoration',
    'record_heirloom_ring_story',
    'publish_no_gifts_message',
    'park_honeymoon_without_pressure',
  ]))

  await decide({
    questKey: 'legal',
    questionKey: 'legal.document_context',
    choice: 'foreign_documents',
    reason: 'One document was issued abroad, so we need the issuing clerk to confirm acceptance before paying for translation.',
    message: 'We have a foreign-issued document and want to verify the exact clerk requirements first.',
    taskEffects: [{
      taskKey: 'confirm_foreign_document_acceptance_with_clerk',
      rationale: 'Keep the issuing clerk as the authority for the document path.',
    }],
  })
  await decide({
    questKey: 'legal',
    questionKey: 'legal.name_plan',
    choice: 'keep_names',
    reason: 'Neither of us wants to change a legal name after marriage.',
    message: 'We are both keeping our legal names.',
    taskEffects: [{
      taskKey: 'confirm_no_name_change_workflow',
      rationale: 'Remove the assumed agency and account update sequence.',
    }],
  })
  await decide({
    questKey: 'legal',
    questionKey: 'legal.immigration_context',
    choice: 'other_status_or_unsure',
    reason: 'There may be an immigration consequence, so only qualified counsel should answer it.',
    message: 'An immigration status may be relevant; we want to prepare for counsel without storing case identifiers here.',
    taskEffects: [{
      taskKey: 'prepare_questions_for_immigration_counsel',
      rationale: 'Organize a dated fact pattern without giving legal advice.',
    }],
  })
  const legalBranchTasks = await db.select({ templateKey: tasks.templateKey }).from(tasks).where(and(
    eq(tasks.weddingId, weddingId),
    inArray(tasks.templateKey, [
      'confirm_standard_document_set_with_clerk',
      'translate_foreign_documents',
      'confirm_foreign_document_acceptance_with_clerk',
      'change_name_social_security',
      'change_name_drivers_license',
      'change_name_passport',
      'change_name_banks_and_work',
      'confirm_no_name_change_workflow',
      'note_k1_ninety_day_window',
      'consult_immigration_attorney',
      'prepare_questions_for_immigration_counsel',
    ]),
  ))
  assert.deepEqual(new Set(legalBranchTasks.map(task => task.templateKey)), new Set([
    'translate_foreign_documents',
    'confirm_foreign_document_acceptance_with_clerk',
    'confirm_no_name_change_workflow',
    'consult_immigration_attorney',
    'prepare_questions_for_immigration_counsel',
  ]))

  await decide({
    questKey: 'pre_wedding_events',
    questionKey: 'events.lead_up',
    choice: 'none',
    reason: 'More events would add obligation and travel without adding the kind of joy we want.',
    message: 'We are saying no to additional pre-wedding parties.',
    taskEffects: [{ taskKey: 'protect_no_extra_events_boundary', rationale: 'Give family and friends one warm boundary.' }],
  })
  await decide({
    questKey: 'pre_wedding_events',
    questionKey: 'events.rehearsal_hospitality',
    choice: 'rehearsal_only',
    reason: 'We want the rehearsal to solve logistics and let everyone choose their own evening afterward.',
    message: 'We are rehearsing without hosting a dinner afterward.',
    taskEffects: [{ taskKey: 'communicate_rehearsal_only_plan', rationale: 'Prevent an unspoken dinner expectation.' }],
  })
  await decide({
    questKey: 'pre_wedding_events',
    questionKey: 'events.closing_events',
    choice: 'none',
    reason: 'Sleep and unstructured goodbyes matter more to us than another hosted event.',
    message: 'No after-party or farewell brunch; we want the weekend to end naturally.',
    taskEffects: [{ taskKey: 'protect_unstructured_post_wedding_time', rationale: 'Remove both closing-event projects.' }],
  })
  const eventBranchTasks = await db.select({ templateKey: tasks.templateKey }).from(tasks).where(and(
    eq(tasks.weddingId, weddingId),
    inArray(tasks.templateKey, [
      'coordinate_showers', 'coordinate_bachelor_parties', 'protect_no_extra_events_boundary',
      'book_rehearsal_dinner', 'plan_casual_post_rehearsal_meal', 'communicate_rehearsal_only_plan',
      'plan_after_party', 'plan_farewell_brunch', 'protect_unstructured_post_wedding_time',
    ]),
  ))
  assert.deepEqual(new Set(eventBranchTasks.map(task => task.templateKey)), new Set([
    'protect_no_extra_events_boundary',
    'communicate_rehearsal_only_plan',
    'protect_unstructured_post_wedding_time',
  ]))

  await decide({
    questKey: 'final_30_and_day_of',
    questionKey: 'finale.coordination_handoff',
    choice: 'couple_led',
    reason: 'We are keeping coordination ourselves, so we need to eliminate rather than hide remaining decisions.',
    message: 'We are couple-led, but want an honest reduced decision plan instead of a fake handoff.',
    taskEffects: [{ taskKey: 'reduce_and_assign_couple_led_decisions', rationale: 'Pre-decide, split, or remove every remaining interruption.' }],
  })
  await decide({
    questKey: 'final_30_and_day_of',
    questionKey: 'finale.weather_exposure',
    choice: 'indoors',
    reason: 'Every guest-facing part is indoors, so access and climate matter but a rain-flip plan does not.',
    message: 'The whole event is indoors; remove the generic weather-backup project.',
    taskEffects: [{ taskKey: 'confirm_indoor_access_and_climate', rationale: 'Verify the indoor operational risks that actually remain.' }],
  })
  await decide({
    questKey: 'final_30_and_day_of',
    questionKey: 'finale.closeout_owner',
    choice: 'delegated',
    reason: 'We want the celebration to end with a real handoff instead of becoming the cleanup crew.',
    message: 'Our coordinator will own closeout; we need one exact manifest.',
    taskEffects: [{ taskKey: 'confirm_delegated_closeout_manifest', rationale: 'Make the final transfer auditable and complete.' }],
  })
  const finaleBranchTasks = await db.select({ templateKey: tasks.templateKey }).from(tasks).where(and(
    eq(tasks.weddingId, weddingId),
    inArray(tasks.templateKey, [
      'brief_trusted_day_of_lead', 'reduce_and_assign_couple_led_decisions',
      'assign_someone_to_hand_out_tips', 'hand_off_to_point_person',
      'confirm_weather_backup', 'map_weather_plan_by_space', 'confirm_indoor_access_and_climate',
      'split_closeout_shifts_with_helpers', 'confirm_delegated_closeout_manifest',
    ]),
  ))
  assert.deepEqual(new Set(finaleBranchTasks.map(task => task.templateKey)), new Set([
    'reduce_and_assign_couple_led_decisions',
    'confirm_indoor_access_and_climate',
    'confirm_delegated_closeout_manifest',
  ]))

  console.log('PASS: generic quest scoping database smoke test')
  console.log('  sequential decisions preserve unrelated confirmed answers')
  console.log('  zero-task choice prunes the obsolete default branch')
  console.log('  changed choice creates a supersession edge and replaces only its branch')
  console.log('  Venue and Date reuses the same engine without leaking default branch tasks')
  console.log('  Foundation keeps funding boundaries and shared decision criteria distinct')
  console.log('  Guest policy replaces defaults and deterministic completion fills the full digital branch')
  console.log('  Wedding Party choices preserve consent and remove unwanted purchase logistics')
  console.log('  Guest Experience creates and removes conditional sections across decision revisions')
  console.log('  Design choices replace florist assumptions and count the full DIY workload')
  console.log('  Ceremony choices preserve blended meaning, private vows, and precise photo boundaries')
  console.log('  Rings, registry, and honeymoon choices remove inherited purchase and travel obligations')
  console.log('  Legal choices organize verification while preserving clerk and counsel authority')
  console.log('  Pre-Wedding Events remove inherited celebrations and protect unstructured time')
  console.log('  Final 30 Days makes couple-led coordination, indoor risk, and delegated closeout exact')
} finally {
  if (weddingId) await db.delete(weddings).where(eq(weddings.id, weddingId))
  if (userId) await db.delete(users).where(eq(users.id, userId))
}

process.exit(0)
