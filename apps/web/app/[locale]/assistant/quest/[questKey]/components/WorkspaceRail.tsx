'use client'

import type {
  QuestProgress,
  QuestScopingOverview,
  WorkspaceCapability,
  WorkspaceProcedurePhase,
} from '@bliss/types'
import { useTranslations } from 'next-intl'
import { useContent } from '@/lib/content'
import styles from '../workspace.module.css'

export function WorkspaceRail({
  chapterNumber,
  scoping,
  questProgress,
  activeQuestionKey,
  procedure,
  capabilities,
  working,
  onOpenQuestion,
}: {
  chapterNumber: number
  scoping: QuestScopingOverview
  questProgress: QuestProgress | undefined
  activeQuestionKey: string | undefined
  procedure: WorkspaceProcedurePhase[]
  capabilities: WorkspaceCapability[]
  working: boolean
  onOpenQuestion: (questionKey: string, draft?: string) => void
}) {
  const t = useTranslations('assistant')
  const content = useContent()
  const questionStatus = (questionKey: string) => (
    questProgress?.questions.find(item => item.questionKey === questionKey)?.status ?? 'not_started'
  )

  return (
    <aside className={styles.questRail}>
      <p className={styles.eyebrow}>{t('workspace.currentChapter', { number: chapterNumber })}</p>
      <h1 className={styles.questTitle}>{content(scoping.titleI18nKey, scoping.questKey)}</h1>
      <p className={styles.questSubtitle}>{content(scoping.subtitleI18nKey, t('questScoping.genericSubtitle'))}</p>

      <section className={styles.questionSwitcher} aria-labelledby="question-switcher-title">
        <h2 id="question-switcher-title">{t('workspace.questionsTitle')}</h2>
        <div className={styles.questionTabs} role="tablist" aria-orientation="vertical">
          {scoping.questions.map(question => {
            const status = questionStatus(question.questionKey)
            const active = activeQuestionKey === question.questionKey
            return (
              <button
                key={question.questionKey}
                type="button"
                role="tab"
                aria-selected={active}
                className={styles.questionTab}
                data-status={status}
                onClick={() => onOpenQuestion(question.questionKey)}
                disabled={working}
              >
                <i aria-hidden="true" />
                <span><strong>{content(question.promptI18nKey, question.questionKey)}</strong><small>{t(`workspace.questionStatus.${status}`)}</small></span>
              </button>
            )
          })}
        </div>
      </section>

      <p className={styles.phaseLabel}>{t('workspace.procedureTitle')}</p>
      <ol className={styles.phaseList}>
        {procedure.map((phase, index) => (
          <li key={phase.key} className={styles.phaseItem} data-state={phase.state} aria-current={phase.state === 'current' ? 'step' : undefined}>
            <span className={styles.phaseMark}>{phase.state === 'done' ? '✓' : index + 1}</span>
            <span className={styles.phaseCopy}><strong>{t(phase.titleI18nKey)}</strong><span>{t(`workspace.cycleState.${phase.state}`)}</span></span>
          </li>
        ))}
      </ol>

      <section className={styles.capabilityBox}>
        <h2 className={styles.sectionHeading}>{t('workspace.capabilities.title')}<span>{t('workspace.capabilities.tryOne')}</span></h2>
        <div className={styles.capabilityList}>
          {capabilities.map(capability => (
            <button
              key={capability.key}
              type="button"
              className={styles.capability}
              disabled={working || !activeQuestionKey || !capability.enabled}
              onClick={() => activeQuestionKey && onOpenQuestion(activeQuestionKey, t(capability.promptI18nKey))}
            >
              <span className={styles.capabilityIcon}>{capability.icon}</span>
              <span><strong>{t(capability.titleI18nKey)}</strong><small>{t(capability.bodyI18nKey)}</small></span>
              <span className={styles.capabilityArrow}>›</span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  )
}
