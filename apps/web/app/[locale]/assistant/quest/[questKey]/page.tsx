'use client'

import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ConfirmDecisionResult,
  DecisionProposal,
  MarriageLicenseLookupResponse,
  PlanningThread,
  QuestProgress,
  QuestScopingOverview,
  QuestionProgressStatus,
  ThreadMessage,
  Wedding,
} from '@bliss/types'
import { useLocale, useTranslations } from 'next-intl'
import { Check, ExternalLink, Send } from 'lucide-react'
import { useRouter } from '@/i18n/routing'
import { api } from '@/lib/api'
import { useContent } from '@/lib/content'
import { useToken } from '@/lib/useToken'
import styles from './workspace.module.css'

const SCOPABLE_QUESTS = [
  'foundation', 'venue_date', 'wedding_party', 'guests_stationery',
  'guest_experience', 'food_beverage', 'design_flowers', 'ceremony',
  'registry_rings_honeymoon', 'legal', 'pre_wedding_events', 'final_30_and_day_of',
] as const
type ScopableQuest = typeof SCOPABLE_QUESTS[number]

const JOURNEY_QUESTS = [
  'foundation', 'venue_date', 'vendor_team', 'wedding_party', 'attire_beauty',
  'guests_stationery', 'guest_experience', 'food_beverage', 'design_flowers',
  'ceremony', 'registry_rings_honeymoon', 'legal', 'pre_wedding_events',
  'final_30_and_day_of',
] as const

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
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const [wedding, setWedding] = useState<Wedding | null>(null)
  const [couple, setCouple] = useState({ first: '', second: '' })
  const [threads, setThreads] = useState<PlanningThread[]>([])
  const [thread, setThread] = useState<PlanningThread | null>(null)
  const [progress, setProgress] = useState<QuestProgress[]>([])
  const [scoping, setScoping] = useState<QuestScopingOverview | null>(null)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [proposal, setProposal] = useState<DecisionProposal | null>(null)
  const [legalLookup, setLegalLookup] = useState<MarriageLicenseLookupResponse | 'unavailable' | null>(null)
  const [confirmation, setConfirmation] = useState<ConfirmDecisionResult | null>(null)
  const [draft, setDraft] = useState('')
  const [otherQuestionKey, setOtherQuestionKey] = useState<string | null>(null)
  const [otherDraft, setOtherDraft] = useState('')
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
        const [dashboard, nextThreads, overview, nextProgress, authorityResult] = await Promise.all([
          api.getDashboard(currentWedding.id, token),
          api.getPlanningThreads(currentWedding.id, token),
          api.getQuestScoping(currentWedding.id, activeQuest, token),
          api.getQuestProgress(currentWedding.id, token),
          activeQuest === 'legal'
            ? api.getMarriageLicense(currentWedding.id, token).catch(() => 'unavailable' as const)
            : Promise.resolve(null),
        ])
        const currentMember = dashboard.couple.members.find(member => member.isCurrentUser)?.displayName
        const partnerMember = dashboard.couple.members.find(member => !member.isCurrentUser)?.displayName
        const currentThread = nextThreads.find(item =>
          item.questKey === activeQuest && item.questionKey !== null
        ) ?? null
        const [currentMessages, latestProposal] = currentThread
          ? await Promise.all([
              api.getThreadMessages(currentWedding.id, currentThread.id, token),
              api.getLatestDecisionProposal(currentWedding.id, currentThread.id, token).catch(() => null),
            ])
          : [[], null]
        setWedding(currentWedding)
        setCouple({
          first: currentMember ?? t('workspace.you'),
          second: partnerMember ?? currentWedding.partnerDisplayName ?? t('workspace.partner'),
        })
        setThreads(nextThreads)
        setThread(currentThread)
        setProgress(nextProgress)
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
  }, [getToken, questKey, router, t])

  async function resolveQuestionThread(questionKey: string, token: string) {
    if (!wedding) throw new Error(t('state.error'))
    let target = threads.find(item =>
      item.questKey === questKey && item.questionKey === questionKey
    )
    if (!target) {
      target = await api.createPlanningThread(wedding.id, token, questKey as ScopableQuest, questionKey)
      setThreads(current => current.some(item => item.id === target!.id) ? current : [target!, ...current])
    }
    const [nextMessages, nextProposal] = await Promise.all([
      api.getThreadMessages(wedding.id, target.id, token),
      api.getLatestDecisionProposal(wedding.id, target.id, token).catch(() => null),
    ])
    setThread(target)
    setMessages(nextMessages)
    setProposal(nextProposal)
    setConfirmation(null)
    setFeedbackState('idle')
    return target
  }

  async function refreshProgress(token: string) {
    if (!wedding) return
    setProgress(await api.getQuestProgress(wedding.id, token))
  }

  async function openQuestion(questionKey: string, nextDraft?: string) {
    if (!wedding || working) return
    setWorking(true)
    setError(null)
    setOtherQuestionKey(null)
    try {
      const token = await getToken()
      await resolveQuestionThread(questionKey, token)
      await refreshProgress(token)
      if (nextDraft !== undefined) {
        setDraft(nextDraft)
        window.setTimeout(() => composerRef.current?.focus(), 0)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('state.error'))
    } finally {
      setWorking(false)
    }
  }

  async function runThreadMessage(target: PlanningThread, message: string, token: string) {
    if (!wedding) return
    setProposal(null)
    setConfirmation(null)
    setFeedbackState('idle')
    const created = await api.createThreadMessage(wedding.id, target.id, message, token)
    setMessages(current => [...current, { ...created, isCurrentUser: true }])
    const run = await api.runQuestScopingAgent(wedding.id, target.id, token)
    if (run.stopReason !== 'natural' && run.stopReason !== 'terminal_tool') {
      throw new Error(t('state.error'))
    }
    const [freshMessages, latestProposal] = await Promise.all([
      api.getThreadMessages(wedding.id, target.id, token),
      run.proposal
        ? api.getLatestDecisionProposal(wedding.id, target.id, token)
        : Promise.resolve(null),
    ])
    setMessages(freshMessages)
    setProposal(latestProposal)
    await refreshProgress(token)
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault()
    const message = draft.trim()
    if (!message || !wedding || !thread || working) return
    setDraft('')
    setWorking(true)
    setError(null)
    try {
      const token = await getToken()
      await runThreadMessage(thread, message, token)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('state.error'))
    } finally {
      setWorking(false)
    }
  }

  async function sendOtherIdea(event: FormEvent, questionKey: string) {
    event.preventDefault()
    const message = otherDraft.trim()
    if (!message || !wedding || working) return
    setWorking(true)
    setError(null)
    try {
      const token = await getToken()
      const target = await resolveQuestionThread(questionKey, token)
      setOtherDraft('')
      setOtherQuestionKey(null)
      await runThreadMessage(target, message, token)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('state.error'))
    } finally {
      setWorking(false)
    }
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, proposal, working])

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
      const [overview, nextProgress] = await Promise.all([
        api.getQuestScoping(wedding.id, questKey, token),
        api.getQuestProgress(wedding.id, token),
      ])
      setConfirmation(result)
      setProposal(current => current ? { ...current, status: 'confirmed' } : current)
      setScoping(overview)
      setProgress(nextProgress)
      setThread(current => current ? { ...current, status: 'open', currentDecisionId: result.decisionId } : current)
      setThreads(current => current.map(item => item.id === proposal.threadId
        ? { ...item, status: 'open', currentDecisionId: result.decisionId }
        : item))
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

  const activeQuestion = useMemo(() => {
    if (!scoping) return null
    return scoping.questions.find(question => question.questionKey === thread?.questionKey)
      ?? scoping.questions[0]
      ?? null
  }, [scoping, thread?.questionKey])

  if (!isScopableQuest(questKey)) {
    return <EmptyState body={t('questScoping.unsupported')} onBack={() => router.push('/board')} />
  }
  if (loading || !wedding || !scoping) {
    return <div className={styles.loading}>{t('state.loading')}</div>
  }

  const activeQuestProgress = progress.find(item => item.questKey === questKey)
  const confirmedTotal = progress.reduce((total, item) => total + item.confirmedCount, 0)
  const questionStatus = (questionKey: string): QuestionProgressStatus =>
    activeQuestProgress?.questions.find(item => item.questionKey === questionKey)?.status ?? 'not_started'
  const choiceLabel = (questionKey: string, value: string) => {
    const option = scoping.questions.find(question => question.questionKey === questionKey)
      ?.options.find(item => item.value === value)
    return content(option?.labelI18nKey ?? null, value.replaceAll('_', ' '))
  }
  const dateLabel = wedding.weddingDate
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${wedding.weddingDate}T12:00:00`))
    : t('workspace.dateOpen')

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <div className={styles.logo}><span className={styles.logoMark}>b</span><span>{t('workspace.brand')}</span></div>
        <div className={styles.weddingName}>
          <strong>{t('workspace.couple', couple)}</strong>
          <span>{dateLabel}{wedding.city ? ` · ${wedding.city}` : ''}</span>
        </div>
        <div className={styles.topActions}>
          <div className={styles.avatarStack} aria-label={t('workspace.members')}>
            <span className={styles.avatar}>{couple.first.slice(0, 1).toUpperCase()}</span>
            <span className={styles.avatar}>{couple.second.slice(0, 1).toUpperCase()}</span>
          </div>
          <button type="button" className={styles.quietButton} onClick={() => router.push('/board')}>
            {t('workspace.allPlanning')}
          </button>
        </div>
      </header>

      <section className={styles.journey} aria-label={t('workspace.journeyLabel')}>
        <div className={styles.journeyTitle}>
          <span className={styles.microLabel}>{t('workspace.ourWedding')}</span>
          <strong>{t('workspace.chaptersTitle')}</strong>
          <small>{t('workspace.chaptersBody')}</small>
        </div>
        <nav className={styles.chapterTrack} aria-label={t('workspace.chaptersLabel')}>
          {JOURNEY_QUESTS.map(chapterKey => {
            const chapterProgress = progress.find(item => item.questKey === chapterKey)
            const href = chapterKey === 'attire_beauty'
              ? '/assistant'
              : chapterKey === 'vendor_team'
                ? '/assistant/photographer'
                : `/assistant/quest/${chapterKey}`
            return (
              <button
                key={chapterKey}
                type="button"
                className={styles.chapter}
                data-status={chapterProgress?.status ?? 'not_started'}
                aria-current={chapterKey === questKey ? 'step' : undefined}
                title={content(`quest.${chapterKey}.title`, chapterKey.replaceAll('_', ' '))}
                onClick={() => router.push(href)}
              >
                <span className={styles.chapterDot} />
                <span className={styles.chapterName}>{content(`quest.${chapterKey}.title`, chapterKey.replaceAll('_', ' '))}</span>
              </button>
            )
          })}
        </nav>
        <div className={styles.journeyProgress}>
          <strong>{confirmedTotal}</strong>
          <span>{t('workspace.decisionsMade')}</span>
        </div>
      </section>

      <div className={styles.workspace}>
        <aside className={styles.questPanel}>
          <header className={styles.questHead}>
            <span className={styles.microLabel}>{t('workspace.currentChapter', { number: JOURNEY_QUESTS.indexOf(questKey as typeof JOURNEY_QUESTS[number]) + 1 })}</span>
            <h1>{content(scoping.titleI18nKey, questKey)}</h1>
            <p>{content(scoping.subtitleI18nKey, t('questScoping.genericSubtitle'))}</p>
          </header>
          <section className={styles.questionProgress}>
            <h2 className={styles.panelTitle}>
              {t('workspace.questionsTitle')}
              <span>{t('workspace.questionCount', { confirmed: activeQuestProgress?.confirmedCount ?? 0, total: scoping.questions.length })}</span>
            </h2>
            <ol className={styles.questions}>
              {scoping.questions.map((question, index) => {
                const status = questionStatus(question.questionKey)
                return (
                  <li key={question.questionKey}>
                    <button
                      type="button"
                      className={styles.questionButton}
                      data-status={status}
                      data-active={activeQuestion?.questionKey === question.questionKey}
                      onClick={() => void openQuestion(question.questionKey)}
                      disabled={working}
                    >
                      <span className={styles.questionMark}>{status === 'confirmed' ? '✓' : index + 1}</span>
                      <span className={styles.questionCopy}>
                        <strong>{content(question.promptI18nKey, question.questionKey)}</strong>
                        <span>{t(`workspace.questionStatus.${status}`)}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </section>
          <div className={styles.questNote}>
            <strong>{t('workspace.resourceTitle')}</strong>
            {t('workspace.resourceBody')}
          </div>
        </aside>

        <main className={styles.mainPanel}>
          <header className={styles.threadHeader}>
            <div className={styles.threadIdentity}>
              <span className={styles.agentMark}>b</span>
              <span>
                <strong>{activeQuestion ? content(activeQuestion.promptI18nKey, activeQuestion.questionKey) : content(scoping.titleI18nKey, questKey)}</strong>
                <span>{thread ? t('workspace.permanentThread') : t('workspace.chooseQuestion')}</span>
              </span>
            </div>
            <div className={styles.agentCycle} aria-label={t('workspace.cycleLabel')}>
              <span className={styles.cycleStage} data-state="done">{t('workspace.cycle.understand')}</span>
              <span className={styles.cycleStage} data-state={proposal ? 'done' : 'current'}>{t('workspace.cycle.decide')}</span>
              <span className={styles.cycleStage} data-state={confirmation ? 'current' : undefined}>{t('workspace.cycle.act')}</span>
              <span className={styles.cycleStage}>{t('workspace.cycle.remember')}</span>
            </div>
          </header>

          <div className={styles.conversation}>
            <div className={styles.conversationInner}>
              <header className={styles.intro}>
                <span className={styles.microLabel}>{t('workspace.companionLabel')}</span>
                <h2>{t('workspace.introTitle')}</h2>
                <p>{t('workspace.introBody')}</p>
              </header>

              {questKey === 'legal' && <LegalAuthorityCard lookup={legalLookup} locale={locale} />}

              {activeQuestion && (
                <section className={styles.questionStarter}>
                  <strong>{content(activeQuestion.promptI18nKey, activeQuestion.questionKey)}</strong>
                  <p>{content(activeQuestion.helpI18nKey, t('workspace.questionHelpFallback'))}</p>
                  <div className={styles.choices}>
                    {activeQuestion.options.map(option => {
                      const label = content(option.labelI18nKey, option.value)
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={styles.choice}
                          data-current={activeQuestion.currentChoice === option.value}
                          disabled={working}
                          onClick={() => void openQuestion(activeQuestion.questionKey, t('questScoping.leaning', { choice: label }))}
                        >
                          {label}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      className={`${styles.choice} ${styles.choiceOther}`}
                      onClick={() => {
                        setOtherQuestionKey(activeQuestion.questionKey)
                        setOtherDraft('')
                      }}
                    >
                      {t('workspace.otherChoice')}
                    </button>
                  </div>
                  {otherQuestionKey === activeQuestion.questionKey && (
                    <form className={styles.otherPanel} onSubmit={event => void sendOtherIdea(event, activeQuestion.questionKey)}>
                      <label htmlFor="other-idea">{t('workspace.otherPrompt')}</label>
                      <textarea
                        id="other-idea"
                        value={otherDraft}
                        onChange={event => setOtherDraft(event.target.value)}
                        placeholder={t('workspace.otherPlaceholder')}
                        maxLength={12_000}
                        autoFocus
                      />
                      <div className={styles.otherActions}>
                        <button type="submit" className={styles.primary} disabled={!otherDraft.trim() || working}>
                          {working ? t('composer.thinking') : t('workspace.shareIdea')}
                        </button>
                      </div>
                    </form>
                  )}
                </section>
              )}

              <section className={styles.messages} aria-live="polite">
                {messages.filter(message => message.authorType === 'user' || message.authorType === 'assistant').map(message => (
                  <MessageBubble key={message.id} message={message} initials={couple.first.slice(0, 1).toUpperCase()} />
                ))}
              </section>
              {working && (
                <div className={styles.thinking}><span className={styles.agentMark}>b</span>{t('composer.thinking')}</div>
              )}
              {proposal && (
                <DecisionSheet
                  proposal={proposal}
                  choiceLabel={proposal.proposedChoice ? choiceLabel(proposal.questionKey, proposal.proposedChoice) : null}
                  confirmation={confirmation}
                  confirming={confirming}
                  feedbackState={feedbackState}
                  onConfirm={confirmProposal}
                  onFeedback={submitFeedback}
                />
              )}
              {error && <div className={styles.error}>{error}</div>}
              <div ref={endRef} />
            </div>
          </div>

          <footer className={styles.composerArea}>
            <form onSubmit={sendMessage} className={styles.composer}>
              <textarea
                ref={composerRef}
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
                placeholder={thread ? t('composer.placeholder') : t('workspace.chooseQuestion')}
                disabled={!thread || working}
              />
              <button type="submit" className={styles.send} disabled={!thread || !draft.trim() || working} aria-label={t('composer.send')}>
                <Send size={15} />
              </button>
            </form>
          </footer>
        </main>
      </div>
    </div>
  )
}

function MessageBubble({ message, initials }: { message: ThreadMessage; initials: string }) {
  const isBliss = message.authorType === 'assistant'
  return (
    <article className={`${styles.message} ${isBliss ? '' : styles.messageUser}`}>
      {isBliss && <span className={styles.agentMark}>b</span>}
      <div className={styles.bubble}>{message.content}</div>
      {!isBliss && <span className={`${styles.avatar} ${styles.messageAvatar}`}>{initials}</span>}
    </article>
  )
}

function DecisionSheet({
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
    <article className={styles.decisionSheet}>
      <header className={styles.sheetHeader}>
        <strong>{t('workspace.decisionDraft')}</strong>
        <span className={styles.sheetState}>{t(`decision.${proposal.state}`)}</span>
      </header>
      <div className={styles.sheetBody}>
        {choiceLabel && <h3>{choiceLabel}</h3>}
        <p>{proposal.summary}</p>
        {proposal.reason && <p><strong>{proposal.reason}</strong></p>}
        {proposal.taskEffects.length > 0 && (
          <ul className={styles.effects}>
            {proposal.taskEffects.map(task => (
              <li key={task.taskKey} className={styles.effect}>
                <Check size={13} />
                <span>
                  <strong>{content(`quest.${proposal.questKey}.task.${task.taskKey}.title`, task.taskKey.replaceAll('_', ' '))}</strong>
                  <span>{task.rationale}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {proposal.momentCandidate && (
          <div className={styles.moment}>
            <strong>{t('decision.moment')} · {proposal.momentCandidate.title}</strong>
            <p>{proposal.momentCandidate.narrative}</p>
          </div>
        )}
      </div>
      <footer className={styles.sheetFooter}>
        {proposal.agentRunId && (
          <div className={styles.feedback}>
            {feedbackState === 'sent' ? t('feedback.thanks') : (
              <>
                <span>{t('feedback.question')}</span>
                <button type="button" onClick={() => onFeedback(1)} disabled={feedbackState === 'saving'}>{t('feedback.yes')}</button>
                <button type="button" onClick={() => onFeedback(-1)} disabled={feedbackState === 'saving'}>{t('feedback.notQuite')}</button>
              </>
            )}
          </div>
        )}
        {confirmed ? (
          <span className={styles.confirmed}>{t('decision.confirmed')}</span>
        ) : proposal.state === 'ready' ? (
          <button type="button" className={styles.primary} onClick={onConfirm} disabled={confirming}>
            {confirming ? t('decision.confirming') : t('decision.confirm')}
          </button>
        ) : (
          <span className={styles.confirmed}>{t('decision.keepTalking')}</span>
        )}
      </footer>
    </article>
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
    return <div className={styles.legalCard}><strong>{t('legalLookup.unavailableTitle')}</strong>{t('legalLookup.unavailableBody')}</div>
  }
  const checked = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(lookup.rule.verifiedAt))
  return (
    <div className={styles.legalCard}>
      <strong>{t('legalLookup.verifiedTitle')} · {t('legalLookup.checked', { date: checked })}</strong>
      <div className={styles.legalFacts}>
        <span>{questT('legal.waitingPeriod', { hours: lookup.rule.waitingPeriodHours })}</span>
        <span>{questT('legal.validity', { days: lookup.rule.validityDays })}</span>
        <span>{questT('legal.witnesses', { count: lookup.rule.witnessesRequired })}</span>
      </div>
      <div className={styles.legalSources}>
        {lookup.rule.sources.map(source => (
          <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
            <ExternalLink size={11} /> {source.publisher}: {source.title}
          </a>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ body, onBack }: { body: string; onBack: () => void }) {
  const t = useTranslations('assistant')
  return (
    <div className={styles.loading}>
      <div><p>{body}</p><button type="button" className={styles.secondary} onClick={onBack}>{t('questScoping.backToQuest')}</button></div>
    </div>
  )
}
