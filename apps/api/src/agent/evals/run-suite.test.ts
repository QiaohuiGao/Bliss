import { describe, expect, it } from 'bun:test'
import {
  ATTIRE_ARTIFACT_BUNDLE,
  PHOTOGRAPHER_ARTIFACT_BUNDLE,
  QUEST_SCOPING_ARTIFACT_BUNDLES,
} from '../artifacts/registry'
import { ATTIRE_EVAL_CASES } from './attire-suite'
import { PHOTOGRAPHER_EVAL_CASES } from './photographer-suite'
import { QUEST_SCOPING_EVAL_CASES } from './quest-scoping-suite'
import { VENUE_SCOPING_EVAL_CASES } from './venue-scoping-suite'
import { FOUNDATION_SCOPING_EVAL_CASES } from './foundation-scoping-suite'
import { GUESTS_SCOPING_EVAL_CASES } from './guests-scoping-suite'
import { WEDDING_PARTY_SCOPING_EVAL_CASES } from './wedding-party-scoping-suite'
import { GUEST_EXPERIENCE_SCOPING_EVAL_CASES } from './guest-experience-scoping-suite'
import { DESIGN_SCOPING_EVAL_CASES } from './design-scoping-suite'
import { CEREMONY_SCOPING_EVAL_CASES } from './ceremony-scoping-suite'
import { LIFE_SCOPING_EVAL_CASES } from './life-scoping-suite'
import { LEGAL_SCOPING_EVAL_CASES } from './legal-scoping-suite'
import { PRE_EVENTS_SCOPING_EVAL_CASES } from './pre-events-scoping-suite'
import { FINALE_SCOPING_EVAL_CASES } from './finale-scoping-suite'
import {
  runAttireEvalSuite,
  runPhotographerEvalSuite,
  runQuestScopingEvalSuite,
  runVenueScopingEvalSuite,
  runFoundationScopingEvalSuite,
  runGuestsScopingEvalSuite,
  runWeddingPartyScopingEvalSuite,
  runGuestExperienceScopingEvalSuite,
  runDesignScopingEvalSuite,
  runCeremonyScopingEvalSuite,
  runLifeScopingEvalSuite,
  runLegalScopingEvalSuite,
  runPreEventsScopingEvalSuite,
  runFinaleScopingEvalSuite,
} from './run-suite'

describe('attire artifact release gate', () => {
  it('ships a 34-case versioned baseline', () => {
    expect(ATTIRE_EVAL_CASES).toHaveLength(34)
    expect(new Set(ATTIRE_EVAL_CASES.map(testCase => testCase.id)).size).toBe(34)
  })

  it('passes the active artifact bundle', async () => {
    const report = await runAttireEvalSuite()
    expect(report.passed).toBe(true)
  })

  it('rejects a prompt that drops the safety and conflict contract', async () => {
    const report = await runAttireEvalSuite({
      ...ATTIRE_ARTIFACT_BUNDLE,
      id: 'attire-regressed-test',
      promptVersion: 'attire-system-regressed-test',
      prompt: 'Be a helpful wedding assistant.',
    })
    expect(report.passed).toBe(false)
    expect(report.promptChecks.filter(check => !check.passed).length).toBeGreaterThan(0)
  })
})

describe('generic quest scoping release gate', () => {
  it('ships a 32-case versioned baseline', () => {
    expect(QUEST_SCOPING_EVAL_CASES).toHaveLength(32)
    expect(new Set(QUEST_SCOPING_EVAL_CASES.map(testCase => testCase.id)).size).toBe(32)
  })

  it('passes the active Food and Beverage artifact bundle', async () => {
    const report = await runQuestScopingEvalSuite()
    expect(report.passed).toBe(true)
  })

  it('rejects a prompt that drops attribution and approval boundaries', async () => {
    const report = await runQuestScopingEvalSuite({
      ...QUEST_SCOPING_ARTIFACT_BUNDLES.food_beverage,
      id: 'quest-scoping-regressed-test',
      promptVersion: 'quest-scoping-regressed-test',
      prompt: 'Help choose a menu.',
    })
    expect(report.passed).toBe(false)
    expect(report.promptChecks.filter(check => !check.passed).length).toBeGreaterThan(0)
  })
})

describe('venue scoping domain release gate', () => {
  it('ships a 16-case branch baseline', () => {
    expect(VENUE_SCOPING_EVAL_CASES).toHaveLength(16)
    expect(new Set(VENUE_SCOPING_EVAL_CASES.map(testCase => testCase.id)).size).toBe(16)
  })

  it('passes every authored Venue and Date choice', async () => {
    const report = await runVenueScopingEvalSuite()
    expect(report.passed).toBe(true)
  })
})

describe('foundation scoping domain release gate', () => {
  it('ships a 19-case relationship-and-priority baseline', () => {
    expect(FOUNDATION_SCOPING_EVAL_CASES).toHaveLength(19)
    expect(new Set(FOUNDATION_SCOPING_EVAL_CASES.map(testCase => testCase.id)).size).toBe(19)
  })

  it('passes every authored Foundation choice', async () => {
    const report = await runFoundationScopingEvalSuite()
    expect(report.passed).toBe(true)
  })
})

