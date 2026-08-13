import { db } from '../db'
import { modules, subModules, tasks } from '../db/schema'
import {
  QUEST_TEMPLATES,
  questI18nKey,
  sectionI18nKey,
  taskI18nKey,
  type QuestTemplate,
  type SectionTemplate,
} from '../content/quest-templates'
import { CULTURE_PACK_BY_KEY, culturePackI18nKey } from '../content/culture-packs'
import { translate } from '@bliss/i18n'
import type { Culture, PlannerType, WeddingType } from '@bliss/types'
import { addDays, differenceInDays, format } from 'date-fns'

interface GeneratorInput {
  weddingDate?: string
  weddingType?: WeddingType
  cultures?: Culture[]
  plannerType?: PlannerType
  /** Locale used only to fill the `title` fallback columns. Display uses i18nKey. */
  locale?: string
}

/**
 * Resolved quest, after cultural grafts and wedding-type pruning. Copy is still
 * key-only at this point; strings are rendered once, at the end, purely to
 * populate the fallback/search columns.
 */
interface ResolvedQuest {
  template: QuestTemplate
  /** Culture that contributed this quest, if it came from a pack. */
  culture: Culture | null
  sections: { section: SectionTemplate; culture: Culture | null }[]
}

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

// ─── Resolution ───────────────────────────────────────────────────────────────

function resolveQuests(input: GeneratorInput): ResolvedQuest[] {
  const weddingType = input.weddingType ?? 'traditional'
  const cultures = input.cultures ?? []
  const plannerType = input.plannerType ?? 'none'
  const packs = cultures.map(c => CULTURE_PACK_BY_KEY.get(c)).filter(Boolean)

  const keepTask = (t: { weddingTypes?: WeddingType[]; requiresNoPlanner?: boolean }) =>
    appliesToWeddingType(t.weddingTypes, weddingType) &&
    (!t.requiresNoPlanner || needsSelfCoordination(plannerType))

  const pruneSection = (section: SectionTemplate): SectionTemplate | null => {
    const kept = section.tasks.filter(keepTask)
    return kept.length ? { ...section, tasks: kept } : null
  }

  const resolved: ResolvedQuest[] = []

  // Base tree, pruned by wedding type, with cultural sections grafted on.
  for (const template of QUEST_TEMPLATES) {
    if (!appliesToWeddingType(template.weddingTypes, weddingType)) continue

    const sections: ResolvedQuest['sections'] = []

    for (const section of template.sections) {
      const pruned = pruneSection(section)
      if (pruned) sections.push({ section: pruned, culture: null })
    }

    for (const pack of packs) {
      for (const graft of pack!.grafts) {
        if (graft.questKey !== template.key) continue
        const pruned = pruneSection(graft.section)
        if (pruned) sections.push({ section: pruned, culture: pack!.culture })
      }
    }

    if (sections.length) resolved.push({ template, culture: null, sections })
  }

  // Standalone quests contributed by cultural packs.
  for (const pack of packs) {
    for (const template of pack!.quests) {
      if (!appliesToWeddingType(template.weddingTypes, weddingType)) continue
      const sections = template.sections
        .map(pruneSection)
        .filter((s): s is SectionTemplate => s !== null)
        .map(section => ({ section, culture: pack!.culture }))
      if (sections.length) {
        resolved.push({ template, culture: pack!.culture, sections })
      }
    }
  }

  return resolved.sort((a, b) => a.template.order - b.template.order)
}

// ─── Scheduling ───────────────────────────────────────────────────────────────

/**
 * Interpolate between the short-engagement and long-engagement estimates.
 * US engagements are typically 12-18 months, but 6-9 month timelines are common
 * and need a compressed task set rather than a proportionally shrunk one.
 */
function interpolateEstimatedDays(totalDays: number, range: [number, number]): number {
  if (totalDays <= 180) return range[0]
  if (totalDays >= 450) return range[1]
  const ratio = (totalDays - 180) / (450 - 180)
  return Math.round(range[0] + ratio * (range[1] - range[0]))
}

interface ScheduledQuest extends ResolvedQuest {
  estimatedDays: number
  suggestedDeadline: string
  status: 'locked' | 'active'
}

