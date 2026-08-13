/**
 * Pseudo-locale generator (CI i18n gate; see docs/I18N.md).
 *
 * Produces `en-XA`: every string accented and padded ~35%. Walking the app in
 * this locale is the cheapest possible proof that the i18n layer works, before
 * a single translator is hired. It catches two classes of bug:
 *
 *   1. Unaccented text on screen  = a hardcoded string that never went to a catalog.
 *   2. Clipped or wrapped layout  = no room for Spanish, which runs ~35% longer.
 *
 * Run:    bun run build:pseudo
 * Clean:  bun run build:pseudo -- --clean
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(import.meta.dir, '..', 'src')
const PSEUDO = 'en-XA'

const ACCENTS: Record<string, string> = {
  a: 'á', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'í',
  j: 'ĵ', k: 'ĸ', l: 'ļ', m: 'ɱ', n: 'ñ', o: 'ó', p: 'þ', q: 'ǫ', r: 'ŕ',
  s: 'š', t: 'ţ', u: 'ú', v: 'ṽ', w: 'ŵ', x: ' x', y: 'ý', z: 'ž',
  A: 'Á', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Í',
  J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ', N: 'Ñ', O: 'Ó', P: 'Þ', Q: 'Ǫ', R: 'Ŕ',
  S: 'Š', T: 'Ţ', U: 'Ú', V: 'Ṽ', W: 'Ŵ', X: 'X', Y: 'Ý', Z: 'Ž',
}

/** ICU placeholders and plural/select structure must survive untouched. */
function pseudoize(value: string): string {
  let out = ''
  let depth = 0
  for (const ch of value) {
    if (ch === '{') depth++
    if (ch === '}') depth--
    out += depth > 0 || ch === '}' ? ch : (ACCENTS[ch] ?? ch)
  }
  // ~35% padding, matching Spanish expansion. Brackets make clipping obvious.
  const padding = '·'.repeat(Math.max(2, Math.ceil(out.length * 0.35)))
  return `⟦${out}${padding}⟧`
}

function transform(node: unknown): unknown {
  if (typeof node === 'string') return pseudoize(node)
  if (Array.isArray(node)) return node.map(transform)
  if (typeof node === 'object' && node !== null) {
    return Object.fromEntries(
      Object.entries(node).map(([k, v]) => [k, k.startsWith('_') ? v : transform(v)]),
    )
  }
  return node
}

function build(dir: string) {
  const source = join(dir, 'en')
  const target = join(dir, PSEUDO)
  if (!existsSync(source)) return

  mkdirSync(target, { recursive: true })
  for (const file of readdirSync(source).filter(f => f.endsWith('.json'))) {
    const json = JSON.parse(readFileSync(join(source, file), 'utf8'))
    writeFileSync(join(target, file), `${JSON.stringify(transform(json), null, 2)}\n`)
  }
  console.log(`built ${target}`)
}

function clean(dir: string) {
  const target = join(dir, PSEUDO)
  if (existsSync(target)) {
    rmSync(target, { recursive: true })
    console.log(`removed ${target}`)
  }
}

const isClean = process.argv.includes('--clean')
for (const dir of [join(SRC, 'locales'), join(SRC, 'content')]) {
  isClean ? clean(dir) : build(dir)
}

if (!isClean) {
  console.log(
    `\nAdd '${PSEUDO}' to SUPPORTED_LOCALES in src/config.ts and register it in\n` +
      `src/index.ts to walk the app. Remove it (bun run build:pseudo -- --clean)\n` +
      `before committing: it must never ship.`,
  )
}
