/**
 * The Resolver. Pure, deterministic, and contains no model call — see
 * DESIGN.md §3.2.
 *
 * Given a wedding and whatever the couple has decided so far, it produces the
 * quest tree: base quests pruned by wedding type, cultural packs grafted on,
 * and tasks filtered by `appliesWhen` predicates over the couple's answers.
 *
 * Two properties are load-bearing and covered by tests:
 *
 *   1. **Determinism.** Same wedding plus same answers gives the same tree,
 *      byte for byte. That is what makes the output testable without a model and
 *      what lets the agent be judged against a fixed expectation.
 *   2. **Never empty, never gated.** Unanswered questions fall back to their
 *      `defaultValue`, so a couple who answers nothing still gets a complete,
 *      coherent plan (PRD.md §11). Answers are marked `assumed` rather than
 *      `decided` so the assistant can circle back later.
 */

import {
  QUEST_TEMPLATES,
  type QuestTemplate,
  type ScopingQuestion,
  type SectionTemplate,
} from '../content/quest-templates'
import { CULTURE_PACK_BY_KEY } from '../content/culture-packs'
import { evalAll, type PredicateContext, type PredicateFacts } from '../content/predicates'
import type { Culture, PlannerType, WeddingType } from '@bliss/types'

export interface ResolverInput {
  weddingType?: WeddingType
  cultures?: Culture[]
  plannerType?: PlannerType
  guestCount?: number
  state?: string
  budgetTier?: string
  monthsOut?: number
  /**
   * Fully qualified answer key (`attire.dress_acquisition`) → chosen value.
   * Deliberately partial: anything absent is filled from the question's default.
   */
  answers?: Record<string, string>
}

export interface ResolvedAnswer {
  key: string
  value: string
  /** `assumed` means nobody chose this — it came from the question's default. */
  source: 'decided' | 'assumed'
}

export interface ResolvedQuest {
  template: QuestTemplate
  /** Culture that contributed this quest, if it came from a pack. */
  culture: Culture | null
  sections: { section: SectionTemplate; culture: Culture | null }[]
}

export interface ResolvedTree {
  quests: ResolvedQuest[]
  answers: ResolvedAnswer[]
}

// ─── Answers ──────────────────────────────────────────────────────────────────

const qualify = (template: QuestTemplate, question: ScopingQuestion) =>
  `${template.answerNamespace ?? template.key}.${question.key}`

function allTemplates(cultures: Culture[]): QuestTemplate[] {
  const packQuests = cultures
    .map(c => CULTURE_PACK_BY_KEY.get(c))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .flatMap(p => p.quests)
  return [...QUEST_TEMPLATES, ...packQuests]
}

/**
 * Every scoping question in play, answered or defaulted. Order follows quest
 * order so the output is stable.
 */
export function resolveAnswers(input: ResolverInput): ResolvedAnswer[] {
  const given = input.answers ?? {}
  const out: ResolvedAnswer[] = []

  for (const template of allTemplates(input.cultures ?? [])) {
    for (const question of template.scopingQuestions ?? []) {
      const key = qualify(template, question)
      const chosen = given[key]
      const valid = chosen !== undefined && question.options.includes(chosen)
      out.push({
        key,
        value: valid ? chosen : question.defaultValue,
        source: valid ? 'decided' : 'assumed',
      })
    }
  }

  return out
}

const answerMap = (answers: ResolvedAnswer[]): Record<string, string> =>
  Object.fromEntries(answers.map(a => [a.key, a.value]))

// ─── Pruning ──────────────────────────────────────────────────────────────────

function appliesToWeddingType(
  allowed: WeddingType[] | undefined,
  actual: WeddingType,
): boolean {
  return !allowed || allowed.includes(actual)
}

/**
 * A day-of coordinator is only worth suggesting to couples who have no planner.
 * A venue coordinator does not count: they work for the venue, not the couple.
 */