function scheduleQuests(
  resolved: ResolvedQuest[],
  weddingDate: string | undefined,
): ScheduledQuest[] {
  const today = new Date()
  // No date yet? Assume a 14-month engagement, the US median.
  const endDate = weddingDate ? new Date(weddingDate) : addDays(today, 420)
  const totalDays = Math.max(differenceInDays(endDate, today), 60)

  const byKey = new Map<string, ScheduledQuest>()

  for (const item of resolved) {
    const t = item.template
    const estimatedDays = interpolateEstimatedDays(totalDays, t.estimatedDaysRange)

    let startAfter = today
    for (const prereqKey of t.prerequisites) {
      const prereq = byKey.get(prereqKey)
      if (prereq) {
        const prereqEnd = new Date(prereq.suggestedDeadline)
        if (prereqEnd > startAfter) startAfter = prereqEnd
      }
    }

    let deadline = addDays(startAfter, estimatedDays)
    const latestAllowed = addDays(endDate, -7)
    if (deadline > latestAllowed) deadline = latestAllowed

    const scheduled: ScheduledQuest = {
      ...item,
      estimatedDays,
      suggestedDeadline: format(deadline, 'yyyy-MM-dd'),
      status: t.prerequisites.length > 0 ? 'locked' : 'active',
    }
    byKey.set(t.key, scheduled)
  }

  return Array.from(byKey.values())
}

// ─── Key helpers ──────────────────────────────────────────────────────────────

const questKeys = (q: ResolvedQuest) =>
  q.culture
    ? {
        title: culturePackI18nKey(q.culture, `quest.${q.template.key}.title`),
        subtitle: culturePackI18nKey(q.culture, `quest.${q.template.key}.subtitle`),
        celebration: culturePackI18nKey(q.culture, `quest.${q.template.key}.celebration`),
      }
    : {
        title: questI18nKey(q.template.key, 'title'),
        subtitle: questI18nKey(q.template.key, 'subtitle'),
        celebration: questI18nKey(q.template.key, 'celebration'),
      }

const sectionKey = (questKey: string, sectionKey_: string, culture: Culture | null) =>
  culture
    ? culturePackI18nKey(culture, `section.${sectionKey_}`)
    : sectionI18nKey(questKey, sectionKey_)

const taskKey = (questKey: string, taskKey_: string, culture: Culture | null) =>
  culture
    ? culturePackI18nKey(culture, `task.${taskKey_}`)
    : taskI18nKey(questKey, taskKey_)

// ─── Generation ───────────────────────────────────────────────────────────────

export async function generateQuestsForWedding(
  weddingId: string,
  input: GeneratorInput,
): Promise<void> {
  const locale = input.locale ?? 'en'
  const scheduled = scheduleQuests(resolveQuests(input), input.weddingDate)

  for (const item of scheduled) {
    const keys = questKeys(item)

    const [mod] = await db
      .insert(modules)
      .values({
        weddingId,
        templateKey: item.template.key,
        i18nKey: keys.title,
        // Fallback / search columns only. Display always resolves i18nKey.
        title: translate(locale, keys.title),
        subtitle: translate(locale, keys.subtitle),
        description: translate(locale, keys.celebration),
        sortOrder: item.template.order,
        status: item.status,
        isOptional: item.template.isOptional,
        culture: item.culture,
        estimatedDays: item.estimatedDays,
        suggestedDeadline: item.suggestedDeadline,
        prerequisites: item.template.prerequisites,
      })
      .returning()

    for (let si = 0; si < item.sections.length; si++) {
      const { section, culture } = item.sections[si]!
      const sKey = sectionKey(item.template.key, section.key, culture)

      const [subMod] = await db
        .insert(subModules)
        .values({
          moduleId: mod!.id,
          i18nKey: sKey,
          title: translate(locale, sKey),
          sortOrder: si + 1,
          isOptional: section.isOptional,
        })
        .returning()

      const taskRows = section.tasks.map((task, ti) => {
        const tKey = taskKey(item.template.key, task.key, culture)
        const descriptionKey = `${tKey}.description`
        const description = translate(locale, descriptionKey)
        return {
          subModuleId: subMod!.id,
          weddingId,
          i18nKey: tKey,
          title: translate(locale, `${tKey}.title`),
          // translate() returns the key itself when missing; treat that as absent.
          description: description === descriptionKey ? null : description,
          sortOrder: ti + 1,
          isOptional: task.isOptional,
          leadTimeDays: task.leadTimeDays ?? null,
          costCategory: task.costCategory ?? null,
        }
      })

      if (taskRows.length > 0) {
        await db.insert(tasks).values(taskRows)
      }
    }
  }
}
