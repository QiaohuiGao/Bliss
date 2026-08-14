import {
  ATTIRE_ARTIFACT_BUNDLE,
  PHOTOGRAPHER_ARTIFACT_BUNDLE,
  QUEST_SCOPING_ARTIFACT_BUNDLES,
} from '../artifacts/registry'
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

const reports = await Promise.all([
  runAttireEvalSuite(ATTIRE_ARTIFACT_BUNDLE),
  runPhotographerEvalSuite(PHOTOGRAPHER_ARTIFACT_BUNDLE),
  runQuestScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.food_beverage),
  runVenueScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.venue_date),
  runFoundationScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.foundation),
  runGuestsScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.guests_stationery),
  runWeddingPartyScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.wedding_party),
  runGuestExperienceScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.guest_experience),
  runDesignScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.design_flowers),
  runCeremonyScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.ceremony),
  runLifeScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.registry_rings_honeymoon),
  runLegalScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.legal),
  runPreEventsScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.pre_wedding_events),
  runFinaleScopingEvalSuite(QUEST_SCOPING_ARTIFACT_BUNDLES.final_30_and_day_of),
])
let passed = true

for (const report of reports) {
  const failed = [...report.promptChecks, ...report.cases].filter(check => !check.passed)
  console.log(`Agent release gate: ${report.bundleId}`)
  console.log(`Suite: ${report.suiteVersion} · ${report.caseCount} cases`)
  console.log(`Result: ${report.passed ? 'PASS' : 'FAIL'}`)
  for (const failure of failed) {
    console.error(`  ${failure.id}: ${failure.detail ?? 'failed'}`)
  }
  passed &&= report.passed
}

if (!passed) process.exit(1)
