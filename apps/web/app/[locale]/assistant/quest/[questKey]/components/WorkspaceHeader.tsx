'use client'

import { Bell, ClipboardList } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import styles from '../workspace.module.css'

export function WorkspaceHeader({
  firstName,
  secondName,
  dateLabel,
  city,
}: {
  firstName: string
  secondName: string
  dateLabel: string
  city: string | null
}) {
  const t = useTranslations('assistant')
  const router = useRouter()

  return (
    <header className={styles.appHeader}>
      <div className={styles.brand}><span className={styles.brandMark} aria-hidden="true" /><span>{t('workspace.brand')}</span></div>
      <div className={styles.weddingIdentity}>
        <strong>{t('workspace.couple', { first: firstName, second: secondName })}</strong>
        <span>{dateLabel}{city ? ` · ${city}` : ''}</span>
      </div>
      <div className={styles.headerActions}>
        <div className={styles.presence} aria-label={t('workspace.members')}>
          <span className={`${styles.avatar} ${styles.firstAvatar}`}>{firstName.slice(0, 1).toUpperCase()}</span>
          <span className={`${styles.avatar} ${styles.secondAvatar}`}>{secondName.slice(0, 1).toUpperCase()}</span>
        </div>
        <button type="button" className={styles.notesButton} aria-label={t('workspace.allPlanning')} onClick={() => router.push('/board')}>
          <span className={styles.notesLabel}>{t('workspace.allPlanning')}</span>
          <ClipboardList className={styles.notesIcon} size={15} aria-hidden="true" />
        </button>
        <button type="button" className={styles.iconButton} aria-label={t('workspace.notifications')} onClick={() => router.push('/actions')}><Bell size={15} /></button>
      </div>
    </header>
  )
}
