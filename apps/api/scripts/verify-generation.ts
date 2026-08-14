/**
 * Verification for quest generation (the golden-path gate; see DESIGN.md §7).
 *
 * Generates a wedding for each variant and prints the resulting tree size, so a
 * change to templates, culture packs, or pruning shows up as a diff rather than
 * as a surprise in production.
 *
 * Run: bun run scripts/verify-generation.ts
 */

import { db } from '../src/db'
import { modules, subModules, tasks, weddings } from '../src/db/schema'
import { generateQuestsForWedding } from '../src/services/quest-generator'
import { validateContent } from '../src/content/validate-content'
import { eq, inArray } from 'drizzle-orm'
import type { Culture, WeddingType } from '@bliss/types'

interface Variant {
  name: string
  weddingType: WeddingType
  cultures: Culture[]
  plannerType?: 'full' | 'none'
  monthsOut: number
  /** Scoping answers, to show decision-driven divergence in the real tree. */
  answers?: Record<string, string>
}

const VARIANTS: Variant[] = [
  { name: 'base (traditional, 14mo, no planner)', weddingType: 'traditional', cultures: [], monthsOut: 14 },
  { name: 'base + full planner', weddingType: 'traditional', cultures: [], plannerType: 'full', monthsOut: 14 },
  { name: 'short engagement (6mo)', weddingType: 'traditional', cultures: [], monthsOut: 6 },
  { name: '+ South Asian', weddingType: 'traditional', cultures: ['south_asian'], monthsOut: 14 },
  { name: '+ Chinese', weddingType: 'traditional', cultures: ['chinese'], monthsOut: 14 },
  { name: '+ Chinese + Jewish', weddingType: 'traditional', cultures: ['chinese', 'jewish'], monthsOut: 14 },
  { name: 'micro wedding', weddingType: 'micro', cultures: [], monthsOut: 14 },
  { name: 'elopement', weddingType: 'elopement', cultures: [], monthsOut: 14 },
  { name: 'courthouse', weddingType: 'courthouse', cultures: [], monthsOut: 14 },
  // Same wedding, one different answer. The task counts must differ.
  // One answer apart each time, so the effect is readable as a diff.
  {
    name: 'answer: rented gown',
    weddingType: 'traditional',
    cultures: [],
    monthsOut: 14,
    answers: { 'attire.dress_acquisition': 'rent' },
  },
  {
    name: 'answer: custom gown',
    weddingType: 'traditional',
    cultures: [],
    monthsOut: 14,
    answers: { 'attire.dress_acquisition': 'buy_custom' },
  },
  {
    name: 'answer: BYOB bar',
    weddingType: 'traditional',
    cultures: [],
    monthsOut: 14,
    answers: { 'food.bar_package': 'byob' },
  },
]

function dateMonthsOut(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

const createdIds: string[] = []

async function run() {
  console.log('\nQuest generation verification\n')

  // Cheap and first: a predicate typo drops tasks silently, so fail before
  // touching the database.
  const problems = validateContent()
  if (problems.length) {
    console.error('FAIL: content self-check')
    for (const p of problems) console.error(`      ${p.where}: ${p.problem}`)
    process.exit(1)
  }
  console.log('content self-check: ok\n')
  console.log(
    'variant'.padEnd(38) +
      'quests'.padStart(8) +
      'sections'.padStart(10) +
      'tasks'.padStart(8) +
      '  untranslated',
  )
  console.log('-'.repeat(80))

  let anyUntranslated = 0

  for (const v of VARIANTS) {
    const [wedding] = await db
      .insert(weddings)
      .values({
        weddingDate: dateMonthsOut(v.monthsOut),
        state: 'WA',
        city: 'Seattle',
        weddingType: v.weddingType,
        cultures: v.cultures,
        plannerType: v.plannerType ?? 'none',
        hasPlanner: v.plannerType === 'full',
        guestCountExact: 120,
      })
      .returning()

    createdIds.push(wedding!.id)

    await generateQuestsForWedding(wedding!.id, {
      weddingDate: wedding!.weddingDate ?? undefined,
      weddingType: v.weddingType,
      cultures: v.cultures,
      plannerType: v.plannerType ?? 'none',
      answers: v.answers,
      locale: 'en',
    })

    const mods = await db.select().from(modules).where(eq(modules.weddingId, wedding!.id))
    const modIds = mods.map(m => m.id)
    const secs = modIds.length
      ? await db.select().from(subModules).where(inArray(subModules.moduleId, modIds))
      : []
    const tks = await db.select().from(tasks).where(eq(tasks.weddingId, wedding!.id))

    // A title identical to its key means the catalog is missing an entry.
    const untranslated = [
      ...mods.filter(m => m.title === m.i18nKey),
      ...secs.filter(s => s.title === s.i18nKey),
      ...tks.filter(t => t.title === `${t.i18nKey}.title`),
    ]
    anyUntranslated += untranslated.length

    console.log(
      v.name.padEnd(38) +
        String(mods.length).padStart(8) +
        String(secs.length).padStart(10) +
        String(tks.length).padStart(8) +
        '  ' +
        (untranslated.length === 0 ? 'ok' : `${untranslated.length} MISSING`),
    )

    if (untranslated.length > 0) {
      for (const row of untranslated.slice(0, 10)) {
        console.log(`      missing key: ${row.i18nKey}`)
      }
    }
  }

  console.log('-'.repeat(80))

  // Cleanup: this script writes real rows, so it must not leave them behind.
  for (const id of createdIds) {
    await db.delete(weddings).where(eq(weddings.id, id))
  }
  console.log(`cleaned up ${createdIds.length} generated weddings\n`)

  if (anyUntranslated > 0) {
    console.error(`FAIL: ${anyUntranslated} content keys have no catalog entry`)
    process.exit(1)
  }
  console.log('PASS: every generated row resolved to a catalog entry\n')
  process.exit(0)
}

run().catch(async err => {
  for (const id of createdIds) {
    await db.delete(weddings).where(eq(weddings.id, id)).catch(() => {})
  }
  console.error(err)
  process.exit(1)
})
