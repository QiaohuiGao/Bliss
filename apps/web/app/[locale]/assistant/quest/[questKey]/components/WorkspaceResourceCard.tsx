'use client'

import type { WorkspaceResourceCard as WorkspaceResourceCardData } from '@bliss/types'
import { Check, ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useContent } from '@/lib/content'
import styles from '../workspace.module.css'

export function WorkspaceResourceCard({ card, questKey }: { card: WorkspaceResourceCardData; questKey: string }) {
  const t = useTranslations('assistant')
  const content = useContent()
  if (card.type === 'task_effect') {
    return (
      <article className={styles.resourceCard} data-kind="task">
        <span className={styles.resourceIcon}><Check size={14} /></span>
        <span><strong>{content(`quest.${questKey}.task.${card.taskKey}.title`, card.taskKey.replaceAll('_', ' '))}</strong><small>{card.rationale}</small></span>
      </article>
    )
  }
  return (
    <article className={styles.resourceCard} data-kind="vendor">
      <span className={styles.resourceIcon}>◇</span>
      <span><strong>{card.name}</strong><small>{card.rationale}</small></span>
      <a href={card.sourceUrl} target="_blank" rel="noreferrer" aria-label={t('workspace.openSource', { name: card.name })}><ExternalLink size={13} /></a>
    </article>
  )
}
