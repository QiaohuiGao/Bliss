import { strict as assert } from 'node:assert'
import { and, eq } from 'drizzle-orm'
import {
  ATTIRE_ARTIFACT_BUNDLE,
  ATTIRE_ARTIFACT_BUNDLE_V1,
} from '../src/agent/artifacts/registry'
import { AgentGuardrailError } from '../src/agent/errors'
import {
  deployAgentBundle,
  resolveArtifactBundleForWedding,
  rollbackAgentPack,
  setReleaseControl,
} from '../src/agent/release/store'
import { db } from '../src/db'
import {
  agentDeployments,
  agentReleaseAssignments,
  users,
  weddings,
} from '../src/db/schema'

let weddingId: string | null = null
let userId: string | null = null
const packKey = 'attire_beauty'

try {
  const [user] = await db.insert(users).values({
    clerkId: `release-smoke-${crypto.randomUUID()}`,
    email: `release-smoke-${crypto.randomUUID()}@bliss.invalid`,
  }).returning({ id: users.id })
  userId = user!.id
  const [wedding] = await db.insert(weddings).values({
    weddingType: 'traditional',
    cultures: [],
    plannerType: 'none',
  }).returning({ id: weddings.id })
  weddingId = wedding!.id

  await rollbackAgentPack(packKey, ATTIRE_ARTIFACT_BUNDLE.id)
  const stable = await resolveArtifactBundleForWedding({
    weddingId,
    packKey,
    defaultBundle: ATTIRE_ARTIFACT_BUNDLE,
  })
  assert.equal(stable.id, ATTIRE_ARTIFACT_BUNDLE.id)

  const canary = await deployAgentBundle({
    packKey,
    bundleId: ATTIRE_ARTIFACT_BUNDLE_V1.id,
    stage: 'canary',
    allocationBasisPoints: 10_000,
  })
  const assignedCanary = await resolveArtifactBundleForWedding({
    weddingId,
    packKey,
    defaultBundle: ATTIRE_ARTIFACT_BUNDLE,
  })
  const assignedCanaryAgain = await resolveArtifactBundleForWedding({
    weddingId,
    packKey,
    defaultBundle: ATTIRE_ARTIFACT_BUNDLE,
  })
  assert.equal(assignedCanary.id, 'attire-v1')
  assert.equal(assignedCanaryAgain.id, 'attire-v1')
  const assignments = await db.select().from(agentReleaseAssignments).where(and(
    eq(agentReleaseAssignments.weddingId, weddingId),
    eq(agentReleaseAssignments.packKey, packKey),
  ))
  assert.equal(assignments.length, 1)
  assert.equal(assignments[0]!.deploymentId, canary.id)

  const restored = await rollbackAgentPack(packKey, ATTIRE_ARTIFACT_BUNDLE.id)
  const afterRollback = await resolveArtifactBundleForWedding({
    weddingId,
    packKey,
    defaultBundle: ATTIRE_ARTIFACT_BUNDLE,
  })
  assert.equal(afterRollback.id, ATTIRE_ARTIFACT_BUNDLE.id)
  const [rolledBackCanary] = await db.select().from(agentDeployments)
    .where(eq(agentDeployments.id, canary.id)).limit(1)
  assert.equal(rolledBackCanary!.status, 'rolled_back')
  assert.equal(restored.stage, 'stable')

  await setReleaseControl({
    scope: 'pack',
    key: packKey,
    killed: true,
    reason: 'Release smoke kill switch',
  })
  try {
    await assert.rejects(
      resolveArtifactBundleForWedding({
        weddingId,
        packKey,
        defaultBundle: ATTIRE_ARTIFACT_BUNDLE,
      }),
      (error: unknown) => error instanceof AgentGuardrailError && error.code === 'AGENT_PACK_DISABLED',
    )
  } finally {
    await setReleaseControl({ scope: 'pack', key: packKey, killed: false })
  }

  console.log('PASS: agent release-plane database smoke test')
  console.log('  wedding-sticky canary: attire-v1')
  console.log(`  rollback restored: ${ATTIRE_ARTIFACT_BUNDLE.id}`)
  console.log('  pack kill switch: blocked and safely re-enabled')
} finally {
  await setReleaseControl({ scope: 'pack', key: packKey, killed: false })
  if (weddingId) await db.delete(weddings).where(eq(weddings.id, weddingId))
  if (userId) await db.delete(users).where(eq(users.id, userId))
}

process.exit(0)
