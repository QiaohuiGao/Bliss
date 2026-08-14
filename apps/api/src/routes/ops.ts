import { timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { loadAgentOpsSummary, loadAgentRunTrace } from '../agent/ops/store'
import { AGENT_ARTIFACT_BUNDLES } from '../agent/artifacts/registry'
import {
  deployAgentBundle,
  rollbackAgentPack,
  setReleaseControl,
} from '../agent/release/store'

function equalSecret(received: string, expected: string) {
  const left = Buffer.from(received)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

async function requireOpsAccess(req: FastifyRequest, reply: FastifyReply) {
  const expected = process.env['OPS_SECRET']
  if (!expected) return reply.status(503).send({ error: 'Ops access is not configured' })
  const received = req.headers['x-ops-key']
  if (typeof received !== 'string' || !equalSecret(received, expected)) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
}

export async function opsRoutes(app: FastifyInstance) {
  const access = { preHandler: [requireOpsAccess] }

  app.get('/ops/agent/summary', access, async req => {
    const { days } = z.object({ days: z.coerce.number().int().min(1).max(90).default(7) })
      .parse(req.query)
    return loadAgentOpsSummary(days)
  })

  app.get('/ops/agent/runs/:runId', access, async (req, reply) => {
    const { runId } = z.object({ runId: z.string().uuid() }).parse(req.params)
    const trace = await loadAgentRunTrace(runId)
    if (!trace) return reply.status(404).send({ error: 'Agent run not found' })
    return reply.send(trace)
  })

  app.get('/ops/agent/artifacts', access, async () => AGENT_ARTIFACT_BUNDLES.map(bundle => ({
    id: bundle.id,
    mode: bundle.mode,
    promptVersion: bundle.promptVersion,
    toolsVersion: bundle.toolsVersion,
    domainPackVersion: bundle.domainPackVersion,
    policyVersion: bundle.policyVersion,
    modelPolicyVersion: bundle.modelPolicyVersion,
    evalSuiteVersion: bundle.evalSuiteVersion,
  })))

  app.post('/ops/agent/deployments', access, async req => {
    const body = z.object({
      packKey: z.string().min(1),
      bundleId: z.string().min(1),
      stage: z.enum(['stable', 'canary']),
      allocationBasisPoints: z.number().int().min(1).max(10_000),
    }).strict().parse(req.body)
    return deployAgentBundle(body)
  })

  app.post('/ops/agent/rollback', access, async req => {
    const body = z.object({
      packKey: z.string().min(1),
      restoreBundleId: z.string().min(1),
    }).strict().parse(req.body)
    return rollbackAgentPack(body.packKey, body.restoreBundleId)
  })

  app.post('/ops/agent/controls', access, async req => {
    const body = z.object({
      scope: z.enum(['global', 'pack', 'capability']),
      key: z.string().min(1),
      killed: z.boolean(),
      reason: z.string().max(500).nullable().optional(),
    }).strict().parse(req.body)
    return setReleaseControl(body)
  })
}
