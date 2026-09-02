'use client'

import type { FormEvent, RefObject } from 'react'
import type {
  DecisionProposal,
  QuestScopingOverview,
  QuestWorkspaceSnapshot,
  WorkspaceReadyAction,
} from '@bliss/types'
import { useLocale, useTranslations } from 'next-intl'
import { useContent } from '@/lib/content'
import styles from '../workspace.module.css'

type ActiveQuestion = QuestScopingOverview['questions'][number]

export function DecisionRail({
  activeQuestion,
  scoping,
  chapterNumber,
  proposal,
  snapshot,
  selectedChoice,
  otherQuestionKey,
  otherDraft,
  working,
  confirming,
  confirmed,
  feedbackState,
  composerRef,
  onSelectChoice,
  onOpenOther,
  onOtherDraftChange,
  onSendOther,
  onOpenQuestion,
  onConfirm,
  onFeedback,
  onUpdateMoment,
  actionWorkingId,
  onApproveAction,
  onCancelAction,
}: {
  activeQuestion: ActiveQuestion | null
  scoping: QuestScopingOverview
  chapterNumber: number
  proposal: DecisionProposal | null
  snapshot: QuestWorkspaceSnapshot | null
  selectedChoice: string | null
  otherQuestionKey: string | null
  otherDraft: string
  working: boolean
  confirming: boolean
  confirmed: boolean
  feedbackState: 'idle' | 'saving' | 'sent'
  composerRef: RefObject<HTMLTextAreaElement>
  onSelectChoice: (value: string) => void
  onOpenOther: (questionKey: string) => void
  onOtherDraftChange: (value: string) => void
  onSendOther: (event: FormEvent, questionKey: string) => void
  onOpenQuestion: (questionKey: string, draft?: string) => void
  onConfirm: () => void
  onFeedback: (rating: -1 | 1) => void
  onUpdateMoment: (status: 'saved' | 'dismissed') => void
  actionWorkingId: string | null
  onApproveAction: (actionId: string) => void
  onCancelAction: (actionId: string) => void
}) {
  const t = useTranslations('assistant')
  const locale = useLocale()
  const content = useContent()
  const readyActions = snapshot?.readyActions ?? []
  const workspaceMoment = snapshot?.moment ?? null
  const approvals = snapshot?.memberApprovals ?? []
  const currentApproval = approvals.find(approval => approval.isCurrentUser)
  const everyMemberReady = approvals.length > 0 && approvals.every(approval => approval.ready)

  return (
    <aside className={styles.decisionDock}>
      <div className={styles.dockHeading}>
        <strong>{t('workspace.dock.title')}</strong>
        <span className={styles.phasePill}>{proposal ? t(`decision.${proposal.state}`) : t('workspace.dock.exploring')}</span>
      </div>

      {activeQuestion && (
        <article className={styles.decisionCard}>
          <p className={styles.decisionNumber}>{t('workspace.dock.number', { number: chapterNumber, chapter: content(scoping.titleI18nKey, scoping.questKey) })}</p>
          <h2>{content(activeQuestion.promptI18nKey, activeQuestion.questionKey)}</h2>
          <p>{content(activeQuestion.helpI18nKey, t('workspace.questionHelpFallback'))}</p>

          {activeQuestion.options.map(option => {
            const label = option.label ?? content(option.labelI18nKey, option.value)
            const selected = selectedChoice === option.value
            return (
              <button
                key={option.value}
                type="button"
                className={styles.choiceOption}
                data-selected={selected}
                aria-pressed={selected}
                disabled={working}
                onClick={() => {
                  onSelectChoice(option.value)
                  onOpenQuestion(activeQuestion.questionKey, t('questScoping.leaning', { choice: label }))
                }}
              >
                <span className={styles.choiceRadio} />
                <span><strong>{label}</strong><small>{selected ? t('workspace.dock.selected') : t('workspace.dock.explore')}</small></span>
              </button>
            )
          })}

          {activeQuestion.allowsCustom && <button type="button" className={styles.choiceOption} data-other="true" data-selected={selectedChoice === 'other' || otherQuestionKey === activeQuestion.questionKey} aria-pressed={selectedChoice === 'other' || otherQuestionKey === activeQuestion.questionKey} onClick={() => onOpenOther(activeQuestion.questionKey)}>
              <span className={styles.choiceRadio} />
              <span><strong>{proposal?.customChoice ?? activeQuestion.currentCustomChoice ?? t('workspace.otherChoice')}</strong><small>{t('workspace.dock.otherBody')}</small></span>
              <span>{t('workspace.dock.writeOwn')}</span>
            </button>}

          {activeQuestion.allowsCustom && otherQuestionKey === activeQuestion.questionKey && (
            <form className={styles.otherChoicePanel} onSubmit={event => onSendOther(event, activeQuestion.questionKey)}>
              <label htmlFor="other-idea">{t('workspace.otherPrompt')}</label>
              <textarea id="other-idea" value={otherDraft} onChange={event => onOtherDraftChange(event.target.value)} placeholder={t('workspace.otherPlaceholder')} maxLength={12_000} autoFocus />
              <small>{t('workspace.dock.otherBoundary')}</small>
              <div className={styles.otherChoiceActions}><button type="submit" disabled={!otherDraft.trim() || working}>{working ? t('composer.thinking') : t('workspace.shareIdea')}</button></div>
            </form>
          )}

          <div className={styles.whyFit}><strong>{t('workspace.dock.why')}</strong>{proposal?.reason ?? t('workspace.dock.whyFallback')}</div>
          <div className={styles.memberConfirmations}>
            {approvals.map(approval => (
              <span key={approval.userId} className={`${styles.memberStatus} ${approval.ready ? '' : styles.waitingStatus}`}>
                <i />{approval.ready
                  ? t('workspace.dock.memberReady', { name: approval.displayName ?? t('workspace.partner') })
                  : t('workspace.dock.memberReviewing', { name: approval.displayName ?? t('workspace.partner') })}
              </span>
            ))}
          </div>
          {proposal?.status === 'confirmed' || confirmed ? (
            <button type="button" className={styles.primaryButton} disabled>{t('decision.confirmed')}</button>
          ) : proposal?.state === 'ready' ? (
            <button type="button" className={styles.primaryButton} onClick={onConfirm} disabled={confirming || Boolean(currentApproval?.ready && !everyMemberReady)}>
              {confirming
                ? t('decision.confirming')
                : currentApproval?.ready && !everyMemberReady
                  ? t('workspace.dock.waitingForPartner')
                  : everyMemberReady
                    ? t('workspace.dock.confirmShared')
                    : t('workspace.dock.markReady')}
            </button>
          ) : (
            <button type="button" className={styles.primaryButton} onClick={() => snapshot?.activeThread ? composerRef.current?.focus() : onOpenQuestion(activeQuestion.questionKey)} disabled={working}>{t('workspace.dock.continue')}</button>
          )}
          {proposal?.agentRunId && (
            <div className={styles.feedback}>
              {feedbackState === 'sent' ? t('feedback.thanks') : (
                <><span>{t('feedback.question')}</span><button type="button" onClick={() => onFeedback(1)} disabled={feedbackState === 'saving'}>{t('feedback.yes')}</button><button type="button" onClick={() => onFeedback(-1)} disabled={feedbackState === 'saving'}>{t('feedback.notQuite')}</button></>
              )}
            </div>
          )}
        </article>
      )}

      <section className={styles.dockSection} hidden={readyActions.length === 0}>
        <h3 className={styles.sectionHeading}>{t('workspace.actions.title')}<span>{t('workspace.actions.count', { count: readyActions.length })}</span></h3>
        <div className={styles.actionList}>
          {readyActions.map((action, index) => (
            <WorkspaceActionCard
              key={action.id ?? `${action.kind}-${index}`}
              action={action}
              busy={actionWorkingId !== null}
              working={action.id === actionWorkingId}
              locale={locale}
              onApprove={onApproveAction}
              onCancel={onCancelAction}
            />
          ))}
        </div>
      </section>

      <section className={styles.dockSection} hidden={!workspaceMoment || workspaceMoment.status === 'dismissed'}>
        <h3 className={styles.sectionHeading}>{t('workspace.moment.title')}<span>{workspaceMoment?.status === 'saved' ? t('workspace.moment.saved') : t('workspace.moment.suggested')}</span></h3>
        <article className={styles.momentCard}>
          <p className={styles.eyebrow}>{t('decision.moment')}</p>
          <h3>{workspaceMoment?.title ?? t('workspace.moment.emptyTitle')}</h3>
          <p>{workspaceMoment?.narrative ?? t('workspace.moment.emptyBody')}</p>
          {workspaceMoment?.source === 'persisted' ? (
            <div className={styles.momentActions}>
              <button type="button" className={styles.textButton} onClick={() => onUpdateMoment('saved')} disabled={working || workspaceMoment.status === 'saved'}>{workspaceMoment.status === 'saved' ? t('workspace.moment.saved') : t('workspace.moment.save')}</button>
              <button type="button" className={styles.quietButton} onClick={() => onUpdateMoment('dismissed')} disabled={working}>{t('workspace.moment.dismiss')}</button>
            </div>
          ) : <span className={styles.previewNote}>{t('workspace.moment.preview')}</span>}
        </article>
      </section>
    </aside>
  )
}

