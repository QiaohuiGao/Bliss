'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { useToken } from '@/lib/useToken'
import { useContent } from '@/lib/content'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { ModuleDetailResponse, TaskWithMeta } from '@bliss/types'
import {
  ArrowLeft, Check, ChevronDown, ChevronUp, Camera,
  Star, Clock, Leaf, X, TreePine,
} from 'lucide-react'

export default function QuestPage({ params }: { params: { moduleId: string } }) {
  const { moduleId } = params
  const router = useRouter()
  const t = useTranslations()
  const content = useContent()
  const getToken = useToken()
  const [data, setData] = useState<ModuleDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCelebration, setShowCelebration] = useState(false)
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set())
  const [animatingTasks, setAnimatingTasks] = useState<Set<string>>(new Set())

  const loadData = async () => {
    const token = await getToken()
    const detail = await api.getModuleDetail(moduleId, token)
    setData(detail)
    setLoading(false)
    setExpandedSubs(new Set(detail.subModules.map(s => s.id)))
    if (detail.celebration && !detail.celebration.shownAt) {
      setShowCelebration(true)
    }
  }

  useEffect(() => { loadData() }, [moduleId])

  const toggleTask = async (task: TaskWithMeta) => {
    const token = await getToken()
    const newStatus = task.status === 'done' ? 'todo' : 'done'

    if (newStatus === 'done') {
      setAnimatingTasks(prev => new Set(prev).add(task.id))
      setTimeout(() => setAnimatingTasks(prev => {
        const next = new Set(prev); next.delete(task.id); return next
      }), 500)
    }

    await api.updateTask(task.id, { status: newStatus }, token)
    await loadData()
  }

  const dismissCelebration = async () => {
    if (!data?.celebration) return
    const token = await getToken()
    await api.dismissCelebration(data.celebration.id, token)
    setShowCelebration(false)
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-gradient-garden flex items-center justify-center">
        <Leaf className="w-10 h-10 text-bliss-sage animate-sway" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-garden relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-bliss-sage-mist/30 rounded-full -translate-y-1/3 translate-x-1/3 blur-3xl" />
      <div className="absolute bottom-20 left-0 w-48 h-48 bg-bliss-terra-mist/20 rounded-full -translate-x-1/3 blur-3xl" />

      {/* Celebration Overlay */}
      {showCelebration && data.celebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={dismissCelebration} />
          {/* Leaf confetti */}
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${50 + Math.random() * 30}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${1.2 + Math.random() * 1}s`,
              }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: ['#7A9E7E', '#4D7A52', '#C4856C', '#C9A96E', '#B8D4BA'][i % 5] }}
              />
            </div>
          ))}
          <div className="relative bg-white/95 backdrop-blur-xl rounded-warm-xl p-10 max-w-md w-full text-center shadow-warm-xl animate-scale-in border border-bliss-sage-light/30">
            <button onClick={dismissCelebration} className="absolute top-4 right-4 text-bliss-muted hover:text-bliss-ink">
              <X className="w-5 h-5" />
            </button>
            <div className="text-6xl mb-5 animate-float">🌸</div>
            <h2 className="font-serif text-3xl text-bliss-ink mb-3 font-medium">{t('quest.celebration.title', { quest: content(data.i18nKey, data.title) })}</h2>
            <p className="text-bliss-ink-light text-base mb-6 leading-relaxed">{content(data.celebration?.encouragementKey ?? null, '')}</p>
            <div className="flex justify-center gap-8 mb-8">
              {data.celebration.daysTaken !== null && (
                <div className="text-center">
                  <div className="text-3xl font-bold text-bliss-sage-dark">{data.celebration.daysTaken}</div>
                  <div className="text-xs text-bliss-muted mt-1">{t('common.time.estimatedDays', { days: data.celebration?.daysTaken ?? 0 })}</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-3xl font-bold text-bliss-sage-dark">{data.celebration.tasksCompleted}</div>
                <div className="text-xs text-bliss-muted mt-1">{t('quest.detail.taskCount', { count: data.celebration?.tasksCompleted ?? 0 })}</div>
              </div>
            </div>
            <button onClick={dismissCelebration} className="btn-primary w-full">
              {t('quest.celebration.close')} <Leaf className="w-4 h-4 inline ml-1" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-bliss-sage-mist/40 to-transparent" />
        <div className="relative max-w-2xl mx-auto px-4 pt-6 pb-8">
          <button onClick={() => router.push('/board')} className="flex items-center gap-1.5 text-sm text-bliss-muted hover:text-bliss-ink transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" /> {t('common.nav.board')}
          </button>
          <h1 className="font-serif text-2xl md:text-3xl text-bliss-ink mb-1 font-medium">{data.title}</h1>
          <p className="text-bliss-ink-light text-sm mb-4">{data.subtitle}</p>

          {/* Progress */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-3 bg-bliss-sage-mist rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-3 rounded-full transition-all duration-700',
                    data.status === 'completed'
                      ? 'bg-gradient-to-r from-bliss-sage-dark to-bliss-sage'
                      : 'bg-gradient-to-r from-bliss-terra-dark to-bliss-terra',
                  )}
                  style={{ width: `${data.progress.percentage}%` }}
                />
              </div>
            </div>
            <span className={cn(
              'text-lg font-bold',
              data.status === 'completed' ? 'text-bliss-sage-dark' : 'text-bliss-terra-dark'
            )}>
              {data.progress.completed}/{data.progress.total}
            </span>
          </div>

          <div className="flex items-center gap-4 mt-3 text-xs text-bliss-muted">
            {data.estimatedDays && (
              <span className="flex items-center gap-1 bg-white/60 px-2.5 py-1 rounded-full">
                <Clock className="w-3 h-3" /> {t('quest.detail.estimatedTime', { days: data.estimatedDays ?? 0 })}
              </span>
            )}
            {(data.userDeadline || data.suggestedDeadline) && (
              <span className="bg-white/60 px-2.5 py-1 rounded-full">
                {t('quest.detail.targetDate', { date: data.userDeadline || data.suggestedDeadline })}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Sub-modules & Tasks */}
      <main className="max-w-2xl mx-auto px-4 py-4 pb-24 relative z-10">
        {(data.templateKey === 'foundation' || data.templateKey === 'venue_date' || data.templateKey === 'wedding_party' || data.templateKey === 'guests_stationery' || data.templateKey === 'guest_experience' || data.templateKey === 'food_beverage' || data.templateKey === 'design_flowers' || data.templateKey === 'ceremony' || data.templateKey === 'registry_rings_honeymoon' || data.templateKey === 'legal' || data.templateKey === 'pre_wedding_events' || data.templateKey === 'final_30_and_day_of') && (
          <button
            onClick={() => router.push(`/assistant/quest/${data.templateKey}`)}
            className="card w-full p-5 mb-5 text-left flex items-start gap-4 hover:-translate-y-0.5 hover:shadow-warm-lg transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-bliss-terra-mist flex items-center justify-center shrink-0">
              <Leaf className="w-5 h-5 text-bliss-terra-dark" />
            </div>
            <div>
              <p className="font-serif text-lg text-bliss-ink">{t('assistant.questScoping.openAction')}</p>
              <p className="text-sm text-bliss-muted mt-1 leading-relaxed">{t('assistant.questScoping.openBody')}</p>
            </div>
          </button>
        )}
        <div className="space-y-4">
          {data.subModules.map((sub) => {
            const isExpanded = expandedSubs.has(sub.id)
            const subCompleted = sub.tasks.filter(t => t.status === 'done').length
            const subTotal = sub.tasks.length
            const allDone = subCompleted === subTotal && subTotal > 0

            return (
              <div key={sub.id} className={cn(
                'rounded-warm-lg border overflow-hidden transition-all duration-300',
                allDone ? 'border-bliss-sage-light bg-bliss-sage-mist/30' : 'border-bliss-border/50 bg-white/90 backdrop-blur-sm',
              )}>
                <button
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-black/[0.02] transition-colors"
                  onClick={() => {
                    setExpandedSubs(prev => {
                      const next = new Set(prev)
                      if (next.has(sub.id)) next.delete(sub.id); else next.add(sub.id)
                      return next
                    })
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold',
                      allDone ? 'bg-bliss-sage-light text-bliss-sage-dark' : 'bg-bliss-linen text-bliss-terra-dark'
                    )}>
                      {allDone ? <Check className="w-4 h-4" /> : sub.sortOrder}
                    </div>
                    <div className="text-left">
                      <h3 className={cn('font-semibold text-sm', allDone ? 'text-bliss-sage-dark' : 'text-bliss-ink')}>
                        {sub.title}
                      </h3>
                      <p className="text-xs text-bliss-muted">{t('board.progress.tasks', { completed: subCompleted, total: subTotal })}</p>
                    </div>
                    {sub.isOptional && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-bliss-sage-mist rounded-full text-bliss-muted">{t('quest.task.optional')}</span>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-bliss-muted" /> : <ChevronDown className="w-4 h-4 text-bliss-muted" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-bliss-border/30 animate-slide-down">
                    {sub.tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        isAnimating={animatingTasks.has(task.id)}
                        onToggle={() => toggleTask(task)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}

function TaskRow({ task, isAnimating, onToggle }: { task: TaskWithMeta; isAnimating: boolean; onToggle: () => void }) {
  const t = useTranslations()
  const content = useContent()
  const isDone = task.status === 'done'

  return (
    <div className={cn(
      'flex items-start gap-3 px-5 py-3.5 border-b border-bliss-border/20 last:border-0 transition-all duration-200',
      isDone ? 'bg-bliss-sage-mist/20' : 'hover:bg-bliss-linen/30',
    )}>
      <button
        onClick={onToggle}
        className={cn(
          'mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-200',
          isDone
            ? 'bg-bliss-sage-dark border-bliss-sage-dark text-white'
            : 'border-bliss-border hover:border-bliss-sage-dark',
          isAnimating && 'animate-checkmark',
        )}
      >
        {isDone && <Check className="w-3 h-3" />}
      </button>

      <div className="flex-1 min-w-0">
        <span className={cn(
          'text-sm leading-relaxed transition-all duration-200',
          isDone ? 'text-bliss-muted line-through' : 'text-bliss-ink',
        )}>
          {task.title}
        </span>
        {task.description && (
          <p className="text-xs text-bliss-muted mt-1 leading-relaxed">{task.description}</p>
        )}
        {(task.rating || task.photoCount > 0 || task.isOptional) && (
          <div className="flex items-center gap-3 mt-1.5">
            {task.rating && (
              <span className="flex items-center gap-0.5 text-xs text-bliss-gold">
                <Star className="w-3 h-3 fill-bliss-gold" /> {task.rating}
              </span>
            )}
            {task.photoCount > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-bliss-muted">
                <Camera className="w-3 h-3" /> {task.photoCount}
              </span>
            )}
            {task.isOptional && (
              <span className="text-[10px] px-1.5 py-0.5 bg-bliss-sage-mist rounded-full text-bliss-muted">{t('quest.task.optional')}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
