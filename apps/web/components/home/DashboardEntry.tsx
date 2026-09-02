'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { api } from '@/lib/api'
import { resolveDashboardWorkspaceEntry, workspaceEntryPath } from '@/lib/workspace-entry'
import { useToken } from '@/lib/useToken'
import { PrototypeFirstHome } from './PrototypeFirstHome'
import styles from './PrototypeFirstHome.module.css'

export function DashboardEntry() {
  const t = useTranslations('board.firstHome')
  const router = useRouter()
  const getToken = useToken()
  const [showIntro, setShowIntro] = useState(false)

  useEffect(() => {
    async function resolveEntry() {
      try {
        const token = await getToken()
        const wedding = await api.getMyWedding(token)
        const [progress, threads] = await Promise.all([
          api.getQuestProgress(wedding.id, token),
          api.getPlanningThreads(wedding.id, token),
        ])
        const entry = resolveDashboardWorkspaceEntry(progress, threads)
        if (entry.kind === 'intro') {
          setShowIntro(true)
          return
        }
        router.replace(workspaceEntryPath(entry))
      } catch {
        router.replace('/onboarding')
      }
    }
    void resolveEntry()
  }, [getToken, router])

  if (showIntro) return <PrototypeFirstHome />
  return <main className={styles.loading}><span className={styles.brandMark} /><p>{t('loading')}</p></main>
}
