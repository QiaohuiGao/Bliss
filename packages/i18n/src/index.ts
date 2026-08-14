import IntlMessageFormat from 'intl-messageformat'
import { DEFAULT_LOCALE, fallbackChain, type Locale, type Namespace } from './config'

export * from './config'

// Static imports keep this bundler-friendly on every surface (RSC, Metro, Bun).
// Adding a locale means adding one block here and one entry in config.ts.
import enCommon from './locales/en/common.json'
import enOnboarding from './locales/en/onboarding.json'
import enBoard from './locales/en/board.json'
import enQuest from './locales/en/quest.json'
import enErrors from './locales/en/errors.json'
import enGlossary from './locales/en/glossary.json'
import enAssistant from './locales/en/assistant.json'
import enMoments from './locales/en/moments.json'
import enActions from './locales/en/actions.json'
import enPhotographer from './locales/en/photographer.json'
import enQuests from './content/en/quests.json'
import enCultures from './content/en/cultures.json'

type Catalog = Record<string, unknown>

const CATALOGS: Record<string, Record<string, Catalog>> = {
  en: {
    common: enCommon,
    onboarding: enOnboarding,
    board: enBoard,
    quest: enQuest,
    errors: enErrors,
    glossary: enGlossary,
    assistant: enAssistant,
    moments: enMoments,
    actions: enActions,
    photographer: enPhotographer,
  },
}

/**
 * Quest/module/task copy, keyed by template key. Separate from UI namespaces
 * because it is generated into the database rather than rendered from a screen.
 * Base tree lives under `quest.*`; cultural packs under `culture.*`.
 */
const CONTENT: Record<string, Catalog> = {
  en: { ...enQuests, ...enCultures },
}

export function loadMessages(locale: string, ns: Namespace): Catalog {
  for (const candidate of fallbackChain(locale)) {
    const found = CATALOGS[candidate]?.[ns]
    if (found) return found
  }
  return CATALOGS[DEFAULT_LOCALE]![ns]!
}

/** All namespaces flattened into one object, for surfaces that want a single blob. */
export function loadAllMessages(locale: string): Catalog {
  for (const candidate of fallbackChain(locale)) {
    const found = CATALOGS[candidate]
    if (found) return found as Catalog
  }
  return CATALOGS[DEFAULT_LOCALE] as Catalog
}

export function loadContent(locale: string): Catalog {
  for (const candidate of fallbackChain(locale)) {
    const found = CONTENT[candidate]
    if (found) return found
  }
  return CONTENT[DEFAULT_LOCALE]!
}

function lookup(source: Catalog, path: string): string | undefined {
  const value = path
    .split('.')
    .reduce<unknown>((acc, part) => (acc as Catalog | undefined)?.[part], source)
  return typeof value === 'string' ? value : undefined
}

const formatterCache = new Map<string, IntlMessageFormat>()

/**
 * Resolve a dotted key against the UI catalogs and the content catalog, then
 * render it as ICU MessageFormat.
 *
 * Content keys are namespaced `quest.*` and live in `content/<locale>/quests.json`;
 * everything else resolves against `locales/<locale>/<namespace>.json`.
 */
export function translate(
  locale: string,
  key: string,
  params?: Record<string, string | number | Date>,
): string {
  const [head, ...rest] = key.split('.')
  const tail = rest.join('.')

  let raw: string | undefined
  if (head === 'quest' || head === 'culture') {
    raw = lookup(loadContent(locale), key) ?? lookup(loadMessages(locale, 'quest'), tail)
  } else {
    raw = lookup(loadMessages(locale, head as Namespace), tail)
  }

  // A missing key is a bug, not a runtime failure. Return the key so it is
  // visible in the UI and caught by the parity check in CI.
  if (raw === undefined) return key
  if (!params) return raw

  const cacheKey = `${locale}::${key}`
  let formatter = formatterCache.get(cacheKey)
  if (!formatter) {
    formatter = new IntlMessageFormat(raw, locale)
    formatterCache.set(cacheKey, formatter)
  }
  return String(formatter.format(params))
}

/** Curried helper for server code that translates many keys in one locale. */
export function translator(locale: string) {
  return (key: string, params?: Record<string, string | number | Date>) =>
    translate(locale, key, params)
}

export type { Locale, Namespace }
