import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
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

const app = Fastify({
  logger: {
    level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
  },
})

app.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
  ;(req as any).rawBody = body
  try {
    done(null, JSON.parse(body as string))
  } catch (e) {
    done(e as Error, undefined)
  }
})

await app.register(cors, {
  origin: [
    process.env['WEB_URL'] ?? 'http://localhost:3000',
    'http://localhost:3000',
    'http://localhost:19006',
  ],
  credentials: true,
})

await app.register(rateLimit, {
  max: 1000,
  timeWindow: '1 minute',
})

app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

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
