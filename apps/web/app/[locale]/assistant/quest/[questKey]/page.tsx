'use client'

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ConfirmDecisionResult, DecisionProposal, MarriageLicenseLookupResponse, PlanningThread, QuestProgress, QuestScopingOverview, QuestWorkspaceSnapshot, ThreadMessage, Wedding } from '@bliss/types'
import { QUEST_KEYS } from '@bliss/types'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { api } from '@/lib/api'
import { useToken } from '@/lib/useToken'
import { DecisionRail } from './components/DecisionRail'
import { QuestionConversation } from './components/QuestionConversation'
import { WorkspaceHeader } from './components/WorkspaceHeader'
import { WorkspaceJourney } from './components/WorkspaceJourney'
import { WorkspaceRail } from './components/WorkspaceRail'
import styles from './workspace.module.css'

const SCOPABLE_QUESTS = QUEST_KEYS
type ScopableQuest = typeof SCOPABLE_QUESTS[number]

function isScopableQuest(value: string): value is ScopableQuest {
  return (SCOPABLE_QUESTS as readonly string[]).includes(value)
}

export default function QuestDecisionPage({ params, searchParams }: { params: { questKey: string }; searchParams: { questionKey?: string } }) {
  const { questKey } = params
  const t = useTranslations('assistant')
  const locale = useLocale()
  const router = useRouter()
  const getToken = useToken()
  const bootedWorkspace = useRef<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const [wedding, setWedding] = useState<Wedding | null>(null)
  const [couple, setCouple] = useState({ first: '', second: '' })
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState<QuestWorkspaceSnapshot | null>(null)
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
  const [actionWorkingId, setActionWorkingId] = useState<string | null>(null)
  const [feedbackState, setFeedbackState] = useState<'idle' | 'saving' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  const applyWorkspace = useCallback((next: QuestWorkspaceSnapshot) => {
    setWorkspaceSnapshot(next)
    const currentMember = next.members.find(member => member.isCurrentUser)?.displayName
    const partnerMember = next.members.find(member => !member.isCurrentUser)?.displayName
    setCouple({ first: currentMember ?? t('workspace.you'), second: partnerMember ?? t('workspace.partner') })
    setProgress(next.journey)
    setScoping({ questKey: next.quest.questKey, titleI18nKey: next.quest.titleI18nKey, subtitleI18nKey: next.quest.subtitleI18nKey, questions: next.questions })
    setThread(next.activeThread)
    setMessages(next.messages)
    setProposal(next.proposal)
  }, [t])

  useEffect(() => {
    const workspaceKey = `${questKey}:${searchParams.questionKey ?? ''}`
    if (bootedWorkspace.current === workspaceKey || !isScopableQuest(questKey)) return
    const activeQuest = questKey
    bootedWorkspace.current = workspaceKey
    async function load() {
      try {
        const token = await getToken()
        const currentWedding = await api.getMyWedding(token)
        const [nextWorkspace, authorityResult] = await Promise.all([
          api.getQuestWorkspace(currentWedding.id, activeQuest, token, searchParams.questionKey),
          activeQuest === 'legal' ? api.getMarriageLicense(currentWedding.id, token).catch(() => 'unavailable' as const) : Promise.resolve(null),
        ])
        setWedding(currentWedding)
        applyWorkspace(nextWorkspace)
        setLegalLookup(authorityResult)
      } catch {
        router.push('/onboarding')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [applyWorkspace, getToken, questKey, router, searchParams.questionKey])

  async function resolveQuestionThread(questionKey: string, token: string) {
    if (!wedding) throw new Error(t('state.error'))
    let nextWorkspace = await api.getQuestWorkspace(wedding.id, questKey, token, questionKey)
    let target = nextWorkspace.activeThread
    if (!target) {
      target = await api.createPlanningThread(wedding.id, token, questKey as ScopableQuest, questionKey)
      nextWorkspace = await api.getQuestWorkspace(wedding.id, questKey, token, questionKey)
    }
    applyWorkspace(nextWorkspace)
    setConfirmation(null)
    setFeedbackState('idle')
    return target
  }

  async function refreshWorkspace(token: string, questionKey = thread?.questionKey ?? undefined) {
    if (!wedding) return null
    const next = await api.getQuestWorkspace(wedding.id, questKey, token, questionKey ?? undefined)
    applyWorkspace(next)
    return next
  }

  async function openQuestion(questionKey: string, nextDraft?: string) {
    if (!wedding || working) return
    setWorking(true)
    setError(null)
    setOtherQuestionKey(null)
    try {
      const token = await getToken()
      await resolveQuestionThread(questionKey, token)
      router.replace(`/assistant/quest/${questKey}?questionKey=${encodeURIComponent(questionKey)}`)
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
    const run = target.questKey === 'attire_beauty' && target.questionKey === 'attire.dress_acquisition'
      ? await api.runAttireAgent(wedding.id, target.id, token)
      : target.questKey === 'vendor_team' && target.questionKey === 'photo.photographer_choice'
        ? await api.runPhotographerAgent(wedding.id, target.id, token)
        : await api.runQuestScopingAgent(wedding.id, target.id, token)
    if (run.stopReason !== 'natural' && run.stopReason !== 'terminal_tool') throw new Error(t('state.error'))
    await refreshWorkspace(token, target.questionKey ?? undefined)
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
      const approval = await api.approveDecisionProposal(wedding.id, proposal.id, token)
      setWorkspaceSnapshot(current => current ? { ...current, memberApprovals: approval.approvals } : current)
      if (!approval.readyToConfirm) return
      const result = await api.confirmDecisionProposal(wedding.id, proposal.id, crypto.randomUUID(), token)
      setConfirmation(result)
      await refreshWorkspace(token, proposal.questionKey)
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

  async function updateMomentStatus(status: 'saved' | 'dismissed') {
    const moment = workspaceSnapshot?.moment
    const questionKey = workspaceSnapshot?.activeQuestionKey
    if (!wedding || !questionKey || !moment?.id || moment.source !== 'persisted' || working) return
    setWorking(true)
    setError(null)
    try {
      const token = await getToken()
      await api.updateMoment(wedding.id, moment.id, status, token)
      await refreshWorkspace(token, questionKey)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('state.error'))
    } finally {
      setWorking(false)
    }
  }

  async function approveWorkspaceAction(actionId: string) {
    const questionKey = workspaceSnapshot?.activeQuestionKey
    if (!wedding || !questionKey || actionWorkingId) return
    setActionWorkingId(actionId)
    setError(null)
    try {
      const token = await getToken()
      await api.approveAction(wedding.id, actionId, crypto.randomUUID(), token)
      await refreshWorkspace(token, questionKey)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('state.error'))
    } finally {
      setActionWorkingId(null)
    }
  }

  async function cancelWorkspaceAction(actionId: string) {
    const questionKey = workspaceSnapshot?.activeQuestionKey
    if (!wedding || !questionKey || actionWorkingId) return
    setActionWorkingId(actionId)
    setError(null)
    try {
      const token = await getToken()
      await api.cancelAction(wedding.id, actionId, token)
      await refreshWorkspace(token, questionKey)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('state.error'))
    } finally {
      setActionWorkingId(null)
    }
  }

  const activeQuestion = useMemo(() => {
    if (!scoping) return null
    return scoping.questions.find(question => question.questionKey === thread?.questionKey) ?? scoping.questions[0] ?? null
  }, [scoping, thread?.questionKey])

  useEffect(() => {
    setSelectedChoice(activeQuestion?.source === 'confirmed' ? activeQuestion.currentChoice : null)
  }, [activeQuestion?.currentChoice, activeQuestion?.questionKey, activeQuestion?.source])

  if (!isScopableQuest(questKey)) return <EmptyState body={t('questScoping.unsupported')} onBack={() => router.push('/board')} />
  if (loading || !wedding || !scoping) return <div className={styles.loading}>{t('state.loading')}</div>

  const activeQuestProgress = progress.find(item => item.questKey === questKey)
  const confirmedTotal = progress.reduce((total, item) => total + item.confirmedCount, 0)
  const dateLabel = wedding.weddingDate
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${wedding.weddingDate}T12:00:00`))
    : t('workspace.dateOpen')
  const totalDecisions = progress.reduce((total, item) => total + item.totalCount, 0)
  const decisionPercent = totalDecisions > 0 ? Math.round((confirmedTotal / totalDecisions) * 100) : 0
  const currentChapterNumber = QUEST_KEYS.indexOf(questKey) + 1
  const sourceCount = workspaceSnapshot?.understanding.sourceMessageIds.length ?? messages.filter(message => message.authorType === 'user').length
  const firstInput = proposal?.memberInputs[0]?.stance ?? t('workspace.understanding.firstOpen')
  const secondInput = proposal?.memberInputs[1]?.stance ?? t('workspace.understanding.secondOpen')
  const sharedGround = proposal?.reason ?? t('workspace.understanding.sharedOpen')

  return (
    <div className={styles.app}>
      <div className={styles.appShell}>
        <WorkspaceHeader firstName={couple.first} secondName={couple.second} dateLabel={dateLabel} city={wedding.city} />
        <WorkspaceJourney questKey={questKey} progress={progress} decisionPercent={decisionPercent} confirmedTotal={confirmedTotal} />
        <div className={styles.workspace}>
          <WorkspaceRail chapterNumber={currentChapterNumber} scoping={scoping} questProgress={activeQuestProgress} activeQuestionKey={activeQuestion?.questionKey} procedure={workspaceSnapshot?.procedure ?? []} capabilities={workspaceSnapshot?.capabilities ?? []} working={working} onOpenQuestion={(questionKey, nextDraft) => void openQuestion(questionKey, nextDraft)} />
          <QuestionConversation
            questKey={questKey}
            locale={locale}
            scoping={scoping}
            activeQuestion={activeQuestion}
            thread={thread}
            messages={messages}
            resourceCards={workspaceSnapshot?.resourceCards ?? []}
            firstName={couple.first}
            firstInput={firstInput}
            secondName={couple.second}
            secondInput={secondInput}
            sharedGround={sharedGround}
            sourceCount={sourceCount}
            legalLookup={legalLookup}
            draft={draft}
            working={working}
            error={error}
            composerRef={composerRef}
            endRef={endRef}
            onDraftChange={setDraft}
            onSendMessage={event => void sendMessage(event)}
            onOpenQuestion={(questionKey, nextDraft) => void openQuestion(questionKey, nextDraft)}
          />
          <DecisionRail
            activeQuestion={activeQuestion}
            scoping={scoping}
            chapterNumber={currentChapterNumber}
            proposal={proposal}
            snapshot={workspaceSnapshot}
            selectedChoice={selectedChoice}
            otherQuestionKey={otherQuestionKey}
            otherDraft={otherDraft}
            working={working}
            confirming={confirming}
            confirmed={Boolean(confirmation)}
            feedbackState={feedbackState}
            composerRef={composerRef}
            onSelectChoice={setSelectedChoice}
            onOpenOther={questionKey => { setSelectedChoice(null); setOtherQuestionKey(questionKey); setOtherDraft('') }}
            onOtherDraftChange={setOtherDraft}
            onSendOther={(event, questionKey) => void sendOtherIdea(event, questionKey)}
            onOpenQuestion={(questionKey, nextDraft) => void openQuestion(questionKey, nextDraft)}
            onConfirm={() => void confirmProposal()}
            onFeedback={rating => void submitFeedback(rating)}
            onUpdateMoment={status => void updateMomentStatus(status)}
            actionWorkingId={actionWorkingId}
            onApproveAction={actionId => void approveWorkspaceAction(actionId)}
            onCancelAction={actionId => void cancelWorkspaceAction(actionId)}
          />
        </div>
      </div>
    </div>
  )
}

function EmptyState({ body, onBack }: { body: string; onBack: () => void }) {
  const t = useTranslations('assistant')
  return <div className={styles.loading}><div><p>{body}</p><button type="button" className={styles.secondary} onClick={onBack}>{t('questScoping.backToQuest')}</button></div></div>
}
