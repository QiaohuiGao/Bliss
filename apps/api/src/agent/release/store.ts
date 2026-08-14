import { and, desc, eq, or } from 'drizzle-orm'
import { db, type DB } from '../../db'
import {
  agentArtifactBundles,
  agentDeployments,
  agentReleaseAssignments,
  agentReleaseControls,
} from '../../db/schema'
import {
  artifactBundle,
  hasArtifactBundle,
  type AgentArtifactBundle,
} from '../artifacts/registry'
import { AgentGuardrailError } from '../errors'
import { stickyReleaseBucket } from './cohort'

type Transaction = Parameters<Parameters<DB['transaction']>[0]>[0]
type Executor = DB | Transaction

async function registerBundle(executor: Executor, packKey: string, bundle: AgentArtifactBundle) {
  if (bundle.packKey !== packKey) {
    throw new AgentGuardrailError('ARTIFACT_PACK_MISMATCH', 'Bundle does not belong to this decision pack')
  }
  await executor.insert(agentArtifactBundles).values({
    id: bundle.id,
    packKey,
    mode: bundle.mode,
    promptVersion: bundle.promptVersion,
    toolsVersion: bundle.toolsVersion,
    domainPackVersion: bundle.domainPackVersion,
    policyVersion: bundle.policyVersion,
    modelPolicyVersion: bundle.modelPolicyVersion,
    evalSuiteVersion: bundle.evalSuiteVersion,
  }).onConflictDoNothing()
}

export async function assertReleaseEnabled(
  executor: Executor,
  packKey: string,
  capability?: string,
) {
  const controls = await executor.select().from(agentReleaseControls).where(and(
    eq(agentReleaseControls.killed, true),
    or(
      and(eq(agentReleaseControls.scope, 'global'), eq(agentReleaseControls.key, '*')),
      and(eq(agentReleaseControls.scope, 'pack'), eq(agentReleaseControls.key, packKey)),
      ...(capability
        ? [and(eq(agentReleaseControls.scope, 'capability'), eq(agentReleaseControls.key, capability))]
        : []),
    ),
  ))
  if (controls.length > 0) {
    throw new AgentGuardrailError(
      capability ? 'AGENT_CAPABILITY_DISABLED' : 'AGENT_PACK_DISABLED',
      controls[0]!.reason ?? 'This agent capability is temporarily unavailable',
      true,
    )
  }
}

export async function resolveArtifactBundleForWedding(input: {
  weddingId: string
  packKey: string
  defaultBundle: AgentArtifactBundle
}): Promise<AgentArtifactBundle> {
  await assertReleaseEnabled(db, input.packKey)
  await registerBundle(db, input.packKey, input.defaultBundle)
  let deployments = await db.select().from(agentDeployments).where(and(
    eq(agentDeployments.packKey, input.packKey),
    eq(agentDeployments.status, 'active'),
  )).orderBy(desc(agentDeployments.createdAt))
  if (!deployments.some(deployment => deployment.stage === 'stable')) {
    await db.insert(agentDeployments).values({
      id: `bootstrap:${input.packKey}:${input.defaultBundle.id}`,
      packKey: input.packKey,
      bundleId: input.defaultBundle.id,
      stage: 'stable',
      allocationBasisPoints: 10_000,
    }).onConflictDoNothing()
    deployments = await db.select().from(agentDeployments).where(and(
      eq(agentDeployments.packKey, input.packKey),
      eq(agentDeployments.status, 'active'),
    )).orderBy(desc(agentDeployments.createdAt))
  }
  const canary = deployments.find(deployment => deployment.stage === 'canary')
  const stable = deployments.find(deployment => deployment.stage === 'stable')
  const chosen = canary && stickyReleaseBucket(input.weddingId, canary.id) < canary.allocationBasisPoints
    ? canary
    : stable
  if (!chosen) throw new AgentGuardrailError('STABLE_DEPLOYMENT_MISSING', 'No stable agent bundle is available', true)
  if (!hasArtifactBundle(chosen.bundleId)) {
    throw new AgentGuardrailError(
      'ARTIFACT_BUNDLE_UNAVAILABLE',
      'The assigned agent bundle is not available in this release',
      true,
    )
  }
  await db.insert(agentReleaseAssignments).values({
    weddingId: input.weddingId,
    packKey: input.packKey,
    deploymentId: chosen.id,
    bundleId: chosen.bundleId,
  }).onConflictDoUpdate({
    target: [agentReleaseAssignments.weddingId, agentReleaseAssignments.packKey],
    set: {
      deploymentId: chosen.id,
      bundleId: chosen.bundleId,
      assignedAt: new Date(),
    },
  })
  return artifactBundle(chosen.bundleId)
}

