import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { sql } from 'drizzle-orm'
import { authRoutes } from './routes/auth'
import { weddingRoutes } from './routes/weddings'
import { moduleRoutes } from './routes/modules'
import { taskRoutes } from './routes/tasks'
import { celebrationRoutes } from './routes/celebrations'
import { agentRoutes } from './routes/agent'
import { memoryRoutes } from './routes/memory'
import { actionRoutes } from './routes/actions'
import { feedbackRoutes } from './routes/feedback'
import { opsRoutes } from './routes/ops'
import { legalRoutes } from './routes/legal'
import { uploadRoutes } from './routes/uploads'
import { db } from './db'
import {
  deploymentCapabilities,
  missingProductCapabilities,
  missingProductionConfiguration,
} from './health'
import { parseJsonRequestBody } from './http/json-body'
import { publicHttpError } from './http/errors'
import { configuredWebOrigins } from './http/cors'

if (process.env['NODE_ENV'] === 'production') {
  const missing = missingProductionConfiguration(process.env)
  if (missing.length > 0) {
    throw new Error(`Missing production configuration: ${missing.join(', ')}`)
  }
}

const app = Fastify({
  logger: {
    level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
  },
})

app.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
  ;(req as any).rawBody = body
  try {
    done(null, parseJsonRequestBody(body as string))
  } catch (e) {
    done(e as Error, undefined)
  }
})

await app.register(cors, {
  origin: configuredWebOrigins(process.env),
  credentials: true,
})

await app.register(rateLimit, {
  max: 1000,
  timeWindow: '1 minute',
})

app.setErrorHandler((error, req, reply) => {
  const normalized = publicHttpError(error)
  if (normalized.shouldLog) req.log.error({ error }, 'Unhandled request error')
  return reply.status(normalized.statusCode).send(normalized.body)
})

app.get('/health', async (_req, reply) => {
  try {
    await db.execute(sql`select 1`)
    return reply.send({
      status: 'ok',
      database: 'ok',
      capabilities: deploymentCapabilities(process.env),
      timestamp: new Date().toISOString(),
    })
  } catch {
    return reply.status(503).send({
      status: 'unavailable',
      database: 'unavailable',
      capabilities: deploymentCapabilities(process.env),
      timestamp: new Date().toISOString(),
    })
  }
})

app.get('/readiness', async (_req, reply) => {
  const capabilities = deploymentCapabilities(process.env)
  try {
    await db.execute(sql`select 1`)
    const missingCapabilities = missingProductCapabilities(process.env)
    return reply.status(missingCapabilities.length === 0 ? 200 : 503).send({
      status: missingCapabilities.length === 0 ? 'ready' : 'not_ready',
      database: 'ok',
      capabilities,
      timestamp: new Date().toISOString(),
    })
  } catch {
    return reply.status(503).send({
      status: 'not_ready',
      database: 'unavailable',
      capabilities,
      timestamp: new Date().toISOString(),
    })
  }
})

await app.register(authRoutes)
await app.register(weddingRoutes)
await app.register(moduleRoutes)
await app.register(taskRoutes)
await app.register(celebrationRoutes)
await app.register(agentRoutes)
await app.register(memoryRoutes)
await app.register(actionRoutes)
await app.register(feedbackRoutes)
await app.register(opsRoutes)
await app.register(legalRoutes)
await app.register(uploadRoutes)

const port = parseInt(process.env['PORT'] ?? '3001')
const host = '0.0.0.0'

try {
  await app.listen({ port, host })
  console.log(`Bliss API running at http://${host}:${port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
