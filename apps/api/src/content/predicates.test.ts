import { describe, expect, it } from 'bun:test'
import {
  evalPredicate,
  parsePredicate,
  referencedAnswerKeys,
  PredicateError,
  type PredicateContext,
} from './predicates'

const ctx = (over: Partial<PredicateContext> = {}): PredicateContext => ({
  answers: { 'attire.dress_acquisition': 'buy_custom', 'food.bar_package': 'byob' },
  facts: {
    wedding_type: 'traditional',
    planner_type: 'none',
    has_planner: false,
    cultures: ['chinese', 'jewish'],
    state: 'WA',
    guest_count: 120,
    months_out: 14,
  },
  ...over,
})

describe('equality', () => {
  it('matches an answer', () => {
    expect(evalPredicate('attire.dress_acquisition == buy_custom', ctx())).toBe(true)
    expect(evalPredicate('attire.dress_acquisition == rent', ctx())).toBe(false)
  })

  it('negates with !=', () => {
    expect(evalPredicate('attire.dress_acquisition != rent', ctx())).toBe(true)
    expect(evalPredicate('attire.dress_acquisition != buy_custom', ctx())).toBe(false)
  })

  it('compares booleans against true/false', () => {
    expect(evalPredicate('has_planner == false', ctx())).toBe(true)
    expect(evalPredicate('has_planner == true', ctx())).toBe(false)
  })

  it('reads facts', () => {
    expect(evalPredicate('state == WA', ctx())).toBe(true)
    expect(evalPredicate('wedding_type == elopement', ctx())).toBe(false)
  })
})

describe('in', () => {
  it('matches any listed option', () => {
    expect(
      evalPredicate('attire.dress_acquisition in (buy_offrack, buy_custom)', ctx()),
    ).toBe(true)
    expect(evalPredicate('attire.dress_acquisition in (rent)', ctx())).toBe(false)
  })

  it('tolerates whitespace', () => {
    expect(evalPredicate('attire.dress_acquisition in ( rent ,buy_custom )', ctx())).toBe(true)
  })
})

describe('includes', () => {
  it('tests list membership', () => {
    expect(evalPredicate('cultures includes chinese', ctx())).toBe(true)
    expect(evalPredicate('cultures includes korean', ctx())).toBe(false)
  })

  it('rejects a non-list left operand', () => {
    expect(() => evalPredicate('state includes WA', ctx())).toThrow(PredicateError)
  })
})

describe('numeric comparison', () => {
  it('compares', () => {
    expect(evalPredicate('guest_count > 100', ctx())).toBe(true)
    expect(evalPredicate('guest_count > 120', ctx())).toBe(false)
    expect(evalPredicate('guest_count >= 120', ctx())).toBe(true)
    expect(evalPredicate('guest_count < 50', ctx())).toBe(false)
  })

  it('treats an unknown number as no match, in either direction', () => {
    const unknown = ctx({ facts: { ...ctx().facts, guest_count: undefined } })
    // The dangerous bug this guards: a wedding with no guest count yet must not
    // silently qualify as a small wedding.
    expect(evalPredicate('guest_count < 50', unknown)).toBe(false)
    expect(evalPredicate('guest_count > 50', unknown)).toBe(false)
  })
})

describe('NOT', () => {
  it('inverts', () => {
    expect(evalPredicate('NOT wedding_type == elopement', ctx())).toBe(true)
    expect(evalPredicate('NOT cultures includes chinese', ctx())).toBe(false)
  })
})

describe('unanswered questions', () => {
  it('never match, rather than matching everything', () => {
    const empty = ctx({ answers: {} })
    expect(evalPredicate('attire.dress_acquisition == rent', empty)).toBe(false)
    expect(evalPredicate('attire.dress_acquisition in (rent, buy_custom)', empty)).toBe(false)
    // The resolver is what guarantees this case does not arise in practice: it
    // fills defaults first. This is the backstop.
  })
})

describe('errors', () => {
  it('rejects nonsense at parse time', () => {
    expect(() => parsePredicate('dress_acquisition ~= rent')).toThrow(PredicateError)
    expect(() => parsePredicate('')).toThrow(PredicateError)
    expect(() => parsePredicate('attire.x in ()')).toThrow(PredicateError)
  })

  it('rejects an unknown fact rather than silently returning false', () => {
    expect(() => evalPredicate('venue_style == garden', ctx())).toThrow(PredicateError)
  })
})

describe('referencedAnswerKeys', () => {
  it('finds answer keys and ignores facts', () => {
    expect(referencedAnswerKeys('attire.dress_acquisition == rent')).toEqual([
      'attire.dress_acquisition',
    ])
    expect(referencedAnswerKeys('NOT food.bar_package in (dry)')).toEqual(['food.bar_package'])
    expect(referencedAnswerKeys('guest_count > 150')).toEqual([])
  })
})
