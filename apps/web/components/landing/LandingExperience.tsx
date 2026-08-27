'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/routing'
import styles from './LandingExperience.module.css'

type EntryStep = 'names' | 'engagement' | 'handoff'
type RingStep = 'start' | 'names' | 'date' | 'ready'

const CHAPTER_KEYS = [
  'vision', 'budget', 'guests', 'venue', 'vendors', 'photo', 'attire',
  'ceremony', 'design', 'invites', 'care', 'timeline', 'legal', 'finale',
] as const

const BEAT_KEYS = ['together', 'unexpected', 'kept'] as const
const PROMISE_KEYS = ['encourage', 'help', 'support', 'remember'] as const
const TIMING_KEYS = ['date', 'season', 'open'] as const

export function LandingExperience() {
  const t = useTranslations('common.marketing.landing')
  const router = useRouter()
  const [entryStep, setEntryStep] = useState<EntryStep>('names')
  const [ringStep, setRingStep] = useState<RingStep>('start')
  const [selfName, setSelfName] = useState('')
  const [partnerName, setPartnerName] = useState('')
  const [engagedOn, setEngagedOn] = useState('')
  const [timing, setTiming] = useState<typeof TIMING_KEYS[number] | null>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        entry.target.setAttribute('data-visible', 'true')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.25 })
    document.querySelectorAll('[data-story-beat]').forEach(node => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  const ringCaption = useMemo(() => {
    if (ringStep === 'names') return t('rings.named', { selfName, partnerName })
    if (ringStep === 'date') return t('rings.date')
    if (ringStep === 'ready') return t('rings.ready')
    return t('rings.start')
  }, [partnerName, ringStep, selfName, t])

  function continueNames() {
    if (!selfName.trim() || !partnerName.trim()) return
    setRingStep('names')
    setEntryStep('engagement')
  }

  function continueEngagement() {
    setRingStep(engagedOn ? 'date' : 'ready')
    window.setTimeout(() => {
      setRingStep('ready')
      setEntryStep('handoff')
    }, engagedOn ? 420 : 0)
  }

  function startPlanning() {
    window.localStorage.setItem('bliss:intake', JSON.stringify({
      selfName: selfName.trim(),
      partnerName: partnerName.trim(),
      engagedOn: engagedOn || null,
      weddingTiming: timing,
    }))
    router.push('/sign-up')
  }

  return (
    <main className={styles.root}>
      <div className={styles.page}>
        <header className={styles.siteHeader}>
          <a className={styles.brand} href="#top" aria-label={t('brandLabel')}>
            <span className={styles.brandMark} aria-hidden="true" />
            <span>{t('brandName')}</span>
          </a>
          <Link className={styles.headerLink} href="/sign-in">{t('signIn')}</Link>
        </header>

        <section className={styles.hero} id="top">
          <div className={styles.heroCopy}>
            <p className={`${styles.eyebrow} ${styles.fadeUp}`}>{t('hero.eyebrow')}</p>
            <h1>
              <span className={styles.reveal}><span>{t('hero.line1')}</span></span>
              <span className={styles.reveal}><span>{t('hero.line2')}</span></span>
              <span className={styles.reveal}><span><em>{t('hero.line3')}</em></span></span>
            </h1>
            <p className={styles.heroBody}>{t('hero.body')}</p>
            <p className={styles.heroNote}><i aria-hidden="true" />{t('hero.note')}</p>
          </div>

          <div className={styles.rings} data-step={ringStep}>
            <svg viewBox="0 0 400 260" role="img" aria-labelledby="ringsTitle">
              <title id="ringsTitle">{t('rings.label')}</title>
              <defs>
                <clipPath id="landingLensClip"><circle cx="170" cy="130" r="63" /></clipPath>
                <linearGradient id="landingLensFill" x1="0" x2="1">
                  <stop offset="0%" stopColor="#52677a" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#a16f68" stopOpacity="0.16" />
                </linearGradient>
              </defs>
              <g className={`${styles.ringGroup} ${styles.groupA}`}><circle className={`${styles.ring} ${styles.ringA}`} cx="170" cy="130" r="63" /></g>
              <g className={`${styles.ringGroup} ${styles.groupB}`}>
                <g className={styles.lens} clipPath="url(#landingLensClip)"><circle cx="230" cy="130" r="63" fill="url(#landingLensFill)" /></g>
                <circle className={`${styles.ring} ${styles.ringB}`} cx="230" cy="130" r="63" />
              </g>
              <circle className={styles.knot} cx="200" cy="130" r="5" fill="#52677a" />
            </svg>
            <p className={styles.ringCaption}>{ringCaption}</p>
          </div>
        </section>

        <section className={styles.beats} aria-label={t('beatsLabel')}>
          {BEAT_KEYS.map((key, index) => (
            <article key={key} className={styles.beat} data-story-beat>
              <p className={styles.beatIndex}>{t(`beats.${key}.index`, { index: index + 1 })}</p>
              <h2>{t(`beats.${key}.title`)}</h2>
              <p>{t(`beats.${key}.body`)}</p>
            </article>
          ))}
        </section>

        <section className={styles.chapters} aria-labelledby="chaptersTitle">
          <div className={styles.chaptersHead}>
            <div><p className={styles.eyebrow}>{t('chapters.eyebrow')}</p><h2 id="chaptersTitle">{t('chapters.title')}</h2></div>
            <p>{t('chapters.body')}</p>
          </div>
          <div className={styles.chapterArc} aria-label={t('chapters.label')}>
            {CHAPTER_KEYS.map(key => <div className={styles.chapter} key={key}><span className={styles.chapterDot} /><span className={styles.chapterName}>{t(`chapters.items.${key}`)}</span></div>)}
          </div>
          <p className={styles.chaptersFoot}><span aria-hidden="true">◆</span><span>{t('chapters.note')}</span></p>
        </section>

        <section className={styles.entry} id="entry">
          <div className={styles.entryCopy}>
            <p className={styles.eyebrow}>{t('entry.eyebrow')}</p>
            <h2>{t('entry.title')}</h2>
            <p>{t('entry.body')}</p>
            <ul className={styles.promise}>
              {PROMISE_KEYS.map(key => <li key={key}><i aria-hidden="true" /><span><b>{t(`entry.promise.${key}.title`)}</b> — {t(`entry.promise.${key}.body`)}</span></li>)}
            </ul>
          </div>

          <div className={styles.entryCard}>
            <div className={styles.cardTop}><span className={styles.blissOrb} aria-hidden="true">{t('orb')}</span><span className={styles.cardStep}>{t(`entry.step.${entryStep}`)}</span></div>
            <div className={styles.cardBody}>
              {entryStep === 'names' && (
                <section className={styles.question}>
                  <h3>{t('entry.names.title')}</h3><p>{t('entry.names.body')}</p>
                  <div className={styles.fieldPair}>
                    <div className={`${styles.field} ${styles.fieldA}`}><label htmlFor="nameA">{t('entry.names.self')}</label><input id="nameA" value={selfName} onChange={event => setSelfName(event.target.value)} autoComplete="given-name" placeholder={t('entry.names.selfPlaceholder')} /></div>
                    <span className={styles.amp} aria-hidden="true">&amp;</span>
                    <div className={`${styles.field} ${styles.fieldB}`}><label htmlFor="nameB">{t('entry.names.partner')}</label><input id="nameB" value={partnerName} onChange={event => setPartnerName(event.target.value)} autoComplete="off" placeholder={t('entry.names.partnerPlaceholder')} /></div>
                  </div>
                  <div className={styles.cardActions}><button className={styles.primaryButton} type="button" disabled={!selfName.trim() || !partnerName.trim()} onClick={continueNames}>{t('entry.continue')}</button></div>
                  <p className={styles.assurance}>{t('entry.names.assurance')}</p>
                </section>
              )}
              {entryStep === 'engagement' && (
                <section className={styles.question}>
                  <h3>{t('entry.engagement.title')}</h3><p>{t('entry.engagement.body')}</p>
                  <div className={styles.singleField}><div className={styles.field}><label htmlFor="engagedOn">{t('entry.engagement.label')}</label><input id="engagedOn" type="date" value={engagedOn} onChange={event => setEngagedOn(event.target.value)} autoFocus /></div></div>
                  <div className={styles.cardActions}><button className={styles.primaryButton} type="button" disabled={!engagedOn} onClick={continueEngagement}>{t('entry.continue')}</button><button className={styles.textButton} type="button" onClick={continueEngagement}>{t('entry.engagement.skip')}</button></div>
                  <p className={styles.assurance}>{t('entry.engagement.assurance')}</p>
                </section>
              )}
              {entryStep === 'handoff' && (
                <section className={styles.question}>
                  <div className={styles.bubble}><p>{timing ? t('entry.handoff.noted', { timing: t(`entry.handoff.timing.${timing}`) }) : t('entry.handoff.greeting', { selfName, partnerName })}</p><p>{t('entry.handoff.body')}</p></div>
                  <div className={styles.chipRow}>{TIMING_KEYS.map(key => <button key={key} className={timing === key ? `${styles.chip} ${styles.chipSelected}` : styles.chip} type="button" onClick={() => setTiming(key)}>{t(`entry.handoff.timing.${key}`)}</button>)}</div>
                  <div className={styles.cardActions}><button className={styles.primaryButton} type="button" onClick={startPlanning}>{t('entry.handoff.enter')}</button></div>
                  <p className={styles.assurance}>{t('entry.handoff.assurance')}</p>
                </section>
              )}
            </div>
          </div>
        </section>

        <footer className={styles.siteFooter}><span>{t('footer.tagline')}</span><nav><a href="#top">{t('footer.how')}</a><a href="#entry">{t('footer.privacy')}</a><a href="mailto:hello@bliss.example">{t('footer.contact')}</a></nav></footer>
      </div>
    </main>
  )
}
