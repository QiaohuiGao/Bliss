'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { daysUntilText, formatCents, STAGE_COLORS } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { DashboardData } from '@bliss/types'
import { CheckCircle, Circle, Heart, Calendar, DollarSign, Users, ChevronRight, X } from 'lucide-react'
import Link from 'next/link'
import { StressCheckInModal } from '../shared/StressCheckInModal'
import { CelebrationModal } from '../shared/CelebrationModal'
import { NavBar } from '../shared/NavBar'

export function DashboardClient({ token }: { token: string }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showStressModal, setShowStressModal] = useState(false)
  const [celebrationDismissed, setCelebrationDismissed] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const wedding = await api.getMyWedding(token)
        setWeddingId(wedding.id)
        const dashboard = await api.getDashboard(wedding.id, token)
        setData(dashboard)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  const handleTaskComplete = async (taskId: string) => {
    if (!weddingId) return
    await api.updateTask(taskId, { status: 'complete' }, token)
    const dashboard = await api.getDashboard(weddingId, token)
    setData(dashboard)
  }

  const handleDismissCelebration = async () => {
    if (!data?.pendingCelebration) return
    await api.dismissCelebration(data.pendingCelebration.id, token)
    setCelebrationDismissed(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bliss-cream flex items-center justify-center">
        <div className="text-bliss-muted">Loading your plan...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-bliss-cream flex items-center justify-center">
        <div className="text-center">
          <p className="text-bliss-ink-light mb-4">Something went wrong loading your plan.</p>
          <button onClick={() => window.location.reload()} className="btn-secondary">Try again</button>
        </div>
      </div>
    )
  }

  const { wedding, partnerA, partnerB, nextTasks, stageProgress, daysUntilWedding, budgetSnapshot, pendingCelebration, stressCheckInDue } = data
  const partnerAName = partnerA.displayName ?? 'Partner A'
  const partnerBName = partnerB?.displayName ?? null

  const currentStageInfo = stageProgress.find((s) => s.stage === wedding.currentStage)

  return (
    <div className="min-h-screen bg-bliss-cream">
      <NavBar weddingId={wedding.id} />

      {/* Celebration modal */}
      {pendingCelebration && !celebrationDismissed && (
        <CelebrationModal
          celebration={pendingCelebration}
          onDismiss={handleDismissCelebration}
        />
      )}

      {/* Stress modal */}
      {showStressModal && (
        <StressCheckInModal
          weddingId={wedding.id}
          token={token}
          onClose={() => setShowStressModal(false)}
        />
      )}

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl text-bliss-ink mb-1">
            {partnerAName}{partnerBName ? ` & ${partnerBName}` : ''}
          </h1>
          <p className="text-bliss-ink-light">Your wedding plan is looking good.</p>
        </div>

        {/* Key stats row */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
          {/* Countdown */}
          <div className="warm-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-warm bg-bliss-petal flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-bliss-rose-dark" />
            </div>
            <div>
              <div className="text-xs text-bliss-muted">Wedding day</div>
              <div className="font-semibold text-bliss-ink text-sm">
                {daysUntilText(daysUntilWedding)}
              </div>
            </div>
          </div>

          {/* Stage */}
          <div className="warm-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-warm bg-bliss-petal flex items-center justify-center shrink-0">
              <Heart className="w-4 h-4 text-bliss-rose-dark" />
            </div>
            <div>
              <div className="text-xs text-bliss-muted">Current stage</div>
              <div className="font-semibold text-bliss-ink text-sm">
                {currentStageInfo?.title ?? `Stage ${wedding.currentStage}`}
              </div>
            </div>
          </div>

          {/* Budget */}
          {budgetSnapshot && (
            <div className="warm-card p-4 flex items-center gap-3 col-span-2 md:col-span-1">
              <div className="w-9 h-9 rounded-warm bg-bliss-petal flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4 text-bliss-rose-dark" />
              </div>
              <div>
                <div className="text-xs text-bliss-muted">Spent so far</div>
                <div className="font-semibold text-bliss-ink text-sm">
                  {formatCents(budgetSnapshot.totalActualCents)} of {formatCents(budgetSnapshot.totalEstimatedCents)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stress check-in prompt */}
        {stressCheckInDue && (
          <div className="warm-card p-4 mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-bliss-ink">How are you feeling about everything?</p>
              <p className="text-xs text-bliss-muted mt-0.5">A quick check-in. Takes 30 seconds.</p>
            </div>
            <button
              onClick={() => setShowStressModal(true)}
              className="btn-secondary text-sm py-2 px-4 shrink-0 ml-4"
            >
              Check in
            </button>
          </div>
        )}

        {/* Stage progress */}
        <div className="warm-card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl text-bliss-ink">Your journey</h2>
            <Link href="/stages" className="text-sm text-bliss-rose-dark hover:underline flex items-center gap-1">
              All stages <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {stageProgress.map((stage) => {
              const pct = stage.totalDeliverables > 0
                ? (stage.completedDeliverables / stage.totalDeliverables) * 100
                : 0
              return (
                <div key={stage.stage} className={cn('rounded-warm p-3 border', !stage.isUnlocked && 'opacity-40')}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', STAGE_COLORS[stage.stage])}>
                        {stage.stage}
                      </span>
                      <span className="text-sm font-medium text-bliss-ink">{stage.title}</span>
                      {stage.isComplete && <CheckCircle className="w-4 h-4 text-bliss-sage-dark" />}
                    </div>
                    <span className="text-xs text-bliss-muted">
                      {stage.completedDeliverables}/{stage.totalDeliverables}
                    </span>
                  </div>
                  <div className="h-1.5 bg-bliss-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-bliss-rose-dark rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Next tasks */}
        <div className="warm-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl text-bliss-ink">What's next</h2>
            <Link
              href={`/stages/${wedding.currentStage}`}
              className="text-sm text-bliss-rose-dark hover:underline flex items-center gap-1"
            >
              See all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {nextTasks.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-10 h-10 text-bliss-sage mx-auto mb-3" />
              <p className="font-medium text-bliss-ink mb-1">You're all caught up!</p>
              <p className="text-sm text-bliss-ink-light">Stage {wedding.currentStage} is complete. Moving to the next stage.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {nextTasks.map((task) => (
                <TaskRow key={task.id} task={task} onComplete={handleTaskComplete} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function TaskRow({ task, onComplete }: { task: any; onComplete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [completing, setCompleting] = useState(false)

  const handleComplete = async () => {
    setCompleting(true)
    await onComplete(task.id)
  }

  return (
    <div className="border border-bliss-border rounded-warm overflow-hidden">
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-bliss-cream/50 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <button
          onClick={(e) => { e.stopPropagation(); handleComplete() }}
          disabled={completing || task.status === 'complete'}
          className="mt-0.5 shrink-0"
        >
          {task.status === 'complete' || completing ? (
            <CheckCircle className="w-5 h-5 text-bliss-sage-dark" />
          ) : (
            <Circle className="w-5 h-5 text-bliss-border hover:text-bliss-rose-dark transition-colors" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className={cn('font-medium text-bliss-ink text-sm', task.status === 'complete' && 'line-through text-bliss-muted')}>
            {task.title}
          </p>
          <p className="text-xs text-bliss-muted mt-0.5">{task.dueGuidance}</p>
        </div>
        <ChevronRight className={cn('w-4 h-4 text-bliss-muted shrink-0 transition-transform', expanded && 'rotate-90')} />
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-bliss-border bg-bliss-cream/30">
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <p className="font-medium text-bliss-ink-light text-xs uppercase tracking-wide mb-1">Why it matters</p>
              <p className="text-bliss-ink-light leading-relaxed">{task.whyItMatters}</p>
            </div>
            <div>
              <p className="font-medium text-bliss-ink-light text-xs uppercase tracking-wide mb-1">How to do it</p>
              <p className="text-bliss-ink-light leading-relaxed">{task.howToDoIt}</p>
            </div>
            <div>
              <p className="font-medium text-bliss-ink-light text-xs uppercase tracking-wide mb-1">Done when</p>
              <p className="text-bliss-ink-light leading-relaxed">{task.doneDefinition}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
