'use client'

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { useToken } from '@/lib/useToken'
import { useContent } from '@/lib/content'
import { api } from '@/lib/api'
import { cn, formatCents } from '@/lib/utils'
import type { DashboardResponse, Module } from '@bliss/types'
import {
  Calendar, Map, Wallet, ChevronRight, Leaf, TreePine,
  Clock, Sun, Moon, Sunrise, Sunset,
} from 'lucide-react'

const QUEST_ICONS: Record<string, string> = {
  foundation: '🌱', venue_date: '🏕️', vendor_team: '🌿',
  wedding_party: '💐', attire_beauty: '👗', guests_stationery: '✉️',
  guest_experience: '🧳', food_beverage: '🍷', design_flowers: '🌻',
  ceremony: '🌹', registry_rings_honeymoon: '💍', legal: '📜',
  pre_wedding_events: '🥂', final_30_and_day_of: '🎊',
}
const DEFAULT_QUEST_ICON = '🌿'

export default function DashboardPage() {
  const t = useTranslations()
  const locale = useLocale()
  const content = useContent()
  const router = useRouter()
  const getToken = useToken()
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      try {
        const wedding = await api.getMyWedding(token)
        const dashboard = await api.getDashboard(wedding.id, token)
        setData(dashboard)
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

  const { wedding, todayTasks, activeModules, budget } = data

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 6) return { icon: Moon }
    if (h < 12) return { icon: Sunrise }
    if (h < 18) return { icon: Sun }
    return { icon: Sunset }
  })()

  const GreetingIcon = greeting.icon

  return (
    <div className="min-h-screen bg-gradient-garden relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-bliss-sage-mist/30 rounded-full -translate-y-1/4 translate-x-1/4 blur-3xl" />
      <div className="absolute bottom-20 left-0 w-64 h-64 bg-bliss-terra-mist/20 rounded-full -translate-x-1/3 blur-3xl" />

      {/* Hero Header */}
      <header className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-bliss-sage-mist/30 to-transparent" />
        <div className="relative max-w-2xl mx-auto px-4 pt-8 pb-6">
          <div className="flex items-center justify-between mb-8">
            <div className="font-serif text-2xl font-light text-bliss-ink flex items-center gap-2 tracking-wider">
              <TreePine className="w-5 h-5 text-bliss-sage-dark" /> Bliss
            </div>
            <button onClick={() => router.push('/board')} className="btn-ghost text-sm flex items-center gap-1.5">
              <Map className="w-4 h-4" /> {t('common.nav.board')}
            </button>
          </div>

          <div className="flex items-center gap-3 mb-1">
            <GreetingIcon className="w-6 h-6 text-bliss-terra" />
            <h1 className="font-serif text-2xl md:text-3xl text-bliss-ink font-medium">
              {t('board.title')}
            </h1>
          </div>
          <p className="text-bliss-ink-light text-sm ml-9">{t('board.subtitle')}</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-24 relative z-10">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mb-6 animate-slide-up">
          {/* Progress */}
          <div className="card p-4 text-center">
            <div className="w-16 h-16 mx-auto mb-2 relative">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#E8F0E8" strokeWidth="7" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="url(#dashSage)" strokeWidth="7"
                  strokeDasharray={`${wedding.totalProgress * 2.64} 264`}
                  strokeLinecap="round" className="transition-all duration-1000" />
                <defs>
                  <linearGradient id="dashSage" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4D7A52" />
                    <stop offset="100%" stopColor="#7A9E7E" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-bliss-ink">
                {wedding.totalProgress}%
              </span>
            </div>
            <div className="text-xs text-bliss-muted font-medium">{t('board.progress.overall', { percent: wedding.totalProgress })}</div>
          </div>

          {/* Countdown */}
          <div className="card p-4 text-center flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-bliss-sky-light flex items-center justify-center mb-2">
              <Calendar className="w-5 h-5 text-bliss-sky" />
            </div>
            <div className="text-2xl font-bold text-bliss-ink">
              {wedding.daysRemaining ?? '—'}
            </div>
            <div className="text-xs text-bliss-muted">
              {wedding.daysRemaining !== null ? t('board.countdown', { days: wedding.daysRemaining }) : t('board.noDate')}
            </div>
          </div>

          {/* Budget */}
          <div className="card p-4 text-center flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-bliss-terra-mist flex items-center justify-center mb-2">
              <Wallet className="w-5 h-5 text-bliss-terra" />
            </div>
            <div className="text-lg font-bold text-bliss-ink">
              {formatCents(budget.spentCents)}
            </div>
            <div className="text-xs text-bliss-muted">
              {budget.totalBudgetCents > 0
                ? t('board.dashboard.budgetCard.spent', { spent: formatCents(budget.spentCents, locale), total: formatCents(budget.totalBudgetCents, locale) })
                : t('board.dashboard.budgetCard.title')}
            </div>
          </div>
        </div>

        {/* Today's Tasks */}
        <section className="mb-6 animate-slide-up" style={{ animationDelay: '0.06s', animationFillMode: 'backwards' }}>
          <h2 className="font-serif text-lg text-bliss-ink mb-3 flex items-center gap-2 font-medium">
            <Leaf className="w-4 h-4 text-bliss-sage-dark" />
            {t('board.dashboard.nextUp')}
          </h2>
          {todayTasks.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-3xl mb-3">🌿</div>
              <p className="text-bliss-muted text-sm">{t('board.dashboard.nextUpEmpty')}</p>
              <button onClick={() => router.push('/board')} className="text-sm text-bliss-sage-dark font-medium mt-2 hover:underline">
                {t('common.action.seeAll')}
              </button>
            </div>
          ) : (
            <div className="card overflow-hidden">
              {todayTasks.map((task, i) => (
                <div
                  key={task.id}
                  className={cn(
                    'flex items-center gap-3 px-5 py-3.5 hover:bg-bliss-sage-mist/20 transition-colors',
                    i < todayTasks.length - 1 && 'border-b border-bliss-border/30',
                  )}
                >
                  <div className="w-5 h-5 rounded-md border-2 border-bliss-border shrink-0" />
                  <span className="text-sm text-bliss-ink flex-1">{task.title}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Active Quests */}
        <section className="animate-slide-up" style={{ animationDelay: '0.12s', animationFillMode: 'backwards' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-lg text-bliss-ink flex items-center gap-2 font-medium">
              <TreePine className="w-4 h-4 text-bliss-sage-dark" />
              {t('board.status.active')}
            </h2>
            <button onClick={() => router.push('/board')} className="text-xs text-bliss-sage-dark font-medium hover:underline">
              {t('common.action.seeAll')}
            </button>
          </div>
          {activeModules.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-3xl mb-3">🌱</div>
              <p className="text-bliss-muted text-sm">{t('common.state.empty')}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeModules.map((mod) => {
                const icon = QUEST_ICONS[mod.templateKey ?? ''] ?? DEFAULT_QUEST_ICON
                return (
                  <button
                    key={mod.id}
                    onClick={() => router.push(`/quest/${mod.id}`)}
                    className="card-interactive w-full p-4 flex items-center gap-4 text-left"
                  >
                    <div className="w-11 h-11 rounded-warm bg-bliss-sage-mist flex items-center justify-center shrink-0 text-xl">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-bliss-ink truncate">{mod.title}</h3>
                      <p className="text-xs text-bliss-muted truncate">{mod.subtitle}</p>
                      {mod.estimatedDays && (
                        <span className="text-[10px] text-bliss-muted mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {t('quest.detail.estimatedTime', { days: mod.estimatedDays ?? 0 })}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-bliss-sage shrink-0" />
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
