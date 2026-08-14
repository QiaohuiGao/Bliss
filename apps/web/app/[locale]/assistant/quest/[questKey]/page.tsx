'use client'

import { type FormEvent, useEffect, useRef, useState } from 'react'
import type {
  ConfirmDecisionResult,
  DecisionProposal,
  MarriageLicenseLookupResponse,
  PlanningThread,
  QuestScopingOverview,
  ThreadMessage,
  Wedding,
} from '@bliss/types'
import { useLocale, useTranslations } from 'next-intl'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Heart,
  Leaf,
  ExternalLink,
  Send,
  ShieldCheck,
  Sparkles,
  Utensils,
} from 'lucide-react'
import { useRouter } from '@/i18n/routing'
import { api } from '@/lib/api'
import { useContent } from '@/lib/content'
import { useToken } from '@/lib/useToken'
import { cn } from '@/lib/utils'

const SCOPABLE_QUESTS = ['foundation', 'venue_date', 'wedding_party', 'guests_stationery', 'guest_experience', 'food_beverage', 'design_flowers', 'ceremony', 'registry_rings_honeymoon', 'legal', 'pre_wedding_events', 'final_30_and_day_of'] as const
type ScopableQuest = typeof SCOPABLE_QUESTS[number]

function isScopableQuest(value: string): value is ScopableQuest {
  return (SCOPABLE_QUESTS as readonly string[]).includes(value)
}

