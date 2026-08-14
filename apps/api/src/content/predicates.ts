/**
 * Predicate grammar for `appliesWhen` tags on task and section templates.
 *
 * This file is the reason the product thesis works without a model: a task list
 * is the *output* of the couple's decisions, and the mapping from decisions to
 * tasks is a pure function over these predicates. See PRD.md §3 and
 * DESIGN.md §3.2.
 *
 * The grammar is deliberately tiny. It is not a query language and must never
 * grow into one — if a rule cannot be expressed here, the content is probably
 * wrong rather than the grammar.
 *
 *   attire.dress_acquisition == rent
 *   attire.dress_acquisition != rent
 *   attire.dress_acquisition in (buy_offrack, buy_custom)
 *   guest_count > 150
 *   state == WA
 *   cultures includes chinese
 *   has_planner == false
 *   NOT wedding_type == elopement
 *
 * A left operand containing a dot is an **answer key** — a scoping question the
 * couple answered (or had inferred for them). Everything else is a **fact** about
 * the wedding. Answer keys are always fully qualified with their quest key, so
 * `attire.dress_acquisition` is unambiguous across quests.
 */

export type PredicateSource = string

/** Facts about the wedding itself, as opposed to answers to scoping questions. */
export interface PredicateFacts {
  wedding_type: string
  planner_type: string
  has_planner: boolean
  cultures: string[]
  state?: string
  guest_count?: number
  budget_tier?: string
  /** Months between today and the wedding date. */
  months_out?: number
}

export interface PredicateContext {
  /** Fully qualified answer key → chosen option value. */
  answers: Record<string, string>
  facts: PredicateFacts
}

type Node =
  | { kind: 'not'; inner: Node }
  | { kind: 'eq'; left: string; value: string; negated: boolean }
  | { kind: 'in'; left: string; values: string[] }
  | { kind: 'cmp'; left: string; op: '>' | '>=' | '<' | '<='; value: number }
  | { kind: 'includes'; left: string; value: string }

export class PredicateError extends Error {}

// ─── Parsing ──────────────────────────────────────────────────────────────────

const IDENT = String.raw`[a-z_][a-z0-9_.]*`
const VALUE = String.raw`[A-Za-z0-9_-]+`

const RE_IN = new RegExp(`^(${IDENT})\\s+in\\s+\\(([^)]*)\\)$`)
const RE_INCLUDES = new RegExp(`^(${IDENT})\\s+includes\\s+(${VALUE})$`)
const RE_EQ = new RegExp(`^(${IDENT})\\s*(==|!=)\\s*(${VALUE})$`)
const RE_CMP = new RegExp(`^(${IDENT})\\s*(>=|<=|>|<)\\s*(-?\\d+)$`)

function parseNode(src: string): Node {
  const s = src.trim()
  if (!s) throw new PredicateError('empty predicate')

  if (s.startsWith('NOT ')) {
    return { kind: 'not', inner: parseNode(s.slice(4)) }
  }

  const inMatch = RE_IN.exec(s)
  if (inMatch) {
    const values = inMatch[2]!.split(',').map(v => v.trim()).filter(Boolean)
    if (!values.length) throw new PredicateError(`empty option list in: ${src}`)
    return { kind: 'in', left: inMatch[1]!, values }
  }

  const includesMatch = RE_INCLUDES.exec(s)
  if (includesMatch) {
    return { kind: 'includes', left: includesMatch[1]!, value: includesMatch[2]! }
  }

  // Ordering matters: `>=` before `==` is not an issue, but a numeric compare
  // must be tried before equality so `guest_count > 150` is not read as an ident.
  const cmpMatch = RE_CMP.exec(s)
  if (cmpMatch) {
    return {
      kind: 'cmp',
      left: cmpMatch[1]!,
      op: cmpMatch[2] as '>' | '>=' | '<' | '<=',
      value: Number(cmpMatch[3]),
    }
  }

  const eqMatch = RE_EQ.exec(s)
  if (eqMatch) {
    return {
      kind: 'eq',
      left: eqMatch[1]!,
      value: eqMatch[3]!,
      negated: eqMatch[2] === '!=',
    }
  }

  throw new PredicateError(`cannot parse predicate: ${src}`)
}

const cache = new Map<PredicateSource, Node>()

export function parsePredicate(src: PredicateSource): Node {
  const hit = cache.get(src)
  if (hit) return hit
  const node = parseNode(src)
  cache.set(src, node)
  return node
}

// ─── Evaluation ───────────────────────────────────────────────────────────────

const isAnswerKey = (left: string) => left.includes('.')

function resolveLeft(left: string, ctx: PredicateContext): unknown {
  if (isAnswerKey(left)) return ctx.answers[left]
  if (!(left in ctx.facts)) {
    throw new PredicateError(`unknown fact: ${left}`)
  }
  return (ctx.facts as unknown as Record<string, unknown>)[left]
}

function evalNode(node: Node, ctx: PredicateContext): boolean {
  switch (node.kind) {
    case 'not':
      return !evalNode(node.inner, ctx)

    case 'in': {
      const actual = resolveLeft(node.left, ctx)
      return typeof actual === 'string' && node.values.includes(actual)
    }

    case 'includes': {
      const actual = resolveLeft(node.left, ctx)
      if (!Array.isArray(actual)) {
        throw new PredicateError(`\`includes\` needs a list, got ${typeof actual}: ${node.left}`)
      }
      return actual.includes(node.value)
    }

    case 'cmp': {
      const actual = resolveLeft(node.left, ctx)
      // An unknown number is not a small number. A wedding with no guest count
      // yet must not silently match `guest_count < 50`.
      if (typeof actual !== 'number') return false
      switch (node.op) {
        case '>': return actual > node.value
        case '>=': return actual >= node.value
        case '<': return actual < node.value
        case '<=': return actual <= node.value
      }
    }

    case 'eq': {
      const actual = resolveLeft(node.left, ctx)
      const expected = node.value
      const matches =
        typeof actual === 'boolean'
          ? actual === (expected === 'true')
          : actual === expected
      return node.negated ? !matches : matches
    }
  }
}

export function evalPredicate(src: PredicateSource, ctx: PredicateContext): boolean {
  return evalNode(parsePredicate(src), ctx)
}

export function evalAll(
  sources: PredicateSource[] | undefined,
  ctx: PredicateContext,
): boolean {
  return !sources || sources.every(s => evalPredicate(s, ctx))
}

// ─── Static validation ────────────────────────────────────────────────────────

/**
 * Answer keys a predicate reads. Used by the content self-check to prove every
 * predicate refers to a scoping question that actually exists — a typo in an
 * answer key would otherwise silently drop tasks from every couple's list.
 */
export function referencedAnswerKeys(src: PredicateSource): string[] {
  const node = parsePredicate(src)
  const out: string[] = []
  const walk = (n: Node) => {
    if (n.kind === 'not') return walk(n.inner)
    if (isAnswerKey(n.left)) out.push(n.left)
  }
  walk(node)
  return out
}
