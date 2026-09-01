'use client'

import { useEffect, useMemo, useState } from 'react'
import type { DashboardResponse, MemoryProfile, MemoryProfileClaim } from '@bliss/types'
import { useLocale, useTranslations } from 'next-intl'
import { api } from '@/lib/api'
import { useRouter } from '@/i18n/routing'
import { useToken } from '@/lib/useToken'
import styles from './PrototypeFirstHome.module.css'

const INTAKE_KEYS = {
  feeling: 'intake.feeling',
  date: 'intake.date_horizon',
  place: 'intake.place',
  guests: 'intake.guest_shape',
  support: 'intake.support_style',
} as const

export function PrototypeFirstHome() {
  const t = useTranslations('board.firstHome')
  const locale = useLocale()
  const router = useRouter()
  const getToken = useToken()
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [memory, setMemory] = useState<MemoryProfile | null>(null)
  const [editing, setEditing] = useState(false)
  const [visionDraft, setVisionDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken()
        const wedding = await api.getMyWedding(token)
        const [nextDashboard, nextMemory] = await Promise.all([
          api.getDashboard(wedding.id, token),
          api.getMemoryProfile(wedding.id, token),
        ])
        setDashboard(nextDashboard)
        setMemory(nextMemory)
      } catch {
        router.push('/onboarding')
      }
    }
    void load()
  }, [getToken, router])

  const claim = (key: string) => memory?.couple.find(item => item.key === key)
  const feeling = claim(INTAKE_KEYS.feeling)
  const vision = typeof feeling?.value === 'string' ? feeling.value : t('visionFallback')

  useEffect(() => setVisionDraft(vision), [vision])

  const names = useMemo(() => {
    if (!dashboard) return { first: t('you'), second: t('partner'), label: t('coupleFallback') }
    const current = dashboard.couple.members.find(member => member.isCurrentUser)?.displayName ?? t('you')
    const joined = dashboard.couple.members.find(member => !member.isCurrentUser)?.displayName
    const partner = joined ?? dashboard.wedding.partnerDisplayName ?? t('partner')
    return { first: current, second: partner, label: t('couple', { first: current, second: partner }) }
  }, [dashboard, t])

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }

  async function saveVision() {
    const value = visionDraft.trim()
    if (!dashboard || !value || saving) return
    setSaving(true)
    try {
      const token = await getToken()
      const updated = feeling
        ? await api.correctMemoryClaim(
            dashboard.wedding.id,
            feeling.id,
            value,
            t('correctionReason'),
            token,
          )
        : await api.setIntakeMemoryClaim(
            dashboard.wedding.id,
            'feeling',
            value,
            t('correctionReason'),
            token,
          )
      setMemory(current => current ? {
        ...current,
        couple: feeling
          ? current.couple.map(item => item.id === feeling.id ? updated : item)
          : [...current.couple, updated],
      } : current)
      setEditing(false)
      showToast(t('saved'))
    } finally {
      setSaving(false)
    }
  }

  async function invitePartner() {
    if (!dashboard?.couple.canInvitePartner) return
    try {
      const token = await getToken()
      const result = await api.createPartnerInvite(dashboard.wedding.id, token)
      await navigator.clipboard.writeText(result.inviteUrl)
      showToast(t('inviteCopied'))
    } catch {
      showToast(t('inviteError'))
    }
  }

  if (!dashboard || !memory) return <main className={styles.loading}><span className={styles.brandMark} /><p>{t('loading')}</p></main>

  const valueFor = (item: MemoryProfileClaim | undefined, fallback: string) =>
    typeof item?.value === 'string' ? item.value : fallback
  const engaged = dashboard.wedding.engagementDate
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(`${dashboard.wedding.engagementDate}T00:00:00`))
    : t('notAdded')

  return (
    <main className={styles.root}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand}><span className={styles.brandMark} aria-hidden="true" />{t('brand')}</div>
          <div className={styles.identity}><strong>{names.label}</strong><span>{t('sharedSpace')}</span></div>
          <div className={styles.avatars}><span>{names.first.charAt(0).toUpperCase()}</span><button type="button" onClick={invitePartner} aria-label={dashboard.couple.canInvitePartner ? t('invite') : names.second}>{names.second.charAt(0).toUpperCase()}</button></div>
        </header>
        <section className={styles.journey}>
          <div><p className={styles.eyebrow}>{t('journey.eyebrow')}</p><h2>{t('journey.title')}</h2><span>{t('journey.body')}</span></div>
          <div className={styles.track} aria-label={t('journey.label')}>{Array.from({ length: 14 }, (_, index) => <i key={index} data-current={index === 0} />)}</div>
          <span className={styles.status}>{t('journey.status')}</span>
        </section>
        <div className={styles.main}>
          <section className={styles.hero}>
            <p className={styles.eyebrow}>{t('welcomeEyebrow')}</p>
            <h1>{t('welcome', { names: names.label })}</h1>
            <p>{t('welcomeBody')}</p>
            <article className={styles.heard}>
              <header><h2>{t('heard.title')}</h2><button type="button" onClick={() => setEditing(true)}>{t('heard.edit')}</button></header>
              {!editing ? <blockquote>{t('heard.quote', { vision })}</blockquote> : <div className={styles.editor}><textarea value={visionDraft} onChange={event => setVisionDraft(event.target.value)} autoFocus /><button type="button" onClick={saveVision} disabled={saving}>{saving ? t('heard.saving') : t('heard.save')}</button></div>}
              <small>{t('heard.note')}</small>
            </article>
          </section>
          <aside className={styles.side}>
            <section className={styles.card}><p className={styles.eyebrow}>{t('beginning.eyebrow')}</p><h2>{t('beginning.title')}</h2>
              <div className={styles.row}><span>{t('beginning.engaged')}</span><strong>{engaged}</strong></div>
              <div className={styles.row}><span>{t('beginning.timing')}</span><strong>{valueFor(claim(INTAKE_KEYS.date), t('open'))}</strong></div>
              <div className={styles.row}><span>{t('beginning.place')}</span><strong>{valueFor(claim(INTAKE_KEYS.place), t('notNarrowed'))}</strong></div>
              <div className={styles.row}><span>{t('beginning.guests')}</span><strong>{valueFor(claim(INTAKE_KEYS.guests), t('openQuestion'))}</strong></div>
              <div className={styles.row}><span>{t('beginning.support')}</span><strong>{valueFor(claim(INTAKE_KEYS.support), t('oneStep'))}</strong></div>
            </section>
            <section className={styles.card}><p className={styles.eyebrow}>{t('first.eyebrow')}</p><h2>{t('first.title')}</h2><p>{t('first.body')}</p><button className={styles.primary} type="button" onClick={() => router.push('/assistant/quest/foundation')}>{t('first.action')}</button><div className={styles.why}><b>◆</b><span>{t('first.note')}</span></div></section>
          </aside>
        </div>
      </section>
      <div className={toast ? `${styles.toast} ${styles.toastVisible}` : styles.toast} role="status">{toast}</div>
    </main>
  )
}