export default function QuestDecisionPage({ params }: { params: { questKey: string } }) {
  const { questKey } = params
  const t = useTranslations('assistant')
  const questT = useTranslations('quest')
  const locale = useLocale()
  const content = useContent()
  const router = useRouter()
  const getToken = useToken()
  const booted = useRef(false)
  const endRef = useRef<HTMLDivElement>(null)
  const [wedding, setWedding] = useState<Wedding | null>(null)
  const [thread, setThread] = useState<PlanningThread | null>(null)
  const [scoping, setScoping] = useState<QuestScopingOverview | null>(null)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [proposal, setProposal] = useState<DecisionProposal | null>(null)
  const [legalLookup, setLegalLookup] = useState<MarriageLicenseLookupResponse | 'unavailable' | null>(null)
  const [confirmation, setConfirmation] = useState<ConfirmDecisionResult | null>(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [feedbackState, setFeedbackState] = useState<'idle' | 'saving' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (booted.current || !isScopableQuest(questKey)) return
    const activeQuest = questKey
    booted.current = true
    async function load() {
      try {
        const token = await getToken()
        const currentWedding = await api.getMyWedding(token)
        const [threads, overview, authorityResult] = await Promise.all([
          api.getPlanningThreads(currentWedding.id, token),
          api.getQuestScoping(currentWedding.id, activeQuest, token),
          activeQuest === 'legal'
            ? api.getMarriageLicense(currentWedding.id, token).catch(() => 'unavailable' as const)
            : Promise.resolve(null),
        ])
        const currentThread = threads.find(item => item.questKey === activeQuest)
          ?? await api.createPlanningThread(currentWedding.id, token, activeQuest)
        const [currentMessages, latestProposal] = await Promise.all([
          api.getThreadMessages(currentWedding.id, currentThread.id, token),
          api.getLatestDecisionProposal(currentWedding.id, currentThread.id, token).catch(() => null),
        ])
        setWedding(currentWedding)
        setThread(currentThread)
        setScoping(overview)
        setLegalLookup(authorityResult)
        setMessages(currentMessages)
        setProposal(latestProposal)
      } catch {
        router.push('/onboarding')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [getToken, questKey, router])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, proposal, working])

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault()
    const message = draft.trim()
    if (!message || !wedding || !thread || working) return
    setDraft('')
    setWorking(true)
    setError(null)
    setProposal(null)
    setConfirmation(null)
    setFeedbackState('idle')
    try {
      const token = await getToken()
      const created = await api.createThreadMessage(wedding.id, thread.id, message, token)
      setMessages(current => [...current, { ...created, isCurrentUser: true }])
      const run = await api.runQuestScopingAgent(wedding.id, thread.id, token)
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
      setProposal(latestProposal)
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
      const overview = await api.getQuestScoping(wedding.id, questKey, token)
      setConfirmation(result)
      setProposal(current => current ? { ...current, status: 'confirmed' } : current)
      setScoping(overview)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('state.error'))
    } finally {
      setConfirming(false)
    }
  }

  async function submitFeedback(rating: -1 | 1) {
    if (!wedding || !proposal?.agentRunId || feedbackState === 'saving') return
    setFeedbackState('saving')
    try {
      const token = await getToken()
      await api.submitAgentFeedback(wedding.id, proposal.agentRunId, 'represented_both', rating, token)
      setFeedbackState('sent')
    } catch (caught) {
      setFeedbackState('idle')
      setError(caught instanceof Error ? caught.message : t('state.error'))
    }
  }

  if (!isScopableQuest(questKey)) {
    return <EmptyState body={t('questScoping.unsupported')} onBack={() => router.push('/board')} />
  }
  if (loading || !wedding || !thread || !scoping) {
    return (
      <div className="min-h-screen bg-gradient-dawn flex items-center justify-center px-6">
        <div className="text-center">
          <Leaf className="w-9 h-9 text-bliss-sage animate-sway mx-auto mb-4" />
          <p className="text-sm text-bliss-muted">{t('state.loading')}</p>
        </div>
      </div>
    )
  }

  const choiceLabel = (questionKey: string, value: string) => {
    const option = scoping.questions
      .find(question => question.questionKey === questionKey)
      ?.options.find(item => item.value === value)
    return content(option?.labelI18nKey ?? null, value.replaceAll('_', ' '))
  }

  return (
    <div className="min-h-screen bg-gradient-dawn relative overflow-hidden">
      <div className="fixed top-0 right-0 w-80 h-80 bg-bliss-terra-mist/45 rounded-full -translate-y-1/3 translate-x-1/3 blur-3xl pointer-events-none" />
      <header className="sticky top-0 z-30 bg-bliss-surface/80 backdrop-blur-xl border-b border-white/60">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => router.push('/board')} className="btn-ghost -ml-3 flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> {t('questScoping.backToQuest')}
          </button>
          <div className="flex items-center gap-2 text-xs text-bliss-muted">
            <Heart className="w-3.5 h-3.5 text-bliss-terra" /> {t('composer.privacy')}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-4 pt-8 pb-44">
        <section className="mb-8 text-center animate-slide-up">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/70 border border-white text-[11px] uppercase tracking-[0.18em] text-bliss-terra-dark font-bold mb-4">
            {questKey === 'food_beverage'
              ? <Utensils className="w-3.5 h-3.5" />
              : <Sparkles className="w-3.5 h-3.5" />}
            {t('questScoping.eyebrow')}
          </div>
          <h1 className="font-serif text-3xl md:text-4xl text-bliss-ink mb-3">{content(scoping.titleI18nKey, questKey)}</h1>
          <p className="text-sm md:text-base text-bliss-ink-light max-w-xl mx-auto leading-relaxed">
            {content(scoping.subtitleI18nKey, '')} {t('questScoping.genericSubtitle')}
          </p>
          {questKey === 'legal' && (
            <>
              <p className="mt-4 mx-auto max-w-xl rounded-warm bg-bliss-terra-mist/60 px-4 py-3 text-xs leading-relaxed text-bliss-terra-dark">
                {questT('legal.disclaimer')}
              </p>
              <LegalAuthorityCard lookup={legalLookup} locale={locale} />
            </>
          )}
        </section>

        <section className="card p-5 md:p-6 mb-6 animate-slide-up">
            <h2 className="font-serif text-xl text-bliss-ink">{t('questScoping.introTitle')}</h2>
            {messages.length === 0 && <p className="text-sm text-bliss-muted mt-1 mb-5">{t('questScoping.introBody')}</p>}
            <div className={cn('space-y-4', messages.length > 0 && 'mt-4')}>
              {scoping.questions.map(question => (
                <div key={question.questionKey} className="rounded-warm border border-bliss-border/60 bg-bliss-cream/45 p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <p className="font-semibold text-sm text-bliss-ink">{content(question.promptI18nKey, question.questionKey)}</p>
                    <span className={cn(
                      'shrink-0 text-[10px] px-2 py-1 rounded-full',
                      question.source === 'confirmed'
                        ? 'bg-bliss-sage-mist text-bliss-sage-dark'
                        : 'bg-bliss-linen text-bliss-muted',
                    )}>
                      {question.source === 'confirmed' ? t('questScoping.currentConfirmed') : t('questScoping.currentAssumed')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {question.options.map(option => {
                      const label = content(option.labelI18nKey, option.value)
                      return (
                        <button
                          key={option.value}
                          onClick={() => setDraft(t('questScoping.leaning', { choice: label }))}
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-xs transition-colors',
                            question.currentChoice === option.value
                              ? 'border-bliss-sage bg-bliss-sage-mist text-bliss-sage-dark font-semibold'
                              : 'border-bliss-border bg-white text-bliss-ink-light hover:border-bliss-sage',
                          )}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

        <section className="space-y-4" aria-live="polite">
          {messages.filter(message => message.authorType === 'user' || message.authorType === 'assistant').map(message => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {working && (
            <div className="flex items-center gap-3 text-sm text-bliss-muted px-2 py-3">
              <div className="w-8 h-8 rounded-full bg-bliss-sage-dark text-white flex items-center justify-center animate-pulse">
                <Sparkles className="w-4 h-4" />
              </div>
              {t('composer.thinking')}
            </div>
          )}
          {proposal && (
            <DecisionCard
              proposal={proposal}
              choiceLabel={proposal.proposedChoice ? choiceLabel(proposal.questionKey, proposal.proposedChoice) : null}
              confirmation={confirmation}
              confirming={confirming}
              feedbackState={feedbackState}
              onConfirm={confirmProposal}
              onFeedback={submitFeedback}
            />
          )}
          {error && <div className="rounded-warm bg-white/80 border border-bliss-terra-light px-4 py-3 text-sm text-bliss-terra-dark">{error}</div>}
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

function LegalAuthorityCard({
  lookup,
  locale,
}: {
  lookup: MarriageLicenseLookupResponse | 'unavailable' | null
  locale: string
}) {
  const t = useTranslations('assistant')
  const questT = useTranslations('quest')
  if (!lookup) return null
  if (lookup === 'unavailable' || lookup.status === 'verification_required') {
    return (
      <div className="mt-4 mx-auto max-w-xl rounded-warm border border-bliss-border/70 bg-white/75 px-4 py-4 text-left">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-bliss-terra-dark" />
          <div>
            <p className="text-sm font-semibold text-bliss-ink">{t('legalLookup.unavailableTitle')}</p>
            <p className="mt-1 text-xs leading-relaxed text-bliss-muted">{t('legalLookup.unavailableBody')}</p>
          </div>
        </div>
      </div>
    )
  }

  const checked = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })
    .format(new Date(lookup.rule.verifiedAt))
  return (
    <div className="mt-4 mx-auto max-w-xl rounded-warm border border-bliss-sage-light/70 bg-white/85 px-4 py-4 text-left shadow-warm">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-bliss-sage-dark" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-bliss-ink">{t('legalLookup.verifiedTitle')}</p>
            <p className="text-[11px] text-bliss-muted">{t('legalLookup.checked', { date: checked })}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-bliss-ink-light">
            <span className="rounded-full bg-bliss-sage-mist px-2.5 py-1">
              {questT('legal.waitingPeriod', { hours: lookup.rule.waitingPeriodHours })}
            </span>
            <span className="rounded-full bg-bliss-sage-mist px-2.5 py-1">
              {questT('legal.validity', { days: lookup.rule.validityDays })}
            </span>
            <span className="rounded-full bg-bliss-sage-mist px-2.5 py-1">
              {questT('legal.witnesses', { count: lookup.rule.witnessesRequired })}
            </span>
          </div>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-bliss-muted">
            {t('legalLookup.sources')}
          </p>
          <div className="mt-1.5 space-y-1.5">
            {lookup.rule.sources.map(source => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-1.5 text-xs text-bliss-sage-dark underline decoration-bliss-sage-light underline-offset-2"
              >
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{source.publisher}: {source.title}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ThreadMessage }) {
  const t = useTranslations('assistant')
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

function DecisionCard({
  proposal,
  choiceLabel,
  confirmation,
  confirming,
  feedbackState,
  onConfirm,
  onFeedback,
}: {
  proposal: DecisionProposal
  choiceLabel: string | null
  confirmation: ConfirmDecisionResult | null
  confirming: boolean
  feedbackState: 'idle' | 'saving' | 'sent'
  onConfirm: () => void
  onFeedback: (rating: -1 | 1) => void
}) {
  const t = useTranslations('assistant')
  const content = useContent()
  const confirmed = proposal.status === 'confirmed' || Boolean(confirmation)
  return (
    <article className="rounded-warm-xl bg-white/90 border border-white shadow-warm-xl overflow-hidden animate-scale-in mt-6">
      <div className={cn(
        'px-5 md:px-7 py-5 border-b',
        proposal.state === 'ready' ? 'bg-bliss-sage-mist/80 border-bliss-sage-light/60' : 'bg-bliss-terra-mist/70 border-bliss-terra-light/60',
      )}>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-bliss-ink-light mb-2">
          {proposal.state === 'ready' ? <CheckCircle2 className="w-4 h-4 text-bliss-sage-dark" /> : <Heart className="w-4 h-4 text-bliss-terra-dark" />}
          {t(`decision.${proposal.state}`)}
        </div>
        {choiceLabel && <h2 className="font-serif text-2xl text-bliss-ink">{choiceLabel}</h2>}
        <p className="text-sm text-bliss-ink-light mt-2">{proposal.summary}</p>
        {proposal.reason && <p className="text-sm font-semibold text-bliss-ink mt-3">{proposal.reason}</p>}
      </div>
      <div className="p-5 md:p-7 space-y-5">
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
        {proposal.momentCandidate && (
          <div className="rounded-warm bg-bliss-terra-mist/60 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-bliss-terra-dark">{t('decision.moment')}</p>
            <p className="font-serif text-lg text-bliss-ink mt-1">{proposal.momentCandidate.title}</p>
            <p className="text-sm text-bliss-ink-light mt-1">{proposal.momentCandidate.narrative}</p>
          </div>
        )}
        {confirmed ? (
          <div className="rounded-warm bg-bliss-sage-mist p-4 flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-bliss-sage-dark shrink-0" />
            <div><p className="font-bold text-sm text-bliss-ink">{t('decision.confirmed')}</p><p className="text-xs text-bliss-ink-light mt-1">{t('decision.confirmedBody')}</p></div>
          </div>
        ) : proposal.state === 'ready' ? (
          <button onClick={onConfirm} disabled={confirming} className="btn-primary w-full flex items-center justify-center gap-2">
            <Check className="w-4 h-4" /> {confirming ? t('decision.confirming') : t('decision.confirm')}
          </button>
        ) : <p className="text-center text-sm font-semibold text-bliss-terra-dark">{t('decision.keepTalking')}</p>}
        {proposal.agentRunId && (
          <div className="border-t border-bliss-border/60 pt-5 text-center">
            {feedbackState === 'sent' ? <p className="text-xs text-bliss-muted">{t('feedback.thanks')}</p> : <>
              <p className="text-xs font-semibold text-bliss-ink-light mb-3">{t('feedback.question')}</p>
              <div className="flex justify-center gap-2">
                <button onClick={() => onFeedback(1)} disabled={feedbackState === 'saving'} className="btn-secondary px-4 py-2 text-xs">{t('feedback.yes')}</button>
                <button onClick={() => onFeedback(-1)} disabled={feedbackState === 'saving'} className="btn-ghost px-4 py-2 text-xs">{t('feedback.notQuite')}</button>
              </div>
            </>}
          </div>
        )}
      </div>
    </article>
  )
}

function EmptyState({ body, onBack }: { body: string; onBack: () => void }) {
  const t = useTranslations('assistant')
  return (
    <div className="min-h-screen bg-gradient-dawn flex items-center justify-center p-6">
      <div className="card max-w-md p-8 text-center">
        <Sparkles className="w-8 h-8 text-bliss-sage mx-auto mb-4" />
        <p className="text-sm text-bliss-ink-light">{body}</p>
        <button onClick={onBack} className="btn-secondary mt-5">{t('questScoping.backToQuest')}</button>
      </div>
    </div>
  )
}
