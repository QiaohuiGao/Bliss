import type { Culture } from '@bliss/types'
import type { QuestTemplate, SectionTemplate } from './quest-templates'

/**
 * Cultural traditions are **additive packs**, not a fork of the base tree. A
 * couple selects one or more heritages and the generator merges the pack's
 * sections into the matching base quests, plus any standalone quests.
 *
 * Culture is independent of locale: a Chinese-American couple may want an
 * English UI with the Chinese tradition pack.
 *
 * Key namespace is separate from the base tree:
 *   culture.<culture>.quest.<questKey>.title | .subtitle | .celebration
 *   culture.<culture>.section.<sectionKey>
 *   culture.<culture>.task.<taskKey>.title | .description
 */

export interface CultureSectionGraft {
  /** Base quest this section is appended to. */
  questKey: string
  section: SectionTemplate
}

export interface CulturePack {
  culture: Culture
  /** Sections merged into existing base quests. */
  grafts: CultureSectionGraft[]
  /** Whole quests added to the tree, ordered after the base quests. */
  quests: QuestTemplate[]
}

export const culturePackI18nKey = (culture: Culture, suffix: string) =>
  `culture.${culture}.${suffix}`

export const CULTURE_PACKS: CulturePack[] = [
  // ── South Asian ───────────────────────────────────────────────────────────
  // Multi-day, often 2-4 events and 300-500 guests. The scale change is the
  // point: this is not one wedding with extra decorations.
  {
    culture: 'south_asian',
    grafts: [
      {
        questKey: 'vendor_team',
        section: {
          key: 'south_asian_vendors',
          isOptional: false,
          tasks: [
            { key: 'book_south_asian_caterer', isOptional: false, leadTimeDays: 240, costCategory: 'venue_catering' },
            { key: 'book_dhol_player', isOptional: true, costCategory: 'music_entertainment' },
            { key: 'book_pandit_or_imam', isOptional: false, leadTimeDays: 180 },
            { key: 'book_mandap_decorator', isOptional: false, leadTimeDays: 150, costCategory: 'flowers_decor' },
          ],
        },
      },
      {
        questKey: 'attire_beauty',
        section: {
          key: 'south_asian_attire',
          isOptional: false,
          tasks: [
            { key: 'order_lehenga_or_sari', isOptional: false, leadTimeDays: 180, costCategory: 'attire_beauty' },
            { key: 'order_sherwani', isOptional: false, leadTimeDays: 120, costCategory: 'attire_beauty' },
            { key: 'plan_outfit_per_event', isOptional: false },
            { key: 'source_wedding_jewelry', isOptional: false, costCategory: 'attire_beauty' },
          ],
        },
      },
      {
        questKey: 'guests_stationery',
        section: {
          key: 'south_asian_guests',
          isOptional: false,
          tasks: [
            { key: 'explain_multiday_schedule', isOptional: false },
            { key: 'give_guest_attire_guidance', isOptional: false },
          ],
        },
      },
    ],
    quests: [
      {
        key: 'south_asian_events',
        order: 101,
        isOptional: false,
        estimatedDaysRange: [21, 60],
        prerequisites: ['venue_date'],
        culture: 'south_asian',
        sections: [
          {
            key: 'mehndi',
            isOptional: false,
            tasks: [
              { key: 'book_mehndi_venue', isOptional: false, leadTimeDays: 120 },
              { key: 'book_mehndi_artist', isOptional: false, leadTimeDays: 90 },
              { key: 'plan_mehndi_decor', isOptional: true, costCategory: 'flowers_decor' },
            ],
          },
          {
            key: 'sangeet',
            isOptional: false,
            tasks: [
              { key: 'book_sangeet_venue', isOptional: false, leadTimeDays: 150 },
              { key: 'organize_sangeet_performances', isOptional: false },
              { key: 'schedule_dance_rehearsals', isOptional: true },
            ],
          },
          {
            key: 'haldi',
            isOptional: true,
            tasks: [
              { key: 'plan_haldi', isOptional: true },
              { key: 'buy_haldi_clothes', isOptional: true },
            ],
          },
          {
            key: 'baraat',
            isOptional: true,
            tasks: [
              { key: 'plan_baraat_route', isOptional: true },
              { key: 'arrange_baraat_transport', isOptional: true, costCategory: 'transportation' },
              { key: 'confirm_venue_allows_baraat', isOptional: true },
            ],
          },
          {
            key: 'ceremony_rituals',
            isOptional: false,
            tasks: [
              { key: 'plan_mandap_setup', isOptional: false },
              { key: 'plan_jaimala', isOptional: true },
              { key: 'plan_saptapadi', isOptional: false },
              { key: 'plan_vidaai', isOptional: true },
            ],
          },
        ],
      },
    ],
  },

  // ── Chinese ───────────────────────────────────────────────────────────────
  {
    culture: 'chinese',
    grafts: [
      {
        questKey: 'vendor_team',
        section: {
          key: 'chinese_vendors',
          isOptional: false,
          tasks: [
            { key: 'book_bilingual_mc', isOptional: false, leadTimeDays: 120 },
            { key: 'find_venue_with_chinese_kitchen', isOptional: false, costCategory: 'venue_catering' },
          ],
        },
      },
      {
        questKey: 'attire_beauty',
        section: {
          key: 'chinese_attire',
          isOptional: false,
          tasks: [
            { key: 'order_qipao', isOptional: false, leadTimeDays: 90, costCategory: 'attire_beauty' },
            { key: 'plan_outfit_changes', isOptional: false },
          ],
        },
      },
      {
        questKey: 'food_beverage',
        section: {
          key: 'chinese_banquet',
          isOptional: false,
          tasks: [
            { key: 'plan_banquet_courses', isOptional: false, costCategory: 'venue_catering' },
            { key: 'decide_roast_pig', isOptional: true, costCategory: 'venue_catering' },
            { key: 'plan_table_toasting_route', isOptional: false },
          ],
        },
      },
      {
        questKey: 'design_flowers',
        section: {
          key: 'chinese_decor',
          isOptional: true,
          tasks: [{ key: 'source_double_happiness_decor', isOptional: true, costCategory: 'flowers_decor' }],
        },
      },
    ],
    quests: [
      {
        key: 'chinese_traditions',
        order: 102,
        isOptional: false,
        estimatedDaysRange: [14, 40],
        prerequisites: ['venue_date'],
        culture: 'chinese',
        sections: [
          {
            key: 'tea_ceremony',
            isOptional: false,
            tasks: [
              { key: 'plan_tea_ceremony', isOptional: false },
              { key: 'confirm_elder_order', isOptional: false },
              { key: 'buy_tea_set', isOptional: false },
              { key: 'prepare_red_envelopes', isOptional: false, costCategory: 'favors_gifts' },
            ],
          },
          {
            key: 'door_games',
            isOptional: true,
            tasks: [
              { key: 'plan_door_games', isOptional: true },
              { key: 'brief_bridesmaids_on_games', isOptional: true },
            ],
          },
          {
            key: 'family_etiquette',
            isOptional: false,
            tasks: [
              { key: 'plan_hair_combing', isOptional: true },
              { key: 'coordinate_betrothal_gifts', isOptional: false },
              { key: 'check_lucky_date_preferences', isOptional: true },
            ],
          },
        ],
      },
    ],
  },

  // ── Jewish ────────────────────────────────────────────────────────────────
  {
    culture: 'jewish',
    grafts: [
      {
        questKey: 'venue_date',
        section: {
          key: 'jewish_date_rules',
          isOptional: false,
          tasks: [
            { key: 'avoid_shabbat_and_holidays', isOptional: false },
            { key: 'confirm_rabbi_availability', isOptional: false, leadTimeDays: 180 },
          ],
        },
      },
      {
        questKey: 'food_beverage',
        section: {
          key: 'jewish_catering',
          isOptional: false,
          tasks: [
            { key: 'decide_kosher_level', isOptional: false, costCategory: 'venue_catering' },
            { key: 'book_kosher_caterer', isOptional: false, leadTimeDays: 210, costCategory: 'venue_catering' },
          ],
        },
      },
      {
        questKey: 'vendor_team',
        section: {
          key: 'jewish_vendors',
          isOptional: false,
          tasks: [
            { key: 'book_rabbi_or_cantor', isOptional: false, leadTimeDays: 210 },
            { key: 'commission_ketubah', isOptional: false, leadTimeDays: 90 },
            { key: 'book_klezmer_or_hora_band', isOptional: true, costCategory: 'music_entertainment' },
          ],
        },
      },
    ],
    quests: [
      {
        key: 'jewish_traditions',
        order: 103,
        isOptional: false,
        estimatedDaysRange: [14, 35],
        prerequisites: ['ceremony'],
        culture: 'jewish',
        sections: [
          {
            key: 'before_ceremony',
            isOptional: true,
            tasks: [
              { key: 'plan_aufruf', isOptional: true },
              { key: 'plan_bedeken', isOptional: true },
            ],
          },
          {
            key: 'under_the_chuppah',
            isOptional: false,
            tasks: [
              { key: 'arrange_chuppah', isOptional: false, costCategory: 'flowers_decor' },
              { key: 'choose_chuppah_holders', isOptional: false },
              { key: 'sign_ketubah', isOptional: false },
              { key: 'choose_ketubah_witnesses', isOptional: false },
              { key: 'plan_circling', isOptional: true },
              { key: 'arrange_sheva_brachot_readers', isOptional: false },
              { key: 'prepare_glass_to_break', isOptional: false },
            ],
          },
          {
            key: 'after_ceremony',
            isOptional: true,
            tasks: [
              { key: 'plan_yichud', isOptional: true },
              { key: 'plan_hora_and_chairs', isOptional: true },
            ],
          },
        ],
      },
    ],
  },

  // ── Korean ────────────────────────────────────────────────────────────────
  {
    culture: 'korean',
    grafts: [
      {
        questKey: 'attire_beauty',
        section: {
          key: 'korean_attire',
          isOptional: false,
          tasks: [
            { key: 'rent_hanbok', isOptional: false, leadTimeDays: 60, costCategory: 'attire_beauty' },
            { key: 'book_hanbok_dresser', isOptional: false },
          ],
        },
      },
      {
        questKey: 'venue_date',
        section: {
          key: 'korean_venue',
          isOptional: false,
          tasks: [{ key: 'confirm_paebaek_room', isOptional: false }],
        },
      },
    ],
    quests: [
      {
        key: 'korean_traditions',
        order: 104,
        isOptional: false,
        estimatedDaysRange: [10, 25],
        prerequisites: ['ceremony'],
        culture: 'korean',
        sections: [
          {
            key: 'paebaek',
            isOptional: false,
            tasks: [
              { key: 'plan_paebaek', isOptional: false },
              { key: 'prepare_ceremonial_table', isOptional: false },
              { key: 'practice_family_bows', isOptional: true },
              { key: 'arrange_jujubes_and_chestnuts', isOptional: true },
            ],
          },
        ],
      },
    ],
  },

  // ── Nigerian / West African ───────────────────────────────────────────────
  // Two weddings, traditional and white. Aso-ebi fabric must be sourced months out.
  {
    culture: 'nigerian',
    grafts: [
      {
        questKey: 'attire_beauty',
        section: {
          key: 'nigerian_attire',
          isOptional: false,
          tasks: [
            { key: 'source_aso_ebi_fabric', isOptional: false, leadTimeDays: 150, costCategory: 'attire_beauty' },
            { key: 'distribute_aso_ebi', isOptional: false, leadTimeDays: 90 },
            { key: 'book_gele_tier', isOptional: false },
          ],
        },
      },
      {
        questKey: 'vendor_team',
        section: {
          key: 'nigerian_vendors',
          isOptional: false,
          tasks: [
            { key: 'book_alaga_or_mc', isOptional: false, leadTimeDays: 150 },
            { key: 'book_afrobeat_band', isOptional: true, costCategory: 'music_entertainment' },
          ],
        },
      },
    ],
    quests: [
      {
        key: 'nigerian_traditions',
        order: 105,
        isOptional: false,
        estimatedDaysRange: [21, 50],
        prerequisites: ['venue_date'],
        culture: 'nigerian',
        sections: [
          {
            key: 'traditional_wedding',
            isOptional: false,
            tasks: [
              { key: 'plan_traditional_engagement', isOptional: false, leadTimeDays: 120 },
              { key: 'agree_family_list_items', isOptional: false },
              { key: 'book_traditional_venue', isOptional: false, leadTimeDays: 150 },
            ],
          },
          {
            key: 'reception_customs',
            isOptional: true,
            tasks: [
              { key: 'plan_money_spray', isOptional: true },
              { key: 'arrange_small_bills', isOptional: true },
            ],
          },
        ],
      },
    ],
  },

  // ── Mexican / Latin American ──────────────────────────────────────────────
  {
    culture: 'mexican',
    grafts: [
      {
        questKey: 'foundation',
        section: {
          key: 'mexican_padrinos',
          isOptional: false,
          tasks: [
            { key: 'choose_padrinos', isOptional: false },
            { key: 'assign_padrino_sponsorships', isOptional: false },
          ],
        },
      },
      {
        questKey: 'vendor_team',
        section: {
          key: 'mexican_vendors',
          isOptional: true,
          tasks: [{ key: 'book_mariachi', isOptional: true, leadTimeDays: 120, costCategory: 'music_entertainment' }],
        },
      },
      {
        questKey: 'ceremony',
        section: {
          key: 'mexican_ceremony',
          isOptional: false,
          tasks: [
            { key: 'complete_pre_cana', isOptional: true, leadTimeDays: 120 },
            { key: 'arrange_lazo', isOptional: false },
            { key: 'arrange_arras', isOptional: false },
          ],
        },
      },
      {
        questKey: 'food_beverage',
        section: {
          key: 'mexican_reception',
          isOptional: true,
          tasks: [
            { key: 'plan_late_night_second_meal', isOptional: true, costCategory: 'venue_catering' },
            { key: 'plan_hora_loca', isOptional: true, costCategory: 'music_entertainment' },
            { key: 'plan_vals_and_dollar_dance', isOptional: true },
          ],
        },
      },
    ],
    quests: [],
  },

  // ── Persian / Iranian ─────────────────────────────────────────────────────
  {
    culture: 'persian',
    grafts: [
      {
        questKey: 'vendor_team',
        section: {
          key: 'persian_vendors',
          isOptional: false,
          tasks: [
            { key: 'book_sofreh_designer', isOptional: false, leadTimeDays: 120, costCategory: 'flowers_decor' },
            { key: 'book_aghd_officiant', isOptional: false, leadTimeDays: 150 },
          ],
        },
      },
      {
        questKey: 'food_beverage',
        section: {
          key: 'persian_timing',
          isOptional: false,
          tasks: [{ key: 'plan_late_dinner_service', isOptional: false }],
        },
      },
    ],
    quests: [
      {
        key: 'persian_traditions',
        order: 106,
        isOptional: false,
        estimatedDaysRange: [14, 30],
        prerequisites: ['ceremony'],
        culture: 'persian',
        sections: [
          {
            key: 'sofreh_aghd',
            isOptional: false,
            tasks: [
              { key: 'design_sofreh_aghd', isOptional: false },
              { key: 'gather_sofreh_elements', isOptional: false },
              { key: 'choose_honored_couple_for_cloth', isOptional: true },
              { key: 'plan_honey_ritual', isOptional: true },
              { key: 'plan_knife_dance', isOptional: true },
            ],
          },
        ],
      },
    ],
  },

  // ── Vietnamese ────────────────────────────────────────────────────────────
  {
    culture: 'vietnamese',
    grafts: [
      {
        questKey: 'attire_beauty',
        section: {
          key: 'vietnamese_attire',
          isOptional: false,
          tasks: [{ key: 'order_ao_dai', isOptional: false, leadTimeDays: 90, costCategory: 'attire_beauty' }],
        },
      },
    ],
    quests: [
      {
        key: 'vietnamese_traditions',
        order: 107,
        isOptional: false,
        estimatedDaysRange: [10, 25],
        prerequisites: ['ceremony'],
        culture: 'vietnamese',
        sections: [
          {
            key: 'le_gia_tien',
            isOptional: false,
            tasks: [
              { key: 'plan_ancestral_altar', isOptional: false },
              { key: 'coordinate_family_procession', isOptional: false },
              { key: 'prepare_gift_trays', isOptional: false, costCategory: 'favors_gifts' },
            ],
          },
        ],
      },
    ],
  },

  // ── Filipino ──────────────────────────────────────────────────────────────
  {
    culture: 'filipino',
    grafts: [
      {
        questKey: 'ceremony',
        section: {
          key: 'filipino_ceremony',
          isOptional: false,
          tasks: [
            { key: 'choose_cord_and_veil_sponsors', isOptional: false },
            { key: 'choose_candle_sponsors', isOptional: false },
            { key: 'choose_principal_sponsors', isOptional: false },
          ],
        },
      },
    ],
    quests: [],
  },

  // ── Greek ─────────────────────────────────────────────────────────────────
  {
    culture: 'greek',
    grafts: [
      {
        questKey: 'ceremony',
        section: {
          key: 'greek_ceremony',
          isOptional: false,
          tasks: [
            { key: 'choose_koumbaro', isOptional: false },
            { key: 'order_stefana', isOptional: false, leadTimeDays: 45 },
          ],
        },
      },
      {
        questKey: 'food_beverage',
        section: {
          key: 'greek_reception',
          isOptional: true,
          tasks: [
            { key: 'prepare_koufeta', isOptional: true, costCategory: 'favors_gifts' },
            { key: 'plan_money_dance', isOptional: true },
          ],
        },
      },
    ],
    quests: [],
  },
]

export const CULTURE_PACK_BY_KEY = new Map(CULTURE_PACKS.map(p => [p.culture, p]))

/** Heritages with a shipped pack. Others are accepted at onboarding but add nothing yet. */
export const SUPPORTED_CULTURE_PACKS = CULTURE_PACKS.map(p => p.culture)
