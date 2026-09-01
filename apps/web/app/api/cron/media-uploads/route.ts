import type { NextRequest } from 'next/server'
import { forwardCron } from '@/lib/cron'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  return forwardCron(request, 'media-uploads')
}
