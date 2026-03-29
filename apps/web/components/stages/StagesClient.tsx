'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { cn, STAGE_COLORS } from '@/lib/utils'
import { CheckCircle, Circle, Lock, ChevronDown, ChevronUp } from 'lucide-react'
import { NavBar } from '../shared/NavBar'

export function StagesClient({ token }: { token: string }) {
  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [stages, setStages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedStage, setExpandedStage] = useState<number | null>(null)
  const [completing, setCompleting] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const wedding = await api.getMyWedding(token)
      setWeddingId(wedding.id)
      const stageData = await api.getStages(wedding.id, token)
      setStages(stageData)
      // Expand current stage
      const current = stageData.find((s: any) => s.isUnlocked && !s.isComplete)
      if (current) setExpandedStage(current.stage)
      setLoading(false)
    }
    load()
  }, [token])

  const handleComplete = async (taskId: string, wId: string) => {
    setCompleting(taskId)
    await api.updateTask(taskId, { status: 'complete' }, token)
    const stageData = await api.getStages(wId, token)
    setStages(stageData)
    setCompleting(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bliss-cream flex items-center justify-center">
        <div className="text-bliss-muted">Loading stages...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bliss-cream pb-24 md:pb-0">
      <NavBar weddingId={weddingId!} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="font-serif text-3xl text-bliss-ink mb-2">Your 7 stages</h1>
        <p className="text-bliss-ink-light mb-8">Each stage unlocks when you complete the key deliverables in the one before it.</p>

        <div className="space-y-3">
          {stages.map((stage) => (
            <div
              key={stage.stage}
              className={cn('warm-card overflow-hidden', !stage.isUnlocked && 'opacity-60')}
            >
              {/* Stage header */}
              <button
                className="w-full flex items-center justify-between p-5 text-left"
                onClick={() => stage.isUnlocked && setExpandedStage(expandedStage === stage.stage ? null : stage.stage)}
                disabled={!stage.isUnlocked}
              >
                <div className="flex items-center gap-3">
                  <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', STAGE_COLORS[stage.stage])}>
                    {stage.stage}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif text-lg text-bliss-ink">{stage.title}</h3>
                      {stage.isComplete && <CheckCircle className="w-4 h-4 text-bliss-sage-dark" />}
                      {!stage.isUnlocked && <Lock className="w-3.5 h-3.5 text-bliss-muted" />}
                    </div>
                    <p className="text-xs text-bliss-muted">{stage.timeframe}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-bliss-muted">
                    {stage.completedTasks}/{stage.totalTasks} done
                  </span>
                  {stage.isUnlocked && (
                    expandedStage === stage.stage
                      ? <ChevronUp className="w-4 h-4 text-bliss-muted" />
                      : <ChevronDown className="w-4 h-4 text-bliss-muted" />
                  )}
                </div>
              </button>

              {/* Progress bar */}
              <div className="h-1 bg-bliss-border mx-5 mb-1 rounded-full overflow-hidden">
                <div
                  className="h-full bg-bliss-rose-dark rounded-full transition-all"
                  style={{ width: stage.totalTasks > 0 ? `${(stage.completedTasks / stage.totalTasks) * 100}%` : '0%' }}
                />
              </div>

              {/* Tasks */}
              {expandedStage === stage.stage && (
                <div className="px-5 pb-5 pt-3 border-t border-bliss-border space-y-2 mt-2">
                  {stage.tasks.map((task: any) => (
                    <div
                      key={task.id}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-warm border',
                        task.isDeliverable ? 'border-bliss-rose/30 bg-bliss-petal/30' : 'border-bliss-border bg-white'
                      )}
                    >
                      <button
                        onClick={() => weddingId && handleComplete(task.id, weddingId)}
                        disabled={completing === task.id || task.status === 'complete'}
                        className="mt-0.5 shrink-0"
                      >
                        {task.status === 'complete' ? (
                          <CheckCircle className="w-5 h-5 text-bliss-sage-dark" />
                        ) : (
                          <Circle className="w-5 h-5 text-bliss-border hover:text-bliss-rose-dark transition-colors" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm font-medium',
                          task.status === 'complete' ? 'line-through text-bliss-muted' : 'text-bliss-ink'
                        )}>
                          {task.title}
                          {task.isDeliverable && (
                            <span className="ml-2 text-xs text-bliss-rose-dark font-normal">key deliverable</span>
                          )}
                        </p>
                        <p className="text-xs text-bliss-muted mt-0.5">{task.dueGuidance}</p>
                        <p className="text-xs text-bliss-ink-light mt-1 leading-relaxed">{task.whyItMatters}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