function WorkspaceActionCard({
  action,
  busy,
  working,
  locale,
  onApprove,
  onCancel,
}: {
  action: WorkspaceReadyAction
  busy: boolean
  working: boolean
  locale: string
  onApprove: (actionId: string) => void
  onCancel: (actionId: string) => void
}) {
  const t = useTranslations('assistant')
  const actionT = useTranslations('actions')
  const canApprove = action.source === 'persisted' && action.id !== null && (action.status === 'draft' || action.status === 'failed')
  const canCancel = action.source === 'persisted' && action.id !== null && action.status === 'draft'

  return (
    <article className={styles.actionCard}>
      <div className={styles.actionMeta}>
        <span className={styles.actionType}>{actionT(`kind.${action.kind}`)}</span>
        <span className={styles.approvalBadge} data-complete={action.status === 'succeeded'}>
          {action.source === 'proposal_preview' ? t('workspace.actions.preview') : actionT(`status.${action.status}`)}
        </span>
      </div>
      <h3>{action.source === 'persisted' ? t('workspace.actions.prepared') : t('workspace.actions.preview')}</h3>
      <p>{action.source === 'persisted' ? t('workspace.actions.body') : t('workspace.actions.previewBody')}</p>
      <dl className={styles.actionDetails}>
        {Object.entries(action.payload).map(([key, value]) => (
          <div key={key}>
            <dt>{fieldLabel(actionT, key)}</dt>
            <dd>{actionValue(value, locale)}</dd>
          </div>
        ))}
      </dl>
      {canApprove && (
        <div className={styles.actionApproval}>
          <p>{action.kind === 'send_email' ? actionT('approval.sendBoundary') : actionT('approval.boundary')}</p>
          <div className={styles.actionButtons}>
            <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => onApprove(action.id!)}>
              {working
                ? actionT('approval.working')
                : action.status === 'failed'
                  ? actionT('approval.retry')
                  : action.kind === 'send_email'
                    ? actionT('approval.send')
                    : actionT('approval.button')}
            </button>
            {canCancel && <button type="button" className={styles.quietButton} disabled={busy} onClick={() => onCancel(action.id!)}>{actionT('approval.cancel')}</button>}
          </div>
        </div>
      )}
      {(action.status === 'approved' || action.status === 'executing') && <p className={styles.actionResult}>{actionT('result.queued')}</p>}
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
  return value == null ? '\u2014' : JSON.stringify(value)
}
