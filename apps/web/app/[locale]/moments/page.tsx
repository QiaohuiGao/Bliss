'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type {
  BlissMoment,
  MemoryProfile,
  MemoryProfileClaim,
  MomentAsset,
  Wedding,
} from '@bliss/types'
import {
  ArrowLeft,
  BookHeart,
  Camera,
  Check,
  Heart,
  Leaf,
  Pencil,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useRouter } from '@/i18n/routing'
import { api } from '@/lib/api'
import { useToken } from '@/lib/useToken'
import { cn } from '@/lib/utils'

export default function MomentsPage() {
  const t = useTranslations('moments')
  const locale = useLocale()
  const router = useRouter()
  const getToken = useToken()
  const booted = useRef(false)
  const [wedding, setWedding] = useState<Wedding | null>(null)
  const [profile, setProfile] = useState<MemoryProfile | null>(null)
  const [moments, setMoments] = useState<BlissMoment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refresh(currentWedding: Wedding, token: string) {
    const [nextProfile, nextMoments] = await Promise.all([
      api.getMemoryProfile(currentWedding.id, token),
      api.getMoments(currentWedding.id, token),
    ])
    setProfile(nextProfile)
    setMoments(nextMoments)
  }

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    async function load() {
      try {
        const token = await getToken()
        const currentWedding = await api.getMyWedding(token)
        setWedding(currentWedding)
        await refresh(currentWedding, token)
      } catch {
        router.push('/onboarding')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [getToken, router])

  const memoryGroups = useMemo(() => {
    if (!profile) return []
    return [
      { key: 'wedding', claims: profile.wedding, memberName: null },
      { key: 'couple', claims: profile.couple, memberName: null },
      ...Object.entries(profile.members).map(([memberId, claims]) => ({
        key: 'member',
        claims,
        memberName: profile.memberNames[memberId] ?? null,
      })),
    ].filter(group => group.claims.length > 0)
  }, [profile])

  async function updateMoment(moment: BlissMoment, status: BlissMoment['status']) {
    if (!wedding) return
    setError(null)
    try {
      const token = await getToken()
      const updated = await api.updateMoment(wedding.id, moment.id, status, token)
      setMoments(current => current.map(item => item.id === moment.id ? { ...item, ...updated } : item))
    } catch {
      setError(t('state.error'))
    }
  }

  if (loading || !wedding || !profile) {
    return (
      <div className="min-h-screen bg-gradient-meadow flex items-center justify-center px-6">
        <div className="text-center">
          <Leaf className="w-9 h-9 text-bliss-sage animate-sway mx-auto mb-4" />
          <p className="text-sm text-bliss-muted">{t('state.loading')}</p>
        </div>
      </div>
    )
  }

  const visibleMoments = moments.filter(moment => moment.status !== 'dismissed')

  return (
    <div className="min-h-screen bg-gradient-meadow relative overflow-hidden">
      <div className="fixed top-20 right-0 w-72 h-72 bg-bliss-terra-mist/50 rounded-full translate-x-1/3 blur-3xl pointer-events-none" />
      <header className="sticky top-0 z-30 bg-bliss-surface/80 backdrop-blur-xl border-b border-white/60">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => router.push('/dashboard')} className="btn-ghost -ml-3 flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-serif text-lg">Bliss</span>
          </button>
          <button onClick={() => router.push('/assistant/quest/foundation')} className="btn-ghost text-xs flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            {t('eyebrow')}
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-4 pt-10 pb-24">
        <section className="text-center mb-10 animate-slide-up">
          <BookHeart className="w-8 h-8 text-bliss-terra mx-auto mb-3" />
          <p className="text-[11px] uppercase tracking-[0.18em] text-bliss-terra-dark font-bold mb-2">{t('eyebrow')}</p>
          <h1 className="font-serif text-4xl text-bliss-ink mb-3">{t('title')}</h1>
          <p className="text-sm text-bliss-ink-light max-w-xl mx-auto leading-relaxed">{t('subtitle')}</p>
        </section>

        <section className="mb-12">
          <div className="mb-4">
            <h2 className="font-serif text-2xl text-bliss-ink">{t('memory.title')}</h2>
            <p className="text-sm text-bliss-muted mt-1">{t('memory.subtitle')}</p>
          </div>
          {memoryGroups.length === 0 ? (
            <div className="card p-7 text-center text-sm text-bliss-muted">{t('memory.empty')}</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {memoryGroups.flatMap(group => group.claims.map(claim => (
                <MemoryCard
                  key={claim.id}
                  claim={claim}
                  groupLabel={group.key === 'member' && group.memberName
                    ? t('memory.memberNamed', { name: group.memberName })
                    : t(`memory.${group.key as 'wedding' | 'couple' | 'member'}`)}
                  wedding={wedding}
                  onUpdated={async () => {
                    const token = await getToken()
                    await refresh(wedding, token)
                  }}
                />
              )))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-5">
            <Heart className="w-5 h-5 text-bliss-terra-dark" />
            <h2 className="font-serif text-2xl text-bliss-ink">{t('timeline.title')}</h2>
          </div>
          {visibleMoments.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-3xl mb-3">🌿</div>
              <p className="text-sm text-bliss-muted">{t('timeline.empty')}</p>
            </div>
          ) : (
            <div className="space-y-5">
              {visibleMoments.map(moment => (
                <MomentCard
                  key={moment.id}
                  moment={moment}
                  wedding={wedding}
                  date={new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(moment.createdAt))}
                  onSave={() => updateMoment(moment, 'saved')}
                  onDismiss={() => updateMoment(moment, 'dismissed')}
                  onChanged={async () => {
                    const token = await getToken()
                    await refresh(wedding, token)
                  }}
                />
              ))}
            </div>
          )}
        </section>

        {error && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-bliss-terra-dark text-white rounded-full px-5 py-3 text-sm shadow-warm-lg">{error}</div>}
      </main>
    </div>
  )
}

function MemoryCard({
  claim,
  groupLabel,
  wedding,
  onUpdated,
}: {
  claim: MemoryProfileClaim
  groupLabel: string
  wedding: Wedding
  onUpdated: () => Promise<void>
}) {
  const t = useTranslations('moments')
  const getToken = useToken()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(memoryText(claim.value))
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!value.trim() || !reason.trim()) return
    setSaving(true)
    try {
      const token = await getToken()
      await api.correctMemoryClaim(wedding.id, claim.id, value.trim(), reason.trim(), token)
      setEditing(false)
      await onUpdated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[10px] uppercase tracking-[0.14em] text-bliss-sage-dark font-bold">{groupLabel}</span>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-bliss-muted hover:text-bliss-ink flex items-center gap-1">
            <Pencil className="w-3 h-3" /> {t('memory.correct')}
          </button>
        )}
      </div>
      {!editing ? (
        <p className="font-serif text-lg text-bliss-ink leading-snug">{memoryText(claim.value)}</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <textarea value={value} onChange={event => setValue(event.target.value)} className="input-warm text-sm" placeholder={t('memory.newValue')} />
          <textarea value={reason} onChange={event => setReason(event.target.value)} className="input-warm text-sm" placeholder={t('memory.reason')} />
          <div className="flex gap-2">
            <button type="submit" disabled={saving || !value.trim() || !reason.trim()} className="btn-primary py-2 px-4 text-xs">
              {saving ? t('memory.saving') : t('memory.save')}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn-ghost text-xs">{t('memory.cancel')}</button>
          </div>
        </form>
      )}
    </article>
  )
}