export async function deployAgentBundle(input: {
  packKey: string
  bundleId: string
  stage: 'stable' | 'canary'
  allocationBasisPoints: number
}) {
  if (!hasArtifactBundle(input.bundleId)) {
    throw new AgentGuardrailError('ARTIFACT_BUNDLE_UNAVAILABLE', 'Bundle is not present in this release')
  }
  if (input.stage === 'stable' && input.allocationBasisPoints !== 10_000) {
    throw new AgentGuardrailError('INVALID_STABLE_ALLOCATION', 'Stable deployment allocation must be 100%')
  }
  if (input.allocationBasisPoints < 1 || input.allocationBasisPoints > 10_000) {
    throw new AgentGuardrailError('INVALID_CANARY_ALLOCATION', 'Allocation must be from 1 to 10000 basis points')
  }
  const bundle = artifactBundle(input.bundleId)
  if (bundle.packKey !== input.packKey) {
    throw new AgentGuardrailError('ARTIFACT_PACK_MISMATCH', 'Bundle does not belong to this decision pack')
  }
  return db.transaction(async tx => {
    await registerBundle(tx, input.packKey, bundle)
    const [same] = await tx.select().from(agentDeployments).where(and(
      eq(agentDeployments.packKey, input.packKey),
      eq(agentDeployments.bundleId, input.bundleId),
      eq(agentDeployments.stage, input.stage),
      eq(agentDeployments.status, 'active'),
    )).limit(1)
    if (same) {
      const [updated] = await tx.update(agentDeployments).set({
        allocationBasisPoints: input.allocationBasisPoints,
      }).where(eq(agentDeployments.id, same.id)).returning()
      return updated!
    }
    await tx.update(agentDeployments).set({ status: 'completed', endedAt: new Date() }).where(and(
      eq(agentDeployments.packKey, input.packKey),
      eq(agentDeployments.stage, input.stage),
      eq(agentDeployments.status, 'active'),
    ))
    const [created] = await tx.insert(agentDeployments).values(input).returning()
    if (input.stage === 'stable') {
      await tx.update(agentReleaseAssignments).set({
        deploymentId: created!.id,
        bundleId: created!.bundleId,
        assignedAt: new Date(),
      }).where(eq(agentReleaseAssignments.packKey, input.packKey))
    }
    return created!
  })
}

export async function rollbackAgentPack(packKey: string, restoreBundleId: string) {
  if (!hasArtifactBundle(restoreBundleId)) {
    throw new AgentGuardrailError('ARTIFACT_BUNDLE_UNAVAILABLE', 'Rollback bundle is not present in this release')
  }
  const bundle = artifactBundle(restoreBundleId)
  if (bundle.packKey !== packKey) {
    throw new AgentGuardrailError('ARTIFACT_PACK_MISMATCH', 'Rollback bundle does not belong to this decision pack')
  }
  return db.transaction(async tx => {
    await registerBundle(tx, packKey, bundle)
    await tx.update(agentDeployments).set({ status: 'rolled_back', endedAt: new Date() }).where(and(
      eq(agentDeployments.packKey, packKey),
      eq(agentDeployments.status, 'active'),
    ))
    const [restored] = await tx.insert(agentDeployments).values({
      packKey,
      bundleId: restoreBundleId,
      stage: 'stable',
      allocationBasisPoints: 10_000,
    }).returning()
    await tx.update(agentReleaseAssignments).set({
      deploymentId: restored!.id,
      bundleId: restoreBundleId,
      assignedAt: new Date(),
    }).where(eq(agentReleaseAssignments.packKey, packKey))
    return restored!
  })
}

export async function setReleaseControl(input: {
  scope: 'global' | 'pack' | 'capability'
  key: string
  killed: boolean
  reason?: string | null
}) {
  const [control] = await db.insert(agentReleaseControls).values({
    ...input,
    reason: input.reason ?? null,
  }).onConflictDoUpdate({
    target: [agentReleaseControls.scope, agentReleaseControls.key],
    set: { killed: input.killed, reason: input.reason ?? null, updatedAt: new Date() },
  }).returning()
  return control!
}
