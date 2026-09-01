import { NextRequest, NextResponse } from 'next/server'

type Worker = 'reminders' | 'external-actions' | 'media-uploads'

export async function forwardCron(request: NextRequest, worker: Worker) {
  const secret = process.env['CRON_SECRET']
  const authorization = request.headers.get('authorization')
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiUrl = process.env['API_URL'] ?? process.env['NEXT_PUBLIC_API_URL']
  if (!apiUrl) {
    return NextResponse.json({ error: 'API URL is not configured' }, { status: 503 })
  }

  try {
    const response = await fetch(`${apiUrl}/internal/cron/${worker}`, {
      method: 'POST',
      headers: { authorization },
      cache: 'no-store',
    })
    const body = await response.text()
    return new NextResponse(body, {
      status: response.status,
      headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
    })
  } catch {
    return NextResponse.json({ error: 'Worker is unavailable' }, { status: 503 })
  }
}
