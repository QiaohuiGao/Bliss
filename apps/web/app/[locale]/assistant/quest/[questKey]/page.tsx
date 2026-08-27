'use client'

import { type CSSProperties, type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
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
import { Bell, Check, ExternalLink, Paperclip, Send } from 'lucide-react'
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
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
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

  useEffect(() => {
    setSelectedChoice(activeQuestion?.source === 'confirmed' ? activeQuestion.currentChoice : null)
  }, [activeQuestion?.currentChoice, activeQuestion?.questionKey, activeQuestion?.source])

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
  const dateLabel = wedding.weddingDate
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${wedding.weddingDate}T12:00:00`))
    : t('workspace.dateOpen')
  const totalDecisions = progress.reduce((total, item) => total + item.totalCount, 0)
  const decisionPercent = totalDecisions > 0 ? Math.round((confirmedTotal / totalDecisions) * 100) : 0
  const currentChapterNumber = JOURNEY_QUESTS.indexOf(questKey as typeof JOURNEY_QUESTS[number]) + 1
  const sourceCount = messages.filter(message => message.authorType === 'user').length
  const firstInput = proposal?.memberInputs[0]?.stance ?? t('workspace.understanding.firstOpen')
  const secondInput = proposal?.memberInputs[1]?.stance ?? t('workspace.understanding.secondOpen')
  const sharedGround = proposal?.reason ?? t('workspace.understanding.sharedOpen')
  const preparedAction = proposal?.externalActions[0] ?? null

  return (
    <div className={styles.app}>
      <div className={styles.appShell}>
        <header className={styles.appHeader}>
          <div className={styles.brand}><span className={styles.brandMark} aria-hidden="true" /><span>{t('workspace.brand')}</span></div>
          <div className={styles.weddingIdentity}>
            <strong>{t('workspace.couple', couple)}</strong>
            <span>{dateLabel}{wedding.city ? ` · ${wedding.city}` : ''}</span>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.presence} aria-label={t('workspace.members')}>
              <span className={`${styles.avatar} ${styles.firstAvatar}`}>{couple.first.slice(0, 1).toUpperCase()}</span>
              <span className={`${styles.avatar} ${styles.secondAvatar}`}>{couple.second.slice(0, 1).toUpperCase()}</span>
            </div>
            <button type="button" className={styles.notesButton} onClick={() => router.push('/board')}>{t('workspace.allPlanning')}</button>
            <button type="button" className={styles.iconButton} aria-label={t('workspace.notifications')}><Bell size={15} /></button>
          </div>
        </header>

        <section className={styles.journeyBar} aria-label={t('workspace.journeyLabel')}>
          <div className={styles.journeyCopy}>
            <p className={styles.eyebrow}>{t('workspace.ourWedding')}</p>
            <strong>{t('workspace.chaptersTitle')}</strong>
            <span>{t('workspace.chaptersBody')}</span>
          </div>
          <nav
            className={styles.journeyTrack}
            aria-label={t('workspace.chaptersLabel')}
            style={{ '--journey-progress': `${decisionPercent}%` } as CSSProperties}
          >
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
                  className={styles.questNode}
                  data-status={chapterProgress?.status ?? 'not_started'}
                  aria-current={chapterKey === questKey ? 'step' : undefined}
                  title={content(`quest.${chapterKey}.title`, chapterKey.replaceAll('_', ' '))}
                  onClick={() => router.push(href)}
                >
                  <span className={styles.questDot} />
                  <span className={styles.questLabel}>{t(`workspace.chapter.${chapterKey}`)}</span>
                </button>
              )
            })}
          </nav>
          <div className={styles.journeyScore}>
            <strong>{decisionPercent}%</strong>
            <span>{t('workspace.decisionCount', { count: confirmedTotal })}</span>
          </div>
        </section>

        <div className={styles.workspace}>
          <aside className={styles.questRail}>
            <p className={styles.eyebrow}>{t('workspace.currentChapter', { number: currentChapterNumber })}</p>
            <h1 className={styles.questTitle}>{content(scoping.titleI18nKey, questKey)}</h1>
            <p className={styles.questSubtitle}>{content(scoping.subtitleI18nKey, t('questScoping.genericSubtitle'))}</p>

            <ol className={styles.phaseList}>
              {scoping.questions.map((question, index) => {
                const status = questionStatus(question.questionKey)
                return (
                  <li key={question.questionKey}>
                    <button
                      type="button"
                      className={styles.phaseItem}
                      data-status={status}
                      data-active={activeQuestion?.questionKey === question.questionKey}
                      onClick={() => void openQuestion(question.questionKey)}
                      disabled={working}
                    >
                      <span className={styles.phaseMark}>{status === 'confirmed' ? '✓' : index + 1}</span>
                      <span className={styles.phaseCopy}>
                        <strong>{content(question.promptI18nKey, question.questionKey)}</strong>
                        <span>{t(`workspace.questionStatus.${status}`)}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>

            <section className={styles.capabilityBox}>
              <h2 className={styles.sectionHeading}>{t('workspace.capabilities.title')}<span>{t('workspace.capabilities.tryOne')}</span></h2>
              <div className={styles.capabilityList}>
                {(['context', 'compare', 'next', 'remember'] as const).map((capability, index) => (
                  <button
                    key={capability}
                    type="button"
                    className={styles.capability}
                    disabled={!activeQuestion || working}
                    onClick={() => activeQuestion && void openQuestion(activeQuestion.questionKey, t(`workspace.capabilities.${capability}.prompt`))}
                  >
                    <span className={styles.capabilityIcon}>{['⌕', '≍', '→', '◇'][index]}</span>
                    <span><strong>{t(`workspace.capabilities.${capability}.title`)}</strong><small>{t(`workspace.capabilities.${capability}.body`)}</small></span>
                    <span className={styles.capabilityArrow}>›</span>
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <section className={styles.conversation}>
            <header className={styles.conversationHeader}>
              <div className={styles.threadName}>
                <span className={styles.blissOrb}>b</span>
                <span>
                  <strong>{activeQuestion ? content(activeQuestion.promptI18nKey, activeQuestion.questionKey) : content(scoping.titleI18nKey, questKey)}</strong>
                  <span>{thread ? t('workspace.permanentThread') : t('workspace.chooseQuestion')}</span>
                </span>
              </div>
              <span className={styles.thinkingState}>{working ? t('composer.thinking') : t('workspace.agentReady')}</span>
            </header>

            <div className={styles.conversationScroll}>
              <header className={styles.conversationIntro}>
                <p className={styles.eyebrow}>{t('workspace.companionLabel')}</p>
                <h2>{t('workspace.prototypeIntroTitle')}</h2>
                <p>{t('workspace.prototypeIntroBody')}</p>
              </header>

              <section className={styles.understandingCard}>
                <header className={styles.cardHeader}>
                  <strong>{t('workspace.understanding.title')}</strong>
                  <span className={styles.sourceLink}>{t('workspace.understanding.sources', { count: sourceCount })}</span>
                </header>
                <div className={styles.coupleInputs}>
                  <section className={`${styles.memberView} ${styles.firstMember}`}>
                    <div className={styles.memberLabel}><i />{couple.first}</div>
                    <p>{firstInput}</p>
                  </section>
                  <div className={styles.sharedKnot}><span>&amp;</span></div>
                  <section className={`${styles.memberView} ${styles.secondMember}`}>
                    <div className={styles.memberLabel}><i />{couple.second}</div>
                    <p>{secondInput}</p>
                  </section>
                </div>
                <div className={styles.sharedPriority}><strong>{t('workspace.understanding.sharedGround')}</strong><span>{sharedGround}</span></div>
              </section>

              {questKey === 'legal' && <LegalAuthorityCard lookup={legalLookup} locale={locale} />}

              <section className={styles.messages} aria-live="polite">
                {messages.filter(message => message.authorType === 'user' || message.authorType === 'assistant').map(message => (
                  <MessageBubble key={message.id} message={message} initials={couple.first.slice(0, 1).toUpperCase()} />
                ))}
              </section>
              {working && <div className={styles.thinking}><span className={styles.blissOrb}>b</span>{t('composer.thinking')}</div>}
              {proposal?.taskEffects.length ? (
                <section className={styles.planEffects}>
                  <strong>{t('decision.tasks')}</strong>
                  {proposal.taskEffects.map(task => (
                    <span key={task.taskKey}><Check size={12} />{content(`quest.${proposal.questKey}.task.${task.taskKey}.title`, task.taskKey.replaceAll('_', ' '))}</span>
                  ))}
                </section>
              ) : null}
              {error && <div className={styles.error}>{error}</div>}
              <div ref={endRef} />
            </div>

            <footer className={styles.composerShell}>
              <div className={styles.promptRow}>
                {(['agree', 'questions', 'next'] as const).map(prompt => (
                  <button
                    key={prompt}
                    type="button"
                    className={styles.promptChip}
                    disabled={!activeQuestion || working}
                    onClick={() => activeQuestion && void openQuestion(activeQuestion.questionKey, t(`workspace.prompts.${prompt}.prompt`))}
                  >
                    {t(`workspace.prompts.${prompt}.label`)}
                  </button>
                ))}
              </div>
              <form onSubmit={sendMessage} className={styles.composer}>
                <button type="button" className={styles.attachButton} aria-label={t('workspace.attach')}><Paperclip size={15} /></button>
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
                <button type="submit" className={styles.sendButton} disabled={!thread || !draft.trim() || working} aria-label={t('composer.send')}><Send size={15} /></button>
              </form>
            </footer>
          </section>

          <aside className={styles.decisionDock}>
            <div className={styles.dockHeading}>
              <strong>{t('workspace.dock.title')}</strong>
              <span className={styles.phasePill}>{proposal ? t(`decision.${proposal.state}`) : t('workspace.dock.exploring')}</span>
            </div>

            {activeQuestion && (
              <article className={styles.decisionCard}>
                <p className={styles.decisionNumber}>{t('workspace.dock.number', { number: currentChapterNumber, chapter: content(scoping.titleI18nKey, questKey) })}</p>
                <h2>{content(activeQuestion.promptI18nKey, activeQuestion.questionKey)}</h2>
                <p>{content(activeQuestion.helpI18nKey, t('workspace.questionHelpFallback'))}</p>

                {activeQuestion.options.map(option => {
                  const label = content(option.labelI18nKey, option.value)
                  const selected = selectedChoice === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={styles.choiceOption}
                      data-selected={selected}
                      disabled={working}
                      onClick={() => {
                        setSelectedChoice(option.value)
                        void openQuestion(activeQuestion.questionKey, t('questScoping.leaning', { choice: label }))
                      }}
                    >
                      <span className={styles.choiceRadio} />
                      <span><strong>{label}</strong><small>{selected ? t('workspace.dock.selected') : t('workspace.dock.explore')}</small></span>
                    </button>
                  )
                })}

                <button
                  type="button"
                  className={styles.choiceOption}
                  data-other="true"
                  data-selected={otherQuestionKey === activeQuestion.questionKey}
                  onClick={() => {
                    setSelectedChoice(null)
                    setOtherQuestionKey(activeQuestion.questionKey)
                    setOtherDraft('')
                  }}
                >
                  <span className={styles.choiceRadio} />
                  <span><strong>{t('workspace.otherChoice')}</strong><small>{t('workspace.dock.otherBody')}</small></span>
                  <span>{t('workspace.dock.writeOwn')}</span>
                </button>

                {otherQuestionKey === activeQuestion.questionKey && (
                  <form className={styles.otherChoicePanel} onSubmit={event => void sendOtherIdea(event, activeQuestion.questionKey)}>
                    <label htmlFor="other-idea">{t('workspace.otherPrompt')}</label>
                    <textarea id="other-idea" value={otherDraft} onChange={event => setOtherDraft(event.target.value)} placeholder={t('workspace.otherPlaceholder')} maxLength={12_000} autoFocus />
                    <small>{t('workspace.dock.otherBoundary')}</small>
                    <div className={styles.otherChoiceActions}><button type="submit" disabled={!otherDraft.trim() || working}>{working ? t('composer.thinking') : t('workspace.shareIdea')}</button></div>
                  </form>
                )}

                <div className={styles.whyFit}><strong>{t('workspace.dock.why')}</strong>{proposal?.reason ?? t('workspace.dock.whyFallback')}</div>
                <div className={styles.memberConfirmations}>
                  <span className={styles.memberStatus}><i />{t('workspace.dock.memberReady', { name: couple.first })}</span>
                  <span className={`${styles.memberStatus} ${styles.waitingStatus}`}><i />{t('workspace.dock.memberReviewing', { name: couple.second })}</span>
                </div>
                {proposal?.status === 'confirmed' || confirmation ? (
                  <button type="button" className={styles.primaryButton} disabled>{t('decision.confirmed')}</button>
                ) : proposal?.state === 'ready' ? (
                  <button type="button" className={styles.primaryButton} onClick={confirmProposal} disabled={confirming}>{confirming ? t('decision.confirming') : t('decision.confirm')}</button>
                ) : (
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => thread ? composerRef.current?.focus() : void openQuestion(activeQuestion.questionKey)}
                    disabled={working}
                  >
                    {t('workspace.dock.continue')}
                  </button>
                )}
                {proposal?.agentRunId && (
                  <div className={styles.feedback}>
                    {feedbackState === 'sent' ? t('feedback.thanks') : (
                      <><span>{t('feedback.question')}</span><button type="button" onClick={() => void submitFeedback(1)} disabled={feedbackState === 'saving'}>{t('feedback.yes')}</button><button type="button" onClick={() => void submitFeedback(-1)} disabled={feedbackState === 'saving'}>{t('feedback.notQuite')}</button></>
                    )}
                  </div>
                )}
              </article>
            )}

            <section className={styles.dockSection}>
              <h3 className={styles.sectionHeading}>{t('workspace.actions.title')}<span>{t('workspace.actions.count', { count: proposal?.externalActions.length ?? 0 })}</span></h3>
              <article className={styles.actionCard}>
                <div className={styles.actionMeta}><span className={styles.actionType}>{preparedAction ? t(`actions.kind.${preparedAction.kind}`) : t('workspace.actions.noneType')}</span><span className={styles.approvalBadge}>{t('workspace.actions.approval')}</span></div>
                <h3>{preparedAction ? t('workspace.actions.prepared') : t('workspace.actions.empty')}</h3>
                <p>{t('workspace.actions.body')}</p>
                <button type="button" className={styles.secondaryButton} onClick={() => router.push('/actions')}>{t('workspace.actions.review')}</button>
              </article>
            </section>

            <section className={styles.dockSection}>
              <h3 className={styles.sectionHeading}>{t('workspace.moment.title')}<span>{t('workspace.moment.suggested')}</span></h3>
              <article className={styles.momentCard}>
                <p className={styles.eyebrow}>{t('decision.moment')}</p>
                <h3>{proposal?.momentCandidate?.title ?? t('workspace.moment.emptyTitle')}</h3>
                <p>{proposal?.momentCandidate?.narrative ?? t('workspace.moment.emptyBody')}</p>
                <button type="button" className={styles.textButton} onClick={() => router.push('/moments')}>{t('workspace.moment.open')}</button>
              </article>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message, initials }: { message: ThreadMessage; initials: string }) {
  const isBliss = message.authorType === 'assistant'
  return (
    <article className={styles.message} data-author={isBliss ? 'assistant' : 'user'}>
      {isBliss && <span className={styles.blissOrb}>b</span>}
      <div className={styles.bubble}>{message.content}</div>
      {!isBliss && <span className={`${styles.avatar} ${styles.firstAvatar}`}>{initials}</span>}
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
