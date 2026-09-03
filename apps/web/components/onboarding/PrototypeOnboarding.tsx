'use client'

import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { GuestCountRange, OnboardingIntakeClaim, OnboardingPayload, QuestKey } from '@bliss/types'
import { QUEST_KEYS } from '@bliss/types'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { api } from '@/lib/api'
import { useToken } from '@/lib/useToken'
import styles from './PrototypeOnboarding.module.css'

type StepKey = 'feeling' | 'date' | 'place' | 'people' | 'support'
type IntakeDraft = {
  selfName?: string
  partnerName?: string
  engagedOn?: string | null
  weddingTiming?: 'date' | 'season' | 'open' | null
}
type Turn = { id: string; role: 'user' | 'agent'; text: string; next?: string }
type Claim = OnboardingIntakeClaim & { noteKey: string; labelKey: string }

const STEPS: Array<{
  key: StepKey
  claimKey: OnboardingIntakeClaim['key']
  kind: OnboardingIntakeClaim['kind']
  touches: QuestKey[]
  chips: string[]
}> = [
  { key: 'feeling', claimKey: 'feeling', kind: 'priority', touches: ['foundation', 'design_flowers', 'ceremony'], chips: ['relaxed', 'alive', 'intimate', 'different'] },
  { key: 'date', claimKey: 'date_horizon', kind: 'fact', touches: ['foundation', 'venue_date', 'legal', 'final_30_and_day_of'], chips: ['june', 'season', 'open'] },
  { key: 'place', claimKey: 'place', kind: 'fact', touches: ['venue_date', 'guest_experience', 'legal'], chips: ['hudson', 'family', 'open'] },
  { key: 'people', claimKey: 'guest_shape', kind: 'fact', touches: ['foundation', 'venue_date', 'guests_stationery', 'guest_experience'], chips: ['small', 'hundred', 'large', 'different'] },
  { key: 'support', claimKey: 'support_style', kind: 'preference', touches: ['foundation', 'vendor_team', 'pre_wedding_events', 'final_30_and_day_of'], chips: ['next', 'options', 'conflict', 'learn'] },
]

