import type { FastifyInstance, FastifyRequest } from 'fastify'
import { Webhook } from 'svix'
import { db } from '../db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'

interface RequestWithRawBody extends FastifyRequest {
  rawBody?: string
}

export async function authRoutes(app: FastifyInstance) {
  // Clerk webhook — creates user on sign-up
  app.post('/auth/webhook', async (req: RequestWithRawBody, reply) => {
    const secret = process.env['CLERK_WEBHOOK_SECRET']!
    const wh = new Webhook(secret)

    const svixId = req.headers['svix-id'] as string
    const svixTimestamp = req.headers['svix-timestamp'] as string
    const svixSignature = req.headers['svix-signature'] as string

    let event: any
    try {
      event = wh.verify(req.rawBody ?? JSON.stringify(req.body), {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      })
    } catch {
      return reply.status(400).send({ error: 'Invalid webhook signature' })
    }

    if (event.type === 'user.created') {
      const { id: clerkId, email_addresses, first_name, last_name } = event.data
      const email = email_addresses?.[0]?.email_address ?? ''
      const displayName = [first_name, last_name].filter(Boolean).join(' ') || null

      await db
        .insert(users)
        .values({ clerkId, email, displayName })
        .onConflictDoNothing()
    }

    if (event.type === 'user.updated') {
      const { id: clerkId, first_name, last_name } = event.data
      const displayName = [first_name, last_name].filter(Boolean).join(' ') || null
      await db
        .update(users)
        .set({ displayName, updatedAt: new Date() })
        .where(eq(users.clerkId, clerkId))
    }

    return reply.send({ received: true })
  })
}
