import { db } from '../db'
import { modules, subModules, tasks } from '../db/schema'
import {
  questI18nKey,
  sectionI18nKey,
  taskI18nKey,
} from '../content/quest-templates'
import { culturePackI18nKey } from '../content/culture-packs'
import { resolveTree, type ResolvedQuest, type ResolverInput } from './quest-resolver'
import { translate } from '@bliss/i18n'
import type { Culture } from '@bliss/types'
import { addDays, differenceInDays, format } from 'date-fns'
import { recomputeWeddingSchedule } from './schedule-store'

interface GeneratorInput extends ResolverInput {
  weddingDate?: string
  /** Locale used only to fill the `title` fallback columns. Display uses i18nKey. */
  locale?: string
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
  const tree = resolveTree(input)
  const scheduled = scheduleQuests(tree.quests, input.weddingDate)

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
        // Every quest is open. Prerequisites drive the suggested deadline and a
        // nudge, never a gate — see PRD.md §6.1.
        status: 'active',
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
          templateKey: task.key,
          i18nKey: tKey,
          title: translate(locale, `${tKey}.title`),
          // translate() returns the key itself when missing; treat that as absent.
          description: description === descriptionKey ? null : description,
          sortOrder: ti + 1,
          confidence: 'assumed' as const,
          isOptional: task.isOptional,
          dueDate: item.suggestedDeadline,
          leadTimeDays: task.leadTimeDays ?? null,
          effortMinutes: task.effortMinutes ?? 60,
          costCategory: task.costCategory ?? null,
        }
      })

      if (taskRows.length > 0) {
        await db.insert(tasks).values(taskRows)
      }
    }
  }
  await recomputeWeddingSchedule(weddingId)
}