export function PrototypeOnboarding() {
  const t = useTranslations('onboarding.conversation')
  const router = useRouter()
  const getToken = useToken()
  const scrollRef = useRef<HTMLDivElement>(null)
  const chapterRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [draft, setDraft] = useState<IntakeDraft>({})
  const [stepIndex, setStepIndex] = useState(0)
  const [turns, setTurns] = useState<Turn[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [touched, setTouched] = useState<QuestKey[]>([])
  const [activeChapterIndex, setActiveChapterIndex] = useState(0)
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [finished, setFinished] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingClaimKey, setEditingClaimKey] = useState<OnboardingIntakeClaim['key'] | null>(null)
  const [correctionDraft, setCorrectionDraft] = useState('')

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('bliss:intake')
      if (stored) setDraft(JSON.parse(stored) as IntakeDraft)
    } catch {
      window.localStorage.removeItem('bliss:intake')
    }
  }, [])

  const coupleName = useMemo(() => {
    if (draft.selfName && draft.partnerName) return t('couple', draft as { selfName: string; partnerName: string })
    return t('coupleFallback')
  }, [draft, t])

  const current = STEPS[stepIndex]
  const scrollDown = () => window.requestAnimationFrame(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  })

  function showChapter(index: number) {
    const nextIndex = Math.max(0, Math.min(QUEST_KEYS.length - 1, index))
    setActiveChapterIndex(nextIndex)
    chapterRefs.current[nextIndex]?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }

  function finish() {
    setFinished(true)
    setThinking(false)
  }

  function answer(value: string) {
    const text = value.trim()
    if (!text || !current || thinking) return
    const step = current
    setInput('')
    setTurns(items => [...items, { id: crypto.randomUUID(), role: 'user', text }])
    setThinking(true)
    scrollDown()
    window.setTimeout(() => {
      const nextIndex = stepIndex + 1
      setTurns(items => [...items, {
        id: crypto.randomUUID(),
        role: 'agent',
        text: t(`steps.${step.key}.reply`, { answer: text }),
        next: nextIndex < STEPS.length ? t(`steps.${STEPS[nextIndex]!.key}.question`) : undefined,
      }])
      setClaims(items => [...items, {
        key: step.claimKey,
        kind: step.kind,
        value: text,
        labelKey: `steps.${step.key}.claimLabel`,
        noteKey: `steps.${step.key}.claimNote`,
      }])
      setTouched(items => {
        const next = Array.from(new Set([...items, ...step.touches]))
        const newestChapterIndex = QUEST_KEYS.findIndex(key => step.touches.includes(key))
        if (newestChapterIndex >= 0) window.requestAnimationFrame(() => showChapter(newestChapterIndex))
        return next
      })
      setThinking(false)
      if (nextIndex >= STEPS.length) finish()
      else setStepIndex(nextIndex)
      scrollDown()
    }, 650)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    answer(input)
  }

  function skip() {
    if (!current || thinking) return
    const nextIndex = stepIndex + 1
    if (nextIndex >= STEPS.length) finish()
    else {
      setStepIndex(nextIndex)
      setTurns(items => [...items, {
        id: crypto.randomUUID(),
        role: 'agent',
        text: t('skipped'),
        next: t(`steps.${STEPS[nextIndex]!.key}.question`),
      }])
    }
  }

  function guestRange(): GuestCountRange | undefined {
    const answer = claims.find(claim => claim.key === 'guest_shape')?.value.toLowerCase()
    if (!answer) return undefined
    if (answer.includes('small') || answer.includes('close')) return 'under_50'
    if (answer.includes('100') || answer.includes('hundred')) return '50_100'
    if (answer.includes('big') || answer.includes('large')) return '150_250'
    return undefined
  }

  function startCorrection(claim: Claim) {
    setEditingClaimKey(claim.key)
    setCorrectionDraft(claim.value)
  }

  function saveCorrection(event: FormEvent, claimKey: OnboardingIntakeClaim['key']) {
    event.preventDefault()
    const value = correctionDraft.trim()
    if (!value) return
    setClaims(items => items.map(claim => claim.key === claimKey ? { ...claim, value } : claim))
    setEditingClaimKey(null)
    setCorrectionDraft('')
  }

  async function openWorkspace() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const token = await getToken()
      const payload: OnboardingPayload = {
        ownerDisplayName: draft.selfName || undefined,
        partnerDisplayName: draft.partnerName || undefined,
        engagementDate: draft.engagedOn || undefined,
        weddingTiming: draft.weddingTiming || undefined,
        guestCountRange: guestRange(),
        intakeClaims: claims.map(({ key, kind, value }) => ({ key, kind, value })),
        weeklyCapacityHours: 5,
      }
      await api.createWedding(payload, token)
      window.localStorage.removeItem('bliss:intake')
      router.push('/dashboard')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : ''
      if (message.includes('already has a wedding')) {
        router.push('/dashboard')
        return
      }
      setError(t('error'))
      setSaving(false)
    }
  }

  return (
    <main className={styles.root}>
      <section className={styles.shell}>
        <header className={styles.top}>
          <div className={styles.brand}><span className={styles.brandMark} aria-hidden="true" /><span>{t('brand')}</span></div>
          <div className={styles.topProgress}><span className={styles.pips} aria-hidden="true">{STEPS.map((step, index) => <i key={step.key} data-state={index < stepIndex ? 'filled' : index === stepIndex && !finished ? 'active' : 'idle'} />)}</span><span>{finished ? t('ready') : t(`steps.${current?.key ?? 'support'}.progress`)}</span></div>
          <button className={styles.leaveButton} type="button" onClick={finish}>{t('enough')}</button>
        </header>

        <div className={styles.body}>
          <section className={styles.talk} aria-label={t('talkLabel')}>
            <div className={styles.talkScroll} ref={scrollRef}>
              <div className={styles.talkInner}>
                <div className={styles.opening}><p className={styles.eyebrow}>{coupleName}</p><h1>{t('title')} <em>{t('titleEmphasis')}</em></h1><p>{t('intro')}</p></div>
                <div className={styles.turns}>
                  <article className={`${styles.turn} ${styles.agentTurn}`}><span className={styles.blissOrb} aria-hidden="true">{t('orb')}</span><div className={styles.bubble}><p>{t('welcome', { coupleName })}</p><p>{t('steps.feeling.question')}</p></div></article>
                  {turns.map(turn => turn.role === 'user' ? (
                    <article className={`${styles.turn} ${styles.userTurn}`} key={turn.id}><div className={styles.bubble}><p>{turn.text}</p></div><span className={styles.avatar}>{draft.selfName?.charAt(0).toUpperCase() || t('avatar')}</span></article>
                  ) : (
                    <article className={`${styles.turn} ${styles.agentTurn}`} key={turn.id}><span className={styles.blissOrb} aria-hidden="true">{t('orb')}</span><div className={styles.bubble}><p>{turn.text}</p>{turn.next && <p>{turn.next}</p>}</div></article>
                  ))}
                  {thinking && <article className={`${styles.turn} ${styles.agentTurn}`}><span className={styles.blissOrb} aria-hidden="true">{t('orb')}</span><span className={styles.thinking}><i />{t('thinking')}</span></article>}
                </div>
              </div>
            </div>
            <div className={styles.composerShell}>
              {!finished && current && <div className={styles.chipRow}>{current.chips.map(key => <button className={styles.chip} key={key} type="button" onClick={() => answer(t(`steps.${current.key}.chips.${key}`))}>{t(`steps.${current.key}.chips.${key}`)}</button>)}<button className={`${styles.chip} ${styles.skipChip}`} type="button" onClick={skip}>{t('skip')}</button></div>}
              <form className={styles.composer} onSubmit={submit}><textarea value={input} onChange={event => setInput(event.target.value)} rows={1} disabled={thinking || finished} aria-label={t('inputLabel')} placeholder={finished ? t('finishedPlaceholder') : t('placeholder')} /><button type="submit" disabled={!input.trim() || thinking || finished} aria-label={t('send')}>↑</button></form>
              <p className={styles.composerNote}>{finished ? t('finishedNote') : t('note')}</p>
            </div>
          </section>

          <aside className={styles.knows} aria-labelledby="knowsTitle">
            <div className={styles.knowsHead}><strong id="knowsTitle">{t('knows.title')}</strong><span>{claims.length}</span></div>
            <p>{t('knows.body')}</p>
            <div className={styles.claims}>{claims.length === 0 ? <div className={styles.knowsEmpty}>{t('knows.empty')}</div> : claims.map(claim => <article className={styles.claim} data-who="both" key={claim.key}><div><span>{t(claim.labelKey)}</span><small>{t('knows.source')}</small></div><strong>{claim.value}</strong><p>{t(claim.noteKey)}</p>{editingClaimKey === claim.key ? <form className={styles.claimEditor} onSubmit={event => saveCorrection(event, claim.key)}><label className="sr-only" htmlFor={`claim-${claim.key}`}>{t('knows.correctionLabel')}</label><input id={`claim-${claim.key}`} value={correctionDraft} onChange={event => setCorrectionDraft(event.target.value)} autoFocus /><div><button type="submit" disabled={!correctionDraft.trim()}>{t('knows.saveCorrection')}</button><button type="button" onClick={() => setEditingClaimKey(null)}>{t('knows.cancelCorrection')}</button></div></form> : <button className={styles.claimFix} type="button" onClick={() => startCorrection(claim)}>{t('knows.correct')}</button>}</article>)}</div>
            <section className={styles.chaptersMini} aria-labelledby="onboardingChaptersTitle">
              <div className={styles.chaptersHead}>
                <div><h3 id="onboardingChaptersTitle">{t('chapters.title')}</h3><p>{t('chapters.touched', { count: touched.length })}</p></div>
                <div className={styles.chapterControls}>
                  <button type="button" aria-label={t('chapters.previous')} onClick={() => showChapter(activeChapterIndex - 1)} disabled={activeChapterIndex === 0}><ChevronLeft size={15} /></button>
                  <button type="button" aria-label={t('chapters.next')} onClick={() => showChapter(activeChapterIndex + 1)} disabled={activeChapterIndex === QUEST_KEYS.length - 1}><ChevronRight size={15} /></button>
                </div>
              </div>
              <div className={styles.chapterViewport}>
                <div className={styles.chapterTrack} role="group" aria-roledescription="carousel" aria-label={t('chapters.label')}>
                  {QUEST_KEYS.map((chapterKey, index) => {
                    const isTouched = touched.includes(chapterKey)
                    const isActive = index === activeChapterIndex
                    return (
                      <button
                        ref={node => { chapterRefs.current[index] = node }}
                        className={styles.chapterCard}
                        data-active={isActive}
                        data-touched={isTouched}
                        type="button"
                        key={chapterKey}
                        aria-current={isActive ? 'true' : undefined}
                        aria-roledescription="slide"
                        aria-label={t('chapters.cardLabel', { current: index + 1, total: QUEST_KEYS.length, chapter: t(`chapters.items.${chapterKey}`) })}
                        onClick={() => showChapter(index)}
                      >
                        <span className={styles.chapterNumber}>{String(index + 1).padStart(2, '0')}</span>
                        <strong>{t(`chapters.items.${chapterKey}`)}</strong>
                        <span className={styles.chapterState}>{isTouched ? t('chapters.connected') : t('chapters.waiting')}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className={styles.chapterPosition} aria-live="polite">
                <span>{t('chapters.position', { current: activeChapterIndex + 1, total: QUEST_KEYS.length })}</span>
                <strong>{t(`chapters.items.${QUEST_KEYS[activeChapterIndex]}`)}</strong>
              </div>
              <p className={styles.chaptersBody}>{t('chapters.body')}</p>
            </section>
            {finished && <div className={styles.donePanel}><strong>{t('done.title')}</strong><p>{t('done.body')}</p><button type="button" onClick={openWorkspace} disabled={saving}>{saving ? t('done.saving') : t('done.action')}</button>{error && <p className={styles.error}>{error}</p>}</div>}
          </aside>
        </div>
      </section>
    </main>
  )
}
