import { z } from 'zod'
import { AgentGuardrailError } from '../errors'

export const reminderPayloadSchema = z.object({
  title: z.string().trim().min(1).max(160),
  triggerAt: z.string().datetime({ offset: true }),
  note: z.string().trim().max(2_000).optional(),
}).strict()

export const calendarEventPayloadSchema = z.object({
  title: z.string().trim().min(1).max(160),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).optional(),
  location: z.string().trim().max(500).optional(),
  description: z.string().trim().max(4_000).optional(),
}).strict().refine(payload =>
  !payload.endsAt || new Date(payload.endsAt) > new Date(payload.startsAt),
{ message: 'Calendar event end must be after its start' })

export const emailDraftPayloadSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20_000),
  recipients: z.array(z.string().email()).max(10).default([]),
}).strict()

export const sendEmailPayloadSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20_000),
  recipients: z.array(z.string().email()).min(1).max(10),
  replyTo: z.string().email().optional(),
}).strict()

export const vendorShortlistPayloadSchema = z.object({
  criteria: z.string().trim().min(1).max(2_000),
  location: z.string().trim().max(500).optional(),
  maxResults: z.number().int().min(1).max(10).default(5),
}).strict()

export type ExternalActionKind =
  | 'draft_email'
  | 'send_email'
  | 'calendar_event'
  | 'reminder'
  | 'vendor_shortlist'

export function parseExternalActionPayload(
  kind: ExternalActionKind,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const schema = {
    draft_email: emailDraftPayloadSchema,
    send_email: sendEmailPayloadSchema,
    calendar_event: calendarEventPayloadSchema,
    reminder: reminderPayloadSchema,
    vendor_shortlist: vendorShortlistPayloadSchema,
  }[kind]
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    throw new AgentGuardrailError(
      'ACTION_PAYLOAD_INVALID',
      `The ${kind} proposal is missing required details`,
    )
  }
  return parsed.data
}

const icsDate = (value: string) => new Date(value)
  .toISOString()
  .replace(/[-:]/g, '')
  .replace(/\.\d{3}Z$/, 'Z')

const icsText = (value: string) => value
  .replace(/\\/g, '\\\\')
  .replace(/\n/g, '\\n')
  .replace(/,/g, '\\,')
  .replace(/;/g, '\\;')

export function calendarEventIcs(
  actionId: string,
  payload: z.infer<typeof calendarEventPayloadSchema>,
): string {
  const end = payload.endsAt
    ? new Date(payload.endsAt)
    : new Date(new Date(payload.startsAt).getTime() + 60 * 60 * 1_000)
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bliss//Wedding Planning Companion//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${actionId}@bliss.local`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(payload.startsAt)}`,
    `DTEND:${icsDate(end.toISOString())}`,
    `SUMMARY:${icsText(payload.title)}`,
    ...(payload.description ? [`DESCRIPTION:${icsText(payload.description)}`] : []),
    ...(payload.location ? [`LOCATION:${icsText(payload.location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}