function MomentCard({
  moment,
  wedding,
  date,
  onSave,
  onDismiss,
  onChanged,
}: {
  moment: BlissMoment
  wedding: Wedding
  date: string
  onSave: () => void
  onDismiss: () => void
  onChanged: () => Promise<void>
}) {
  const t = useTranslations('moments')
  const getToken = useToken()
  const [addingPhoto, setAddingPhoto] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [kind, setKind] = useState<MomentAsset['kind']>('memory')
  const [savingPhoto, setSavingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [removingPhotoId, setRemovingPhotoId] = useState<string | null>(null)

  async function addPhoto(event: FormEvent) {
    event.preventDefault()
    if (!photo) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type)) {
      setPhotoError(t('timeline.photoTypeError'))
      return
    }
    if (photo.size > 10 * 1024 * 1024) {
      setPhotoError(t('timeline.photoSizeError'))
      return
    }
    setSavingPhoto(true)
    setPhotoError(null)
    try {
      const token = await getToken()
      const intent = await api.createMediaUploadIntent(wedding.id, {
        purpose: 'moment',
        contentType: photo.type as 'image/jpeg' | 'image/png' | 'image/webp',
        sizeBytes: photo.size,
        originalFilename: photo.name,
      }, token)
      const uploaded = await fetch(intent.uploadUrl, {
        method: 'PUT',
        headers: intent.uploadHeaders,
        body: photo,
      })
      if (!uploaded.ok) throw new Error(`Storage upload failed with ${uploaded.status}`)
      await api.addMomentAsset(wedding.id, moment.id, {
        uploadIntentId: intent.id,
        caption: caption.trim() || null,
        kind,
      }, token)
      setPhoto(null)
      setCaption('')
      setAddingPhoto(false)
      await onChanged()
    } catch {
      setPhotoError(t('timeline.photoUploadError'))
    } finally {
      setSavingPhoto(false)
    }
  }

  async function removePhoto(assetId: string) {
    if (!window.confirm(t('timeline.removePhotoConfirm'))) return
    setRemovingPhotoId(assetId)
    setPhotoError(null)
    try {
      const token = await getToken()
      await api.deleteMomentAsset(wedding.id, assetId, token)
      await onChanged()
    } catch {
      setPhotoError(t('timeline.removePhotoError'))
    } finally {
      setRemovingPhotoId(null)
    }
  }

  return (
    <article className="rounded-warm-xl bg-white/90 border border-white shadow-warm-lg overflow-hidden">
      {moment.assets.length > 0 && (
        <div className={cn('grid gap-1 bg-bliss-linen', moment.assets.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
          {moment.assets.map(asset => (
            <figure key={asset.id} className="relative aspect-[4/3] overflow-hidden">
              {/* Signed private-media URLs are intentionally loaded directly and expire before an image optimizer can safely cache them. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.url} alt={asset.caption ?? moment.title} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => void removePhoto(asset.id)}
                disabled={removingPhotoId === asset.id}
                aria-label={t('timeline.removePhoto')}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-bliss-terra-dark shadow-warm transition-colors hover:bg-white disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              {asset.caption && <figcaption className="absolute inset-x-0 bottom-0 bg-black/45 text-white text-xs px-3 py-2">{asset.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}
      <div className="p-5 md:p-7">
        <div className="flex items-center justify-between gap-3 mb-3">
          <span className={cn(
            'text-[10px] uppercase tracking-[0.14em] font-bold flex items-center gap-1.5',
            moment.status === 'saved' ? 'text-bliss-sage-dark' : 'text-bliss-terra-dark',
          )}>
            {moment.status === 'saved' ? <Check className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
            {t(`timeline.${moment.status}`)}
          </span>
          <time className="text-xs text-bliss-muted">{date}</time>
        </div>
        <h3 className="font-serif text-2xl text-bliss-ink">{moment.title}</h3>
        <p className="text-sm text-bliss-ink-light leading-relaxed mt-2">{moment.narrative}</p>
        {photoError && !addingPhoto && <p role="alert" className="mt-3 text-xs text-bliss-terra-dark">{photoError}</p>}

        {addingPhoto && (
          <form onSubmit={addPhoto} className="mt-5 rounded-warm bg-bliss-cream p-4 space-y-3">
            <label className="block text-xs text-bliss-muted">
              {t('timeline.choosePhoto')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={event => {
                  setPhoto(event.target.files?.[0] ?? null)
                  setPhotoError(null)
                }}
                className="input-warm text-sm mt-1.5 file:mr-3 file:rounded-full file:border-0 file:bg-bliss-sage-pale file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-bliss-sage-dark"
              />
              <span className="block mt-1.5">{t('timeline.photoHelp')}</span>
            </label>
            <input value={caption} onChange={event => setCaption(event.target.value)} className="input-warm text-sm" placeholder={t('timeline.caption')} />
            <label className="block text-xs text-bliss-muted">
              {t('timeline.photoKind')}
              <select value={kind} onChange={event => setKind(event.target.value as MomentAsset['kind'])} className="input-warm text-sm mt-1.5">
                {(['memory', 'before', 'after', 'reference'] as const).map(value => (
                  <option key={value} value={value}>{t(`timeline.kind.${value}`)}</option>
                ))}
              </select>
            </label>
            {photoError && <p role="alert" className="text-xs text-bliss-terra-dark">{photoError}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={savingPhoto || !photo} className="btn-primary py-2 px-4 text-xs">
                {savingPhoto ? t('timeline.uploadingPhoto') : t('timeline.addPhoto')}
              </button>
              <button type="button" onClick={() => {
                setAddingPhoto(false)
                setPhoto(null)
                setPhotoError(null)
              }} className="btn-ghost text-xs">{t('memory.cancel')}</button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap gap-2 mt-5">
          {moment.status === 'suggested' && (
            <button onClick={onSave} className="btn-primary py-2.5 px-5 text-xs flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5" /> {t('timeline.save')}
            </button>
          )}
          <button onClick={() => setAddingPhoto(current => !current)} className="btn-secondary py-2.5 px-4 text-xs flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5" /> {t('timeline.photo')}
          </button>
          {moment.status === 'suggested' && (
            <button onClick={onDismiss} className="btn-ghost text-xs flex items-center gap-1">
              <X className="w-3 h-3" /> {t('timeline.dismiss')}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function memoryText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}
