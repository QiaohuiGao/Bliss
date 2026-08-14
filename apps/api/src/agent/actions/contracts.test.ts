import { describe, expect, it } from 'bun:test'
import { calendarEventIcs, parseExternalActionPayload } from './contracts'

describe('external action contracts', () => {
  it('requires a timezone-aware trigger for reminders', () => {
    expect(() => parseExternalActionPayload('reminder', {
      title: 'Book salon appointments',
      triggerAt: '2026-10-01T09:00:00',
    })).toThrow()
    expect(parseExternalActionPayload('reminder', {
      title: 'Book salon appointments',
      triggerAt: '2026-10-01T09:00:00-04:00',
    })).toMatchObject({ title: 'Book salon appointments' })
  })

  it('rejects calendar events whose end precedes the start', () => {
    expect(() => parseExternalActionPayload('calendar_event', {
      title: 'Salon visit',
      startsAt: '2026-10-01T10:00:00-04:00',
      endsAt: '2026-10-01T09:00:00-04:00',
    })).toThrow()
  })

  it('creates a portable calendar artifact without sending anything', () => {
    const output = calendarEventIcs('action-1', {
      title: 'Gown fitting',
      startsAt: '2026-10-01T10:00:00-04:00',
      location: 'Brooklyn, NY',
    })
    expect(output).toContain('BEGIN:VEVENT')
    expect(output).toContain('SUMMARY:Gown fitting')
    expect(output).toContain('DTSTART:20261001T140000Z')
  })

  it('requires an exact recipient before an email can enter the send queue', () => {
    expect(() => parseExternalActionPayload('send_email', {
      subject: 'Photography availability',
      body: 'Are you available?',
      recipients: [],
    })).toThrow()
    expect(parseExternalActionPayload('send_email', {
      subject: 'Photography availability',
      body: 'Are you available?',
      recipients: ['studio@example.com'],
    })).toMatchObject({ recipients: ['studio@example.com'] })
  })
})