describe('guest and stationery scoping domain release gate', () => {
  it('ships a 17-case guest-policy baseline', () => {
    expect(GUESTS_SCOPING_EVAL_CASES).toHaveLength(17)
    expect(new Set(GUESTS_SCOPING_EVAL_CASES.map(testCase => testCase.id)).size).toBe(17)
  })

  it('passes every authored Guest List and Stationery choice', async () => {
    const report = await runGuestsScopingEvalSuite()
    expect(report.passed).toBe(true)
  })
})

describe('wedding-party scoping domain release gate', () => {
  it('ships a 17-case relationship-and-consent baseline', () => {
    expect(WEDDING_PARTY_SCOPING_EVAL_CASES).toHaveLength(17)
    expect(new Set(WEDDING_PARTY_SCOPING_EVAL_CASES.map(testCase => testCase.id)).size).toBe(17)
  })

  it('passes every authored Wedding Party and VIP choice', async () => {
    const report = await runWeddingPartyScopingEvalSuite()
    expect(report.passed).toBe(true)
  })
})

describe('guest-experience scoping domain release gate', () => {
  it('ships a 16-case travel-and-hospitality baseline', () => {
    expect(GUEST_EXPERIENCE_SCOPING_EVAL_CASES).toHaveLength(16)
    expect(new Set(GUEST_EXPERIENCE_SCOPING_EVAL_CASES.map(testCase => testCase.id)).size).toBe(16)
  })

  it('passes every authored Guest Experience and Travel choice', async () => {
    const report = await runGuestExperienceScopingEvalSuite()
    expect(report.passed).toBe(true)
  })
})

describe('design scoping domain release gate', () => {
  it('ships a 16-case design-and-production baseline', () => {
    expect(DESIGN_SCOPING_EVAL_CASES).toHaveLength(16)
    expect(new Set(DESIGN_SCOPING_EVAL_CASES.map(testCase => testCase.id)).size).toBe(16)
  })

  it('passes every authored Design, Flowers, and Rentals choice', async () => {
    const report = await runDesignScopingEvalSuite()
    expect(report.passed).toBe(true)
  })
})

describe('ceremony scoping domain release gate', () => {
  it('ships a 15-case meaning-and-privacy baseline', () => {
    expect(CEREMONY_SCOPING_EVAL_CASES).toHaveLength(15)
    expect(new Set(CEREMONY_SCOPING_EVAL_CASES.map(testCase => testCase.id)).size).toBe(15)
  })

  it('passes every authored Ceremony choice', async () => {
    const report = await runCeremonyScopingEvalSuite()
    expect(report.passed).toBe(true)
  })
})

describe('shared-life scoping domain release gate', () => {
  it('ships a 17-case rings-gifts-and-trip baseline', () => {
    expect(LIFE_SCOPING_EVAL_CASES).toHaveLength(17)
    expect(new Set(LIFE_SCOPING_EVAL_CASES.map(testCase => testCase.id)).size).toBe(17)
  })

  it('passes every authored Registry, Rings, and Honeymoon choice', async () => {
    const report = await runLifeScopingEvalSuite()
    expect(report.passed).toBe(true)
  })
})

describe('legal workflow scoping domain release gate', () => {
  it('ships a 15-case authority-bounded baseline', () => {
    expect(LEGAL_SCOPING_EVAL_CASES).toHaveLength(15)
    expect(new Set(LEGAL_SCOPING_EVAL_CASES.map(testCase => testCase.id)).size).toBe(15)
  })

  it('passes every authored Legal workflow choice', async () => {
    const report = await runLegalScopingEvalSuite()
    expect(report.passed).toBe(true)
  })
})

describe('pre-wedding events scoping domain release gate', () => {
  it('ships a 17-case celebration-boundary baseline', () => {
    expect(PRE_EVENTS_SCOPING_EVAL_CASES).toHaveLength(17)
    expect(new Set(PRE_EVENTS_SCOPING_EVAL_CASES.map(testCase => testCase.id)).size).toBe(17)
  })

  it('passes every authored Pre-Wedding Events choice', async () => {
    const report = await runPreEventsScopingEvalSuite()
    expect(report.passed).toBe(true)
  })
})

describe('final-month scoping domain release gate', () => {
  it('ships a 15-case handoff-and-closeout baseline', () => {
    expect(FINALE_SCOPING_EVAL_CASES).toHaveLength(15)
    expect(new Set(FINALE_SCOPING_EVAL_CASES.map(testCase => testCase.id)).size).toBe(15)
  })

  it('passes every authored Final 30 Days and Day-Of choice', async () => {
    const report = await runFinaleScopingEvalSuite()
    expect(report.passed).toBe(true)
  })
})

describe('photographer artifact release gate', () => {
  it('ships a 37-case versioned baseline', () => {
    expect(PHOTOGRAPHER_EVAL_CASES).toHaveLength(37)
    expect(new Set(PHOTOGRAPHER_EVAL_CASES.map(testCase => testCase.id)).size).toBe(37)
  })

  it('passes the active artifact bundle', async () => {
    const report = await runPhotographerEvalSuite()
    expect(report.passed).toBe(true)
  })

  it('rejects a prompt that drops provider trust and approval boundaries', async () => {
    const report = await runPhotographerEvalSuite({
      ...PHOTOGRAPHER_ARTIFACT_BUNDLE,
      id: 'photographer-regressed-test',
      promptVersion: 'photographer-system-regressed-test',
      prompt: 'Find good photographers and be helpful.',
    })
    expect(report.passed).toBe(false)
    expect(report.promptChecks.filter(check => !check.passed).length).toBeGreaterThan(0)
  })
})
