'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { ExternalAction, Wedding } from '@bliss/types'
import {
  ArrowLeft,
  Bell,
  CalendarPlus,
  Check,
  Clipboard,
  Download,
  Leaf,
  Mail,
  Search,
  Send,
  Sparkles,
  X,
} from 'lucide-react'
import { useRouter } from '@/i18n/routing'
import { api } from '@/lib/api'
import { useToken } from '@/lib/useToken'
import { cn } from '@/lib/utils'

const ACTION_ICONS = {
  reminder: Bell,
  calendar_event: CalendarPlus,
  draft_email: Mail,
  send_email: Send,
  vendor_shortlist: Search,
} as const

export default function ActionsPage() {
  const t = useTranslations('actions')
  const router = useRouter()
  const getToken = useToken()
  const booted = useRef(false)
  const [wedding, setWedding] = useState<Wedding | null>(null)
  const [actions, setActions] = useState<ExternalAction[]>([])
  const [loading, setLoading] = useState(true)
  const [activeActionId, setActiveActionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh(currentWedding: Wedding, token: string) {
    setActions(await api.getActions(currentWedding.id, token))
  }

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    async function load() {
      try {
        const token = await getToken()
        const currentWedding = await api.getMyWedding(token)
        setWedding(currentWedding)
        await refresh(currentWedding, token)
      } catch {
        router.push('/onboarding')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [getToken, router])

  async function approve(action: ExternalAction) {
    if (!wedding) return
    setActiveActionId(action.id)
    setError(null)
    try {
      const token = await getToken()
      await api.approveAction(wedding.id, action.id, crypto.randomUUID(), token)
      await refresh(wedding, token)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('state.error'))
    } finally {
      setActiveActionId(null)
    }
  }

  async function cancel(action: ExternalAction) {
    if (!wedding) return
    const token = await getToken()
    await api.cancelAction(wedding.id, action.id, token)
    await refresh(wedding, token)
  }

  if (loading || !wedding) {
    return (
      <div className="min-h-screen bg-gradient-forest flex items-center justify-center px-6">
        <div className="text-center">
          <Leaf className="w-9 h-9 text-bliss-sage animate-sway mx-auto mb-4" />
          <p className="text-sm text-bliss-muted">{t('state.loading')}</p>
        </div>
      </div>
    )
  }

  const visible = actions.filter(action => action.status !== 'cancelled')

  return (
    <div className="min-h-screen bg-gradient-forest relative overflow-hidden">
      <div className="fixed top-10 right-0 w-80 h-80 bg-bliss-sky-light/40 rounded-full translate-x-1/3 blur-3xl pointer-events-none" />
      <header className="sticky top-0 z-30 bg-bliss-surface/80 backdrop-blur-xl border-b border-white/60">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => router.push('/dashboard')} className="btn-ghost -ml-3 flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-serif text-lg">Bliss</span>
          </button>
          <button onClick={() => router.push('/assistant/quest/foundation')} className="btn-ghost text-xs flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            {t('empty.action')}
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-4 pt-10 pb-24">
        <section className="text-center mb-10 animate-slide-up">
          <Bell className="w-8 h-8 text-bliss-sky mx-auto mb-3" />
          <p className="text-[11px] uppercase tracking-[0.18em] text-bliss-sage-dark font-bold mb-2">{t('eyebrow')}</p>
          <h1 className="font-serif text-4xl text-bliss-ink mb-3">{t('title')}</h1>
          <p className="text-sm text-bliss-ink-light max-w-xl mx-auto leading-relaxed">{t('subtitle')}</p>
        </section>

        {visible.length === 0 ? (
          <section className="card p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-bliss-sage-mist flex items-center justify-center mx-auto mb-4">
              <Check className="w-5 h-5 text-bliss-sage-dark" />
            </div>
            <h2 className="font-serif text-xl text-bliss-ink">{t('empty.title')}</h2>
            <p className="text-sm text-bliss-muted mt-2 max-w-md mx-auto">{t('empty.body')}</p>
            <button onClick={() => router.push('/assistant/quest/foundation')} className="btn-primary mt-5 text-sm">{t('empty.action')}</button>
          </section>
        ) : (
          <section className="space-y-4">
            {visible.map(action => (
              <ActionCard
                key={action.id}
                action={action}
                working={activeActionId === action.id}
                onApprove={() => approve(action)}
                onCancel={() => cancel(action)}
              />
            ))}
          </section>
        )}

        {error && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 max-w-[90vw] bg-bliss-terra-dark text-white rounded-full px-5 py-3 text-sm shadow-warm-lg">
            {error}
          </div>
        )}
      </main>
    </div>
  )
}

