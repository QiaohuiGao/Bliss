import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { authRoutes } from './routes/auth'
import { weddingRoutes } from './routes/weddings'
import { taskRoutes } from './routes/tasks'
import { stressRoutes } from './routes/stress'
import { celebrationRoutes } from './routes/celebrations'
import { budgetRoutes } from './routes/budget'
import { guestRoutes } from './routes/guests'
import { notificationRoutes } from './routes/notifications'

const app = Fastify({
  logger: {
    level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
  },
})

// Store raw body for Clerk webhook signature verification
app.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
  ;(req as any).rawBody = body
  try {
    done(null, JSON.parse(body as string))
  } catch (e) {
    done(e as Error, undefined)
  }
})

// CORS
await app.register(cors, {
  origin: [
    process.env['WEB_URL'] ?? 'http://localhost:3000',
    'http://localhost:3000',
    'http://localhost:19006',
  ],
  credentials: true,
})

// Rate limiting
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
})

// Health check
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

// Routes
await app.register(authRoutes)
await app.register(weddingRoutes)
await app.register(taskRoutes)
await app.register(stressRoutes)
await app.register(celebrationRoutes)
await app.register(budgetRoutes)
await app.register(guestRoutes)
await app.register(notificationRoutes)

// Start
const port = parseInt(process.env['PORT'] ?? '3001')
const host = '0.0.0.0'

try {
  await app.listen({ port, host })
  console.log(`Bliss API running at http://${host}:${port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
