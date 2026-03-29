import type { FastifyInstance } from 'fastify'
import { db } from '../db'
import { users, weddings, tasks } from '../db/schema'
import { eq, and, lt, isNull, lte } from 'drizzle-orm'
import sgMail from '@sendgrid/mail'
import { subDays, addDays } from 'date-fns'

async function sendExpoPush(pushToken: string, title: string, body: string) {
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ to: pushToken, title, body, sound: 'default' }),
  })
  return res.json()
}

export async function notificationRoutes(app: FastifyInstance) {
  // Save push token
  app.post('/me/push-token', async (req, reply) => {
    const userId = (req as any).userId as string
    const { pushToken } = req.body as { pushToken: string }
    await db.update(users).set({ pushToken }).where(eq(users.id, userId))
    return reply.send({ saved: true })
  })

  // Cron endpoint — called by Railway cron daily
  app.post('/internal/cron/nudges', async (req, reply) => {
    const secret = req.headers['x-cron-secret']
    if (secret !== process.env['CRON_SECRET']) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    sgMail.setApiKey(process.env['SENDGRID_API_KEY']!)

    // Find weddings with overdue tasks
    const allWeddings = await db.select().from(weddings)
    let nudgesSent = 0

    for (const wedding of allWeddings) {
      // Find overdue tasks (still pending, from current or earlier stages)
      const overdueTasks = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.weddingId, wedding.id),
            eq(tasks.status, 'pending'),
            lte(tasks.stage, wedding.currentStage)
          )
        )
        .limit(3)

      if (overdueTasks.length === 0) continue

      // Get both partners
      const partnerIds = [wedding.partnerAId, wedding.partnerBId].filter(Boolean) as string[]
      for (const partnerId of partnerIds) {
        const [user] = await db.select().from(users).where(eq(users.id, partnerId)).limit(1)
        if (!user) continue

        const taskLines = overdueTasks.map((t) => `• ${t.title}`).join('\n')

        // Push notification
        if (user.pushToken) {
          await sendExpoPush(
            user.pushToken,
            "A few things are waiting for you",
            `${overdueTasks[0]?.title} and ${overdueTasks.length - 1} more`
          )
        }

        // Email nudge (weekly — check last nudge separately in prod)
        if (user.email) {
          await sgMail.send({
            to: user.email,
            from: process.env['SENDGRID_FROM_EMAIL']!,
            subject: `A calm reminder from Bliss`,
            text: `Hi ${user.displayName ?? 'there'},\n\nHere are a few things waiting in your wedding plan:\n\n${taskLines}\n\nNo rush — just a gentle reminder that they're there when you're ready.\n\nWith care,\nBliss`,
            html: `
              <p>Hi ${user.displayName ?? 'there'},</p>
              <p>Here are a few things waiting in your wedding plan:</p>
              <ul>${overdueTasks.map((t) => `<li>${t.title}</li>`).join('')}</ul>
              <p>No rush — just a gentle reminder that they're there when you're ready.</p>
              <p style="color:#9C8E8A">With care,<br>Bliss</p>
            `,
          })
          nudgesSent++
        }
      }
    }

    return reply.send({ nudgesSent })
  })
}