function ActionCard({
  action,
  working,
  onApprove,
  onCancel,
}: {
  action: ExternalAction
  working: boolean
  onApprove: () => void
  onCancel: () => void
}) {
  const t = useTranslations('actions')
  const locale = useLocale()
  const Icon = ACTION_ICONS[action.kind]
  const [copied, setCopied] = useState(false)
  const payload = action.approvedPayload ?? action.payload

  function downloadCalendar() {
    const content = action.result?.['content']
    if (typeof content !== 'string') return
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = typeof action.result?.['filename'] === 'string'
      ? action.result['filename']
      : 'bliss-event.ics'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function copyDraft() {
    const subject = String(action.result?.['subject'] ?? payload['subject'] ?? '')
    const body = String(action.result?.['body'] ?? payload['body'] ?? '')
    await navigator.clipboard.writeText(`${subject}\n\n${body}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2_000)
  }

  return (
    <article className="rounded-warm-xl bg-white/90 border border-white shadow-warm-lg overflow-hidden">
      <div className="p-5 md:p-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-full bg-bliss-sky-light flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-bliss-sky" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-xl text-bliss-ink">{t(`kind.${action.kind}`)}</h2>
              <span className={cn(
                'text-[10px] uppercase tracking-[0.12em] font-bold px-2.5 py-1 rounded-full',
                action.status === 'succeeded'
                  ? 'bg-bliss-sage-mist text-bliss-sage-dark'
                  : 'bg-bliss-terra-mist text-bliss-terra-dark',
              )}>{t(`status.${action.status}`)}</span>
            </div>

            <dl className="mt-4 space-y-2">
              {Object.entries(payload).map(([key, value]) => (
                <div key={key} className="grid grid-cols-[90px_1fr] gap-3 text-sm">
                  <dt className="text-bliss-muted">{fieldLabel(t, key)}</dt>
                  <dd className="text-bliss-ink-light whitespace-pre-wrap break-words">{actionValue(value, locale)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {(action.status === 'draft' || action.status === 'failed') && (
          <div className="mt-5 pt-5 border-t border-bliss-border/50">
            <p className="text-xs text-bliss-muted mb-3">
              {action.kind === 'send_email' ? t('approval.sendBoundary') : t('approval.boundary')}
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={onApprove} disabled={working} className="btn-primary py-2.5 px-5 text-xs flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                {working
                  ? t('approval.working')
                  : action.status === 'failed'
                    ? t('approval.retry')
                    : action.kind === 'send_email'
                      ? t('approval.send')
                      : t('approval.button')}
              </button>
              {action.status === 'draft' && (
                <button onClick={onCancel} className="btn-ghost text-xs flex items-center gap-1">
                  <X className="w-3 h-3" /> {t('approval.cancel')}
                </button>
              )}
            </div>
          </div>
        )}

        {(action.status === 'approved' || action.status === 'executing') && (
          <div className="mt-5 border-t border-bliss-border/50 pt-5 text-sm font-semibold text-bliss-sage-dark">
            {t('result.queued')}
          </div>
        )}

        {action.status === 'succeeded' && (
          <div className="mt-5 pt-5 border-t border-bliss-border/50">
            {action.kind === 'reminder' && (
              <p className="text-sm font-semibold text-bliss-sage-dark">
                {t('result.reminder', { date: actionValue(action.result?.['triggerAt'], locale) })}
              </p>
            )}
            {action.kind === 'calendar_event' && (
              <button onClick={downloadCalendar} className="btn-secondary py-2.5 px-5 text-xs flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> {t('result.download')}
              </button>
            )}
            {action.kind === 'draft_email' && (
              <button onClick={copyDraft} className="btn-secondary py-2.5 px-5 text-xs flex items-center gap-1.5">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />}
                {copied ? t('result.copied') : t('result.copy')}
              </button>
            )}
            {action.kind === 'send_email' && (
              <p className="text-sm font-semibold text-bliss-sage-dark">{t('result.sent')}</p>
            )}
            {action.kind === 'vendor_shortlist' && (
              <p className="text-sm font-semibold text-bliss-sage-dark">{t('result.shortlist')}</p>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

function fieldLabel(t: ReturnType<typeof useTranslations<'actions'>>, key: string): string {
  const known = ['title', 'triggerAt', 'startsAt', 'endsAt', 'location', 'note', 'subject', 'body', 'recipients', 'replyTo', 'criteria', 'maxResults']
  return known.includes(key) ? t(`field.${key}`) : key
}

function actionValue(value: unknown, locale: string): string {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'string') {
    const date = new Date(value)
    if (/^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    }
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return value == null ? '—' : JSON.stringify(value)
}
