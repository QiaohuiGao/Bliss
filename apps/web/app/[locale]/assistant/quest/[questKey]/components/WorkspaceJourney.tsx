'use client'

import { type CSSProperties, useRef } from 'react'
import type { QuestProgress } from '@bliss/types'
import { QUEST_KEYS } from '@bliss/types'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { useContent } from '@/lib/content'
import styles from '../workspace.module.css'

export function WorkspaceJourney({
  questKey,
  progress,
  decisionPercent,
  confirmedTotal,
}: {
  questKey: string
  progress: QuestProgress[]
  decisionPercent: number
  confirmedTotal: number
}) {
  const t = useTranslations('assistant')
  const content = useContent()
  const router = useRouter()
  const trackRef = useRef<HTMLElement>(null)

  const move = (direction: -1 | 1) => {
    const track = trackRef.current
    if (track) track.scrollBy({ left: track.clientWidth * .8 * direction, behavior: 'smooth' })
  }

  return (
    <section className={styles.journeyBar} aria-label={t('workspace.journeyLabel')}>
      <div className={styles.journeyCopy}>
        <p className={styles.eyebrow}>{t('workspace.ourWedding')}</p>
        <strong>{t('workspace.chaptersTitle')}</strong>
        <span>{t('workspace.chaptersBody')}</span>
      </div>
      <div className={styles.journeyCarousel}>
        <button type="button" className={styles.journeyControl} aria-label={t('workspace.previousChapters')} onClick={() => move(-1)}><ChevronLeft size={15} /></button>
        <nav
          ref={trackRef}
          className={styles.journeyTrack}
          aria-label={t('workspace.chaptersLabel')}
          style={{ '--journey-progress': `${decisionPercent}%` } as CSSProperties}
        >
          {QUEST_KEYS.map(chapterKey => {
            const chapterProgress = progress.find(item => item.questKey === chapterKey)
            return (
              <button
                key={chapterKey}
                type="button"
                className={styles.questNode}
                data-status={chapterProgress?.status ?? 'not_started'}
                aria-current={chapterKey === questKey ? 'step' : undefined}
                aria-label={content(`quest.${chapterKey}.title`, chapterKey.replaceAll('_', ' '))}
                title={content(`quest.${chapterKey}.title`, chapterKey.replaceAll('_', ' '))}
                onClick={() => router.push(`/assistant/quest/${chapterKey}`)}
              >
                <span className={styles.questDot} />
                <span className={styles.questLabel}>{t(`workspace.chapter.${chapterKey}`)}</span>
              </button>
            )
          })}
        </nav>
        <button type="button" className={styles.journeyControl} aria-label={t('workspace.nextChapters')} onClick={() => move(1)}><ChevronRight size={15} /></button>
      </div>
      <div className={styles.journeyScore}>
        <strong>{decisionPercent}%</strong>
        <span>{t('workspace.decisionCount', { count: confirmedTotal })}</span>
      </div>
    </section>
  )
}
