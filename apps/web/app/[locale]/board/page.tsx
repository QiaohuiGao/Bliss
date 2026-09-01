'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { useToken } from '@/lib/useToken'
import { useContent } from '@/lib/content'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { ModulesResponse, ModuleWithProgress } from '@bliss/types'
import { Lock, CheckCircle2, ChevronRight, Clock, Leaf, MessageCircleHeart, TreePine } from 'lucide-react'

/** Keyed by templateKey. Cultural pack quests fall back to the default. */
const QUEST_ICONS: Record<string, string> = {
  foundation: '🌱', venue_date: '🏕️', vendor_team: '🌿',
  wedding_party: '💐', attire_beauty: '👗', guests_stationery: '✉️',
  guest_experience: '🧳', food_beverage: '🍷', design_flowers: '🌻',
  ceremony: '🌹', registry_rings_honeymoon: '💍', legal: '📜',
  pre_wedding_events: '🥂', final_30_and_day_of: '🎊',
  south_asian_events: '🪔', chinese_traditions: '🍵',
  jewish_traditions: '✨', korean_traditions: '🏮',
  nigerian_traditions: '🥁', persian_traditions: '🪞',
  vietnamese_traditions: '🏮',
}
const DEFAULT_QUEST_ICON = '🌿'

export default function BoardPage() {
  const router = useRouter()
  const t = useTranslations()
  const getToken = useToken()
  const [data, setData] = useState<ModulesResponse | null>(null)
  const [weddingId, setWeddingId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      try {
        const wedding = await api.getMyWedding(token)
        setWeddingId(wedding.id)
        const modules = await api.getModules(wedding.id, token)
        setData(modules)
      } catch {
        router.push('/onboarding')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [getToken, router])

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-gradient-garden flex items-center justify-center">
        <div className="text-center">
          <Leaf className="w-10 h-10 text-bliss-sage animate-sway mx-auto mb-4" />
          <p className="text-bliss-muted font-medium">{t('common.state.loading')}</p>
        </div>
      </div>
    )
  }

  const completedCount = data.modules.filter(m => m.status === 'completed').length
  const totalCount = data.modules.length

  return (
    <div className="min-h-screen bg-gradient-garden relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-20 right-0 w-72 h-72 bg-bliss-sage-mist/30 rounded-full translate-x-1/3 blur-3xl" />
      <div className="absolute bottom-40 left-0 w-60 h-60 bg-bliss-terra-mist/20 rounded-full -translate-x-1/3 blur-3xl" />

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-bliss-sage-mist/40 to-transparent" />
        <div className="relative max-w-2xl mx-auto px-4 pt-8 pb-10">
          {/* Nav */}
          <div className="flex items-center justify-between mb-8">
            <button onClick={() => router.push('/dashboard')} className="font-serif text-2xl font-light text-bliss-ink flex items-center gap-2 tracking-wider">
              <TreePine className="w-5 h-5 text-bliss-sage-dark" /> Bliss
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/assistant/quest/foundation')}
                className="btn-primary py-2 px-3 text-sm flex items-center gap-1.5"
              >
                <MessageCircleHeart className="w-4 h-4" />
                {t('common.nav.companion')}
              </button>
              <button onClick={() => router.push('/dashboard')} className="btn-ghost text-sm">
                {t('common.nav.dashboard')}
              </button>
            </div>
          </div>

          {/* Progress hero */}
          <div className="flex items-center gap-6">
            {/* Ring */}
            <div className="w-24 h-24 relative shrink-0">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#E8F0E8" strokeWidth="8" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="url(#sageGradient)" strokeWidth="8"
                  strokeDasharray={`${data.totalProgress * 2.64} 264`}
                  strokeLinecap="round" className="transition-all duration-1000" />
                <defs>
                  <linearGradient id="sageGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4D7A52" />
                    <stop offset="100%" stopColor="#7A9E7E" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-bliss-ink">{data.totalProgress}%</span>
              </div>
            </div>
            <div>
              <h1 className="font-serif text-2xl md:text-3xl text-bliss-ink mb-1 font-medium">{t('board.title')}</h1>
              <p className="text-bliss-ink-light text-sm">
                {data.daysRemaining !== null
                  ? t('board.countdown', { days: data.daysRemaining })
                  : t('board.noDate')}
                {' · '}
                {t('board.progress.quests', { completed: completedCount })}
              </p>
              {data.totalProgress > 0 && data.totalProgress < 100 && (
                <p className="text-bliss-sage-dark text-sm font-medium mt-1.5">
                  {t('board.subtitle')}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Module List */}
      <main className="max-w-2xl mx-auto px-4 pb-24 relative z-10">
        <div className="relative">
          {/* Garden path line */}
          <div className="absolute left-7 top-0 bottom-0 w-0.5 bg-bliss-sage-light/60" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, #B8D4BA 0, #B8D4BA 8px, transparent 8px, transparent 16px)' }} />

          <div className="space-y-3">
            {data.modules.map((mod, i) => (
              <ModuleCard
                key={mod.id}
                module={mod}
                index={i + 1}
                onClick={() => mod.status !== 'locked' && router.push(`/quest/${mod.id}`)}
                onUnlock={async () => {
                  const token = await getToken()
                  await api.unlockModule(mod.id, token)
                  const modules = await api.getModules(weddingId, token)
                  setData(modules)
                }}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

function ModuleCard({
  module: mod, index, onClick, onUnlock,
}: {
  module: ModuleWithProgress; index: number; onClick: () => void; onUnlock: () => void
}) {
  const t = useTranslations()
  const content = useContent()
  const icon = QUEST_ICONS[mod.templateKey ?? ''] ?? DEFAULT_QUEST_ICON

  return (
    <div
      className={cn(
        'relative pl-14 animate-slide-up',
        mod.status === 'locked' && 'opacity-50',
      )}
      style={{ animationDelay: `${index * 0.04}s`, animationFillMode: 'backwards' }}
    >
      {/* Path node */}
      <div className={cn(
        'absolute left-4 top-5 w-7 h-7 rounded-full flex items-center justify-center z-10 text-sm font-bold transition-all',
        mod.status === 'completed' ? 'bg-bliss-sage-dark text-white shadow-glow-sage' :
        mod.status === 'active' ? 'bg-bliss-terra text-white shadow-glow-terra' :
        'bg-bliss-petal text-bliss-muted border border-bliss-border',
      )}>
        {mod.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : index}
      </div>

      <div
        className={cn(
          'rounded-warm-lg border p-5 transition-all duration-300',
          mod.status === 'completed'
            ? 'border-bliss-sage-light bg-gradient-to-br from-bliss-sage-mist/60 to-white/80'
            : mod.status === 'active'
            ? 'border-bliss-border/60 bg-white/90 backdrop-blur-sm'
            : 'border-bliss-border/40 bg-bliss-linen/50',
          mod.status !== 'locked' && 'cursor-pointer hover:shadow-warm-lg hover:-translate-y-0.5',
        )}
        onClick={mod.status !== 'locked' ? onClick : undefined}
      >
        <div className="flex items-start gap-4">
          <span className="text-2xl mt-0.5">{icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-serif text-lg text-bliss-ink font-medium">
                {index}. {content(mod.i18nKey, mod.title)}
              </h3>
              {mod.isOptional && (
                <span className="text-[10px] px-1.5 py-0.5 bg-bliss-sage-mist rounded-full text-bliss-muted font-medium">
                  {t('quest.task.optional')}
                </span>
              )}
            </div>
            <p className="text-sm text-bliss-ink-light mb-3 leading-relaxed">
              {content(
                mod.i18nKey ? mod.i18nKey.replace(/\.title$/, '.subtitle') : null,
                mod.subtitle ?? '',
              )}
            </p>

            {/* Progress bar */}
            {mod.status !== 'locked' && (
              <div className="mb-2.5">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-bliss-muted font-medium">{t('board.progress.tasks', { completed: mod.progress.completed, total: mod.progress.total })}</span>
                  <span className={cn(
                    'font-bold',
                    mod.status === 'completed' ? 'text-bliss-sage-dark' : 'text-bliss-terra-dark'
                  )}>{mod.progress.percentage}%</span>
                </div>
                <div className="h-2 bg-bliss-sage-mist rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-2 rounded-full transition-all duration-700',
                      mod.status === 'completed'
                        ? 'bg-gradient-to-r from-bliss-sage-dark to-bliss-sage'
                        : 'bg-gradient-to-r from-bliss-terra-dark to-bliss-terra',
                    )}
                    style={{ width: `${mod.progress.percentage}%` }}
                  />
                </div>
              </div>
            )}

            {/* Meta */}
            <div className="flex items-center gap-3 text-xs text-bliss-muted">
              {mod.estimatedDays && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {t('common.time.estimatedDays', { days: mod.estimatedDays })}
                </span>
              )}
              {(mod.userDeadline || mod.suggestedDeadline) && (
                <span>{t('board.pressure.startBy', { date: mod.userDeadline || mod.suggestedDeadline })}</span>
              )}
            </div>
          </div>

          {/* Right action */}
          <div className="shrink-0 mt-1">
            {mod.status === 'locked' ? (
              <button
                onClick={(e) => { e.stopPropagation(); onUnlock() }}
                className="text-xs px-3 py-1.5 rounded-full bg-white border border-bliss-border text-bliss-muted hover:text-bliss-ink hover:border-bliss-sage transition-all"
              >
                <Lock className="w-3 h-3 inline mr-1" />{t('common.action.confirm')}
              </button>
            ) : mod.status === 'completed' ? (
              <span className="text-bliss-sage-dark"><Leaf className="w-5 h-5" /></span>
            ) : (
              <ChevronRight className="w-5 h-5 text-bliss-terra" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
