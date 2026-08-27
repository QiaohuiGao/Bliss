'use client'

import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { GuestCountRange, OnboardingIntakeClaim, OnboardingPayload } from '@bliss/types'
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
  touches: number[]
  chips: string[]
}> = [
  { key: 'feeling', claimKey: 'feeling', kind: 'priority', touches: [0, 6, 8], chips: ['relaxed', 'alive', 'intimate', 'different'] },
  { key: 'date', claimKey: 'date_horizon', kind: 'fact', touches: [1, 4, 11, 12], chips: ['june', 'season', 'open'] },
  { key: 'place', claimKey: 'place', kind: 'fact', touches: [1, 3, 9], chips: ['hudson', 'family', 'open'] },
  { key: 'people', claimKey: 'guest_shape', kind: 'fact', touches: [2, 5, 7, 8], chips: ['small', 'hundred', 'large', 'different'] },
  { key: 'support', claimKey: 'support_style', kind: 'preference', touches: [0, 4, 10, 13], chips: ['next', 'options', 'conflict', 'learn'] },
]

export function PrototypeOnboarding() {
  const t = useTranslations('onboarding.conversation')
  const router = useRouter()
  const getToken = useToken()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<IntakeDraft>({})
  const [stepIndex, setStepIndex] = useState(0)
  const [turns, setTurns] = useState<Turn[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [touched, setTouched] = useState<number[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [finished, setFinished] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setTouched(items => Array.from(new Set([...items, ...step.touches])))
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
            <div className={styles.claims}>{claims.length === 0 ? <div className={styles.knowsEmpty}>{t('knows.empty')}</div> : claims.map(claim => <article className={styles.claim} key={claim.key}><div><span>{t(claim.labelKey)}</span><small>{t('knows.source')}</small></div><strong>{claim.value}</strong><p>{t(claim.noteKey)}</p></article>)}</div>
            <section className={styles.chaptersMini}><h3>{t('chapters.title')}<span>{t('chapters.touched', { count: touched.length })}</span></h3><div className={styles.miniArc} aria-hidden="true">{Array.from({ length: 14 }, (_, index) => <i key={index} data-touched={touched.includes(index)} />)}</div><p>{t('chapters.body')}</p></section>
            {finished && <div className={styles.donePanel}><strong>{t('done.title')}</strong><p>{t('done.body')}</p><button type="button" onClick={openWorkspace} disabled={saving}>{saving ? t('done.saving') : t('done.action')}</button>{error && <p className={styles.error}>{error}</p>}</div>}
          </aside>
        </div>
      </section>
    </main>
  )
}
