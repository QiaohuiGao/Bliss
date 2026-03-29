'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import type { Mood } from '@bliss/types'

const MOODS: { value: Mood; label: string; emoji: string }[] = [
  { value: 'great', label: 'Excited & good', emoji: '😊' },
  { value: 'okay', label: 'Okay, managing', emoji: '🙂' },
  { value: 'overwhelmed', label: 'A bit overwhelmed', emoji: '😓' },
  { value: 'stressed', label: 'Really stressed', emoji: '😰' },
  { value: 'lost', label: 'Lost & unsure', emoji: '😕' },
]

const MOOD_CONTEXT_LABELS: Record<string, string> = {
  everything_going_well: 'Everything is going well',
  excited_about_decision: 'Just made a great decision',
  ahead_of_schedule: "Ahead of schedule",
  partner_aligned: "Partner and I are in sync",
  just_finished_something_big: "Just finished something big",
  managing_but_tired: "Managing but feeling tired",
  some_things_uncertain: "Some things still uncertain",
  partner_not_engaged: "Partner isn't as engaged",
  budget_feeling_tight: "Budget is feeling tight",
  decisions_feeling_big: "Decisions feel too big",
  too_many_decisions: "Too many decisions at once",
  too_many_tasks: "Too many tasks piling up",
  family_pressure: "Family pressure",
  vendor_coordination: "Vendor coordination stress",
  time_running_out: "Time is running out",
  conflict_with_partner: "Conflict with partner",
  financial_strain: "Financial strain",
  something_went_wrong: "Something went wrong",
  overwhelmed_by_options: "Too many options",
  work_life_balance: "Hard to balance with work",
  dont_know_where_to_start: "Don't know where to start",
  conflicting_advice: "Too much conflicting advice",
  changed_my_mind: "Changed my mind about something",
  comparison_anxiety: "Comparing myself to others",
  not_enjoying_planning: "Not enjoying the process",
}

const MOOD_CONTEXTS: Record<Mood, string[]> = {
  great: ['everything_going_well', 'excited_about_decision', 'ahead_of_schedule', 'partner_aligned', 'just_finished_something_big'],
  okay: ['managing_but_tired', 'some_things_uncertain', 'partner_not_engaged', 'budget_feeling_tight', 'decisions_feeling_big'],
  overwhelmed: ['too_many_decisions', 'too_many_tasks', 'family_pressure', 'vendor_coordination', 'time_running_out'],
  stressed: ['conflict_with_partner', 'financial_strain', 'something_went_wrong', 'overwhelmed_by_options', 'work_life_balance'],
  lost: ['dont_know_where_to_start', 'conflicting_advice', 'changed_my_mind', 'comparison_anxiety', 'not_enjoying_planning'],
}

type Step = 'mood' | 'context' | 'response'

export function StressCheckInModal({
  weddingId,
  token,
  onClose,
}: {
  weddingId: string
  token: string
  onClose: () => void
}) {
  const [step, setStep] = useState<Step>('mood')
  const [mood, setMood] = useState<Mood | null>(null)
  const [context, setContext] = useState<string | null>(null)
  const [response, setResponse] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)

  const handleMoodSelect = (m: Mood) => {
    setMood(m)
    setStep('context')
  }

  const handleContextSelect = async (ctx: string) => {
    setContext(ctx)
    setLoading(true)
    try {
      const [res] = await Promise.all([
        api.getStressResponse(mood!, ctx),
        api.saveCheckIn(weddingId, mood!, ctx, token),
      ])
      setResponse(res)
      setStep('response')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-bliss-ink/40 backdrop-blur-sm p-4">
      <div className="warm-card-lg w-full max-w-lg shadow-warm-lg animate-in slide-in-from-bottom-4 md:zoom-in-95">
        <div className="flex items-center justify-between p-5 border-b border-bliss-border">
          <h3 className="font-serif text-lg text-bliss-ink">How are you doing?</h3>
          <button onClick={onClose} className="text-bliss-muted hover:text-bliss-ink">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {step === 'mood' && (
            <div>
              <p className="text-bliss-ink-light text-sm mb-4">
                Pick the one that feels most true right now.
              </p>
              <div className="space-y-2">
                {MOODS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => handleMoodSelect(m.value)}
                    className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-warm border border-bliss-border hover:border-bliss-rose hover:bg-bliss-petal transition-all"
                  >
                    <span className="text-xl">{m.emoji}</span>
                    <span className="font-medium text-bliss-ink text-sm">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'context' && mood && (
            <div>
              <p className="text-bliss-ink-light text-sm mb-4">
                What's taking up the most headspace?
              </p>
              <div className="space-y-2">
                {MOOD_CONTEXTS[mood].map((ctx) => (
                  <button
                    key={ctx}
                    onClick={() => handleContextSelect(ctx)}
                    disabled={loading}
                    className="w-full text-left px-4 py-3 rounded-warm border border-bliss-border hover:border-bliss-rose hover:bg-bliss-petal transition-all text-sm text-bliss-ink disabled:opacity-50"
                  >
                    {MOOD_CONTEXT_LABELS[ctx] ?? ctx}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'response' && response && (
            <div className="space-y-4">
              <p className="text-bliss-ink leading-relaxed">{response.validation}</p>
              <div className="bg-bliss-petal rounded-warm p-4">
                <p className="text-sm font-medium text-bliss-ink-light mb-1">One honest tip</p>
                <p className="text-sm text-bliss-ink leading-relaxed">{response.honestTip}</p>
              </div>
              {response.actionTiles?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-bliss-muted uppercase tracking-wide mb-2">Things to try</p>
                  <div className="grid grid-cols-2 gap-2">
                    {response.actionTiles.map((tile: string) => (
                      <div
                        key={tile}
                        className="bg-white border border-bliss-border rounded-warm px-3 py-2 text-sm text-bliss-ink-light text-center"
                      >
                        {tile}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={onClose} className="btn-primary w-full mt-2">
                Back to planning
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