function needsSelfCoordination(plannerType: PlannerType): boolean {
  return plannerType === 'none' || plannerType === 'venue_only'
}

function buildFacts(input: ResolverInput): PredicateFacts {
  const plannerType = input.plannerType ?? 'none'
  return {
    wedding_type: input.weddingType ?? 'traditional',
    planner_type: plannerType,
    has_planner: plannerType !== 'none',
    cultures: input.cultures ?? [],
    state: input.state,
    guest_count: input.guestCount,
    budget_tier: input.budgetTier,
    months_out: input.monthsOut,
  }
}

// ─── Resolution ───────────────────────────────────────────────────────────────

export function resolveTree(input: ResolverInput): ResolvedTree {
  const weddingType = input.weddingType ?? 'traditional'
  const plannerType = input.plannerType ?? 'none'
  const cultures = input.cultures ?? []
  const packs = cultures
    .map(c => CULTURE_PACK_BY_KEY.get(c))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

  const answers = resolveAnswers(input)
  const ctx: PredicateContext = { answers: answerMap(answers), facts: buildFacts(input) }

  const keepTask = (t: {
    weddingTypes?: WeddingType[]
    requiresNoPlanner?: boolean
    appliesWhen?: string[]
  }) =>
    appliesToWeddingType(t.weddingTypes, weddingType) &&
    (!t.requiresNoPlanner || needsSelfCoordination(plannerType)) &&
    evalAll(t.appliesWhen, ctx)

  /** A section with no surviving tasks is not a section. */
  const pruneSection = (section: SectionTemplate): SectionTemplate | null => {
    if (!evalAll(section.appliesWhen, ctx)) return null
    const kept = section.tasks.filter(keepTask)
    return kept.length ? { ...section, tasks: kept } : null
  }

  const quests: ResolvedQuest[] = []

  // Base tree, pruned by wedding type, with cultural sections grafted on.
  for (const template of QUEST_TEMPLATES) {
    if (!appliesToWeddingType(template.weddingTypes, weddingType)) continue

    const sections: ResolvedQuest['sections'] = []

    for (const section of template.sections) {
      const pruned = pruneSection(section)
      if (pruned) sections.push({ section: pruned, culture: null })
    }

    for (const pack of packs) {
      for (const graft of pack.grafts) {
        if (graft.questKey !== template.key) continue
        const pruned = pruneSection(graft.section)
        if (pruned) sections.push({ section: pruned, culture: pack.culture })
      }
    }

    if (sections.length) quests.push({ template, culture: null, sections })
  }

  // Standalone quests contributed by cultural packs.
  for (const pack of packs) {
    for (const template of pack.quests) {
      if (!appliesToWeddingType(template.weddingTypes, weddingType)) continue
      const sections = template.sections
        .map(pruneSection)
        .filter((s): s is SectionTemplate => s !== null)
        .map(section => ({ section, culture: pack.culture }))
      if (sections.length) {
        quests.push({ template, culture: pack.culture, sections })
      }
    }
  }

  quests.sort((a, b) => a.template.order - b.template.order)
  return { quests, answers }
}

// ─── Convenience readers, for tests and for the agent's proposal path ─────────

export interface FlatTask {
  questKey: string
  sectionKey: string
  taskKey: string
  leadTimeDays: number
  isOptional: boolean
}

export function flattenTasks(tree: ResolvedTree): FlatTask[] {
  return tree.quests.flatMap(q =>
    q.sections.flatMap(({ section }) =>
      section.tasks.map(t => ({
        questKey: q.template.key,
        sectionKey: section.key,
        taskKey: t.key,
        leadTimeDays: t.leadTimeDays ?? 0,
        isOptional: t.isOptional,
      })),
    ),
  )
}

export function tasksForQuest(tree: ResolvedTree, questKey: string): FlatTask[] {
  return flattenTasks(tree).filter(t => t.questKey === questKey)
}
