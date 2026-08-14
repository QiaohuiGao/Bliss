'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type {
  ConfirmDecisionResult,
  DecisionProposal,
  PlanningThread,
  ThreadMessage,
  Wedding,
} from '@bliss/types'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ExternalLink,
  Heart,
  Leaf,
  Search,
  Send,
  Sparkles,
} from 'lucide-react'
import { useRouter } from '@/i18n/routing'
import { api } from '@/lib/api'
import { useContent } from '@/lib/content'
import { useToken } from '@/lib/useToken'
import { cn } from '@/lib/utils'

export default function PhotographerAssistantPage() {
  const t = useTranslations('photographer')
  const router = useRouter()
  const getToken = useToken()
  const booted = useRef(false)
  const endRef = useRef<HTMLDivElement>(null)
  const [wedding, setWedding] = useState<Wedding | null>(null)
  const [thread, setThread] = useState<PlanningThread | null>(null)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [proposal, setProposal] = useState<DecisionProposal | null>(null)
  const [confirmation, setConfirmation] = useState<ConfirmDecisionResult | null>(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [feedbackState, setFeedbackState] = useState<'idle' | 'saving' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    async function load() {
      try {
        const token = await getToken()
        const currentWedding = await api.getMyWedding(token)
        const threads = await api.getPlanningThreads(currentWedding.id, token)
        const currentThread = threads.find(item => item.questKey === 'vendor_team')
          ?? await api.createPlanningThread(currentWedding.id, token, 'vendor_team')
        const [currentMessages, latestProposal] = await Promise.all([
          api.getThreadMessages(currentWedding.id, currentThread.id, token),
          api.getLatestDecisionProposal(currentWedding.id, currentThread.id, token).catch(() => null),
        ])
        setWedding(currentWedding)
        setThread(currentThread)
        setMessages(currentMessages)
        setProposal(latestProposal)
      } catch {
        router.push('/onboarding')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [getToken, router])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, proposal, working])

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault()
    const content = draft.trim()
    if (!content || !wedding || !thread || working) return
    setDraft('')
    setError(null)
    setWorking(true)
    setConfirmation(null)
    setProposal(null)
    setFeedbackState('idle')
    try {
      const token = await getToken()
      const created = await api.createThreadMessage(wedding.id, thread.id, content, token)
      setMessages(current => [...current, { ...created, isCurrentUser: true }])
      const run = await api.runPhotographerAgent(wedding.id, thread.id, token)
      if (run.stopReason !== 'natural' && run.stopReason !== 'terminal_tool') {
        throw new Error(t('state.error'))
      }
      const [freshMessages, latestProposal] = await Promise.all([
        api.getThreadMessages(wedding.id, thread.id, token),
        run.proposal
          ? api.getLatestDecisionProposal(wedding.id, thread.id, token)
          : Promise.resolve(null),
      ])
      setMessages(freshMessages)
      if (latestProposal) setProposal(latestProposal)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('state.error'))
    } finally {
      setWorking(false)
    }
  }

  async function confirmProposal() {
    if (!wedding || !proposal || confirming) return
    setConfirming(true)
    setError(null)
    try {
      const token = await getToken()
      const result = await api.confirmDecisionProposal(
        wedding.id,
        proposal.id,
        crypto.randomUUID(),
        token,
      )
      setConfirmation(result)
      setProposal(current => current ? { ...current, status: 'confirmed' } : current)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('state.error'))
    } finally {
      setConfirming(false)
    }
  }

  async function submitFeedback(rating: -1 | 1) {
    if (!wedding || !proposal?.agentRunId || feedbackState === 'saving') return
    setFeedbackState('saving')
    setError(null)
    try {
      const token = await getToken()
      await api.submitAgentFeedback(
        wedding.id,
        proposal.agentRunId,
        'represented_both',
        rating,
        token,
      )
      setFeedbackState('sent')
    } catch (caught) {
      setFeedbackState('idle')
      setError(caught instanceof Error ? caught.message : t('state.error'))
    }
  }

  if (loading || !wedding || !thread) {
    return (
      <div className="min-h-screen bg-gradient-dawn flex items-center justify-center px-6">
        <div className="text-center">
          <Leaf className="w-9 h-9 text-bliss-sage animate-sway mx-auto mb-4" />
          <p className="text-sm text-bliss-muted">{t('state.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-dawn relative overflow-hidden">
      <div className="fixed top-0 right-0 w-96 h-96 bg-bliss-sky-light/40 rounded-full -translate-y-1/3 translate-x-1/3 blur-3xl pointer-events-none" />
      <header className="sticky top-0 z-30 bg-bliss-surface/80 backdrop-blur-xl border-b border-white/60">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => router.push('/dashboard')} className="btn-ghost -ml-3 flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-serif text-lg">Bliss</span>
          </button>
          <div className="flex items-center gap-2 text-xs text-bliss-muted">
            <Heart className="w-3.5 h-3.5 text-bliss-terra" /> {t('composer.privacy')}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-4 pt-8 pb-44">
        <section className="mb-8 text-center animate-slide-up">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/70 border border-white text-[11px] uppercase tracking-[0.18em] text-bliss-sky font-bold mb-4">
            <Search className="w-3.5 h-3.5" /> {t('eyebrow')}
          </div>
          <h1 className="font-serif text-3xl md:text-4xl text-bliss-ink mb-3">{t('title')}</h1>
          <p className="text-sm md:text-base text-bliss-ink-light max-w-xl mx-auto leading-relaxed">{t('subtitle')}</p>
        </section>

        {messages.length === 0 && (
          <section className="card p-5 md:p-6 mb-6 animate-slide-up">
            <h2 className="font-serif text-xl text-bliss-ink">{t('intro.title')}</h2>
            <p className="text-sm text-bliss-muted mt-1 mb-5">{t('intro.body')}</p>
            <div className="grid gap-2">
              {(['promptDocumentary', 'promptEditorial', 'promptClassic'] as const).map(key => (
                <button
                  key={key}
                  onClick={() => setDraft(t(`intro.${key}`))}
                  className="text-left rounded-warm border border-bliss-border/70 bg-bliss-cream/60 px-4 py-3 text-sm text-bliss-ink-light hover:bg-white hover:border-bliss-sky transition-all"
                >
                  {t(`intro.${key}`)}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-4" aria-live="polite">
          {messages.filter(message => message.authorType === 'user' || message.authorType === 'assistant').map(message => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {working && (
            <div className="flex items-center gap-3 text-sm text-bliss-muted px-2 py-3">
              <div className="w-8 h-8 rounded-full bg-bliss-sage-dark text-white flex items-center justify-center animate-pulse">
                <Search className="w-4 h-4" />
              </div>
              {t('composer.thinking')}
            </div>
          )}
          {proposal && (
            <PhotographerDecisionCard
              proposal={proposal}
              confirmation={confirmation}
              confirming={confirming}
              onConfirm={confirmProposal}
              onActions={() => router.push('/actions')}
              feedbackState={feedbackState}
              onFeedback={submitFeedback}
            />
          )}
          {error && (
            <div className="rounded-warm bg-white/80 border border-bliss-terra-light px-4 py-3 text-sm text-bliss-terra-dark">{error}</div>
          )}
          <div ref={endRef} />
        </section>
      </main>

      <div className="fixed bottom-0 inset-x-0 z-30 bg-gradient-to-t from-bliss-surface via-bliss-surface/95 to-transparent pt-8 pb-5 px-4">
        <form onSubmit={sendMessage} className="max-w-3xl mx-auto flex items-end gap-2 rounded-warm-lg bg-white border border-bliss-border/70 shadow-warm-lg p-2">
          <textarea
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void sendMessage()
              }
            }}
            rows={1}
            maxLength={12_000}
            placeholder={t('composer.placeholder')}
            className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-bliss-ink placeholder:text-bliss-muted focus:outline-none max-h-32"
          />
          <button type="submit" disabled={!draft.trim() || working} aria-label={t('composer.send')} className="w-11 h-11 rounded-full bg-bliss-sage-dark text-white flex items-center justify-center disabled:opacity-40 hover:bg-bliss-sage-deep active:scale-95 shrink-0">
            <Send className="w-4.5 h-4.5" />
          </button>
        </form>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ThreadMessage }) {
  const t = useTranslations('photographer')
  const isBliss = message.authorType === 'assistant'
  const label = isBliss ? t('speaker.bliss') : message.isCurrentUser ? t('speaker.you') : t('speaker.partner')
  return (
    <div className={cn('flex gap-3', !isBliss && 'justify-end')}>
      {isBliss && <div className="w-8 h-8 rounded-full bg-bliss-sage-dark text-white flex items-center justify-center shrink-0 mt-5"><Sparkles className="w-4 h-4" /></div>}
      <div className={cn('max-w-[85%]', !isBliss && 'text-right')}>
        <p className="text-[11px] text-bliss-muted mb-1 px-1">{label}</p>
        <div className={cn(
          'rounded-warm-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-left',
          isBliss ? 'bg-white/85 border border-white shadow-warm text-bliss-ink' : 'bg-bliss-sage-dark text-white rounded-br-sm',
        )}>{message.content}</div>
      </div>
    </div>
  )
}

function PhotographerDecisionCard({
  proposal,
  confirmation,
  confirming,
  onConfirm,
  onActions,
  feedbackState,
  onFeedback,
}: {
  proposal: DecisionProposal
  confirmation: ConfirmDecisionResult | null
  confirming: boolean
  onConfirm: () => void
  onActions: () => void
  feedbackState: 'idle' | 'saving' | 'sent'
  onFeedback: (rating: -1 | 1) => void
}) {
  const t = useTranslations('photographer')
  const content = useContent()
  const confirmed = proposal.status === 'confirmed' || Boolean(confirmation)
  return (
    <article className="rounded-warm-xl bg-white/90 border border-white shadow-warm-xl overflow-hidden animate-scale-in mt-6">
      <div className={cn(
        'px-5 md:px-7 py-5 border-b',
        proposal.state === 'ready' ? 'bg-bliss-sky-light/70 border-bliss-sky/20' : 'bg-bliss-terra-mist/70 border-bliss-terra-light/60',
      )}>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-bliss-ink-light mb-2">
          {proposal.state === 'ready' ? <CheckCircle2 className="w-4 h-4 text-bliss-sage-dark" /> : <Heart className="w-4 h-4 text-bliss-terra-dark" />}
          {t(`decision.${proposal.state}`)}
        </div>
        {proposal.proposedChoice && <h2 className="font-serif text-2xl text-bliss-ink">{t(`coverage.${proposal.proposedChoice}`)}</h2>}
        <p className="text-sm text-bliss-ink-light leading-relaxed mt-2">{proposal.summary}</p>
        {proposal.reason && <p className="text-sm font-semibold text-bliss-ink mt-3">{proposal.reason}</p>}
      </div>

      <div className="p-5 md:p-7 space-y-6">
        {proposal.vendorEffects.length > 0 && (
          <section>
            <h3 className="font-serif text-xl text-bliss-ink mb-3">{t('decision.vendors')}</h3>
            <div className="space-y-3">
              {proposal.vendorEffects.map((vendor, index) => (
                <div key={vendor.candidateId} className="rounded-warm border border-bliss-border/60 bg-bliss-cream/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-bliss-muted mb-1">#{index + 1}</p>
                      <h4 className="font-serif text-lg text-bliss-ink">{vendor.candidate?.name ?? vendor.candidateId}</h4>
                      {vendor.candidate?.priceLevel && <p className="text-xs text-bliss-muted mt-0.5">{vendor.candidate.priceLevel}</p>}
                    </div>
                    {vendor.candidate?.sourceUrl && (
                      <a href={vendor.candidate.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-bliss-sage-dark flex items-center gap-1 hover:underline">
                        {t('decision.source')} <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-sm text-bliss-ink-light mt-2">{vendor.rationale}</p>
                  <div className="grid sm:grid-cols-2 gap-3 mt-3 text-xs">
                    <div>
                      <p className="font-bold text-bliss-sage-dark mb-1">{t('decision.pros')}</p>
                      <ul className="space-y-1">{vendor.pros.map(item => <li key={item}>· {item}</li>)}</ul>
                    </div>
                    <div>
                      <p className="font-bold text-bliss-terra-dark mb-1">{t('decision.concerns')}</p>
                      <ul className="space-y-1">{vendor.concerns.map(item => <li key={item}>· {item}</li>)}</ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {proposal.taskEffects.length > 0 && (
          <section>
            <h3 className="font-serif text-lg text-bliss-ink mb-3">{t('decision.tasks')}</h3>
            <ul className="space-y-2">
              {proposal.taskEffects.map(task => (
                <li key={task.taskKey} className="flex gap-2 text-sm text-bliss-ink-light">
                  <Check className="w-4 h-4 text-bliss-sage-dark shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-bliss-ink">
                      {content(`quest.${proposal.questKey}.task.${task.taskKey}.title`, task.taskKey.replaceAll('_', ' '))}
                    </p>
                    <p className="text-xs mt-0.5">{task.rationale}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {confirmed ? (
          <div className="rounded-warm bg-bliss-sage-mist p-4">
            <p className="font-bold text-sm text-bliss-ink">{t('decision.confirmed')}</p>
            <p className="text-xs text-bliss-ink-light mt-1">{t('decision.confirmedBody')}</p>
            {proposal.externalActions.length > 0 && <button onClick={onActions} className="text-xs font-bold text-bliss-sage-dark mt-3 hover:underline">{t('decision.actions')}</button>}
          </div>
        ) : proposal.state === 'ready' ? (
          <button onClick={onConfirm} disabled={confirming} className="btn-primary w-full flex items-center justify-center gap-2">
            <Check className="w-4 h-4" /> {confirming ? t('decision.confirming') : t('decision.confirm')}
          </button>
        ) : (
          <p className="text-center text-sm font-semibold text-bliss-terra-dark">{t('decision.keepTalking')}</p>
        )}

        {proposal.agentRunId && (
          <FeedbackQuestion state={feedbackState} onFeedback={onFeedback} />
        )}
      </div>
    </article>
  )
}

function FeedbackQuestion({
  state,
  onFeedback,
}: {
  state: 'idle' | 'saving' | 'sent'
  onFeedback: (rating: -1 | 1) => void
}) {
  const t = useTranslations('photographer')
  if (state === 'sent') {
    return <p className="text-center text-xs text-bliss-muted">{t('feedback.thanks')}</p>
  }
  return (
    <div className="border-t border-bliss-border/60 pt-5 text-center">
      <p className="text-xs font-semibold text-bliss-ink-light mb-3">{t('feedback.question')}</p>
      <div className="flex justify-center gap-2">
        <button onClick={() => onFeedback(1)} disabled={state === 'saving'} className="btn-secondary px-4 py-2 text-xs">
          {t('feedback.yes')}
        </button>
        <button onClick={() => onFeedback(-1)} disabled={state === 'saving'} className="btn-ghost px-4 py-2 text-xs">
          {t('feedback.notQuite')}
        </button>
      </div>
    </div>
  )
}
