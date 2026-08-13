/**
 * Catalog parity check (CI i18n gate; see docs/I18N.md).
 *
 * Every locale must expose the same key set as `en`. Missing keys warn; extra
 * keys fail, because an extra key is almost always a typo that will silently
 * never render.
 *
 * Run: bun run check:parity
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const LOCALES_DIR = join(import.meta.dir, '..', 'src', 'locales')
const CONTENT_DIR = join(import.meta.dir, '..', 'src', 'content')
const REFERENCE = 'en'

function flatten(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix]
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    // Keys starting with `_` are authoring comments, not translatable strings.
    k.startsWith('_') ? [] : flatten(v, prefix ? `${prefix}.${k}` : k),
  )
}

function keysForLocale(dir: string, locale: string): string[] {
  const localeDir = join(dir, locale)
  if (!existsSync(localeDir)) return []
  return readdirSync(localeDir)
    .filter(f => f.endsWith('.json'))
    .flatMap(file => {
      const ns = file.replace(/\.json$/, '')
      const json = JSON.parse(readFileSync(join(localeDir, file), 'utf8'))
      return flatten(json, ns)
    })
    .sort()
}

function compare(label: string, dir: string): { missing: number; extra: number } {
  const reference = new Set(keysForLocale(dir, REFERENCE))
  const locales = readdirSync(dir).filter(d => d !== REFERENCE)

  let missing = 0
  let extra = 0

  for (const locale of locales) {
    const keys = new Set(keysForLocale(dir, locale))
    const missingKeys = [...reference].filter(k => !keys.has(k))
    const extraKeys = [...keys].filter(k => !reference.has(k))

    if (missingKeys.length) {
      console.warn(`WARN  ${label}/${locale}: ${missingKeys.length} missing keys`)
      missingKeys.slice(0, 15).forEach(k => console.warn(`        ${k}`))
      missing += missingKeys.length
    }
    if (extraKeys.length) {
      console.error(`FAIL  ${label}/${locale}: ${extraKeys.length} keys not present in ${REFERENCE}`)
      extraKeys.slice(0, 15).forEach(k => console.error(`        ${k}`))
      extra += extraKeys.length
    }
    if (!missingKeys.length && !extraKeys.length) {
      console.log(`ok    ${label}/${locale}: ${keys.size} keys, parity with ${REFERENCE}`)
    }
  }

  console.log(`      ${label}/${REFERENCE}: ${reference.size} keys (reference)`)
  return { missing, extra }
}

const ui = compare('locales', LOCALES_DIR)
const content = compare('content', CONTENT_DIR)

if (ui.extra + content.extra > 0) {
  console.error('\nFAIL: catalogs contain keys absent from the reference locale')
  process.exit(1)
}
console.log('\nPASS: catalog parity')
