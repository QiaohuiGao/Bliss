'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { api } from '@/lib/api'
import { VIBE_OPTIONS, PRIORITY_OPTIONS } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { GuestCountMode, PlanningStyle, TimelineMode, OnboardingPayload } from '@bliss/types'
import { ChevronRight, ChevronLeft } from 'lucide-react'

const TOTAL_STEPS = 5

interface OnboardingState {
  vibeTags: string[]
  priorityTags: string[]
  guestCountMode: GuestCountMode | null
  planningStyle: PlanningStyle | null
  timelineMode: TimelineMode | null
  locationMode: 'urban' | 'suburban' | 'rural'
  partnerAName: string
  partnerBName: string
}

const GUEST_COUNT_OPTIONS: { value: GuestCountMode; label: string; sub: string }[] = [
  { value: 'micro', label: 'Just us + a few people', sub: 'Under 15 guests' },
  { value: 'intimate', label: 'A close circle', sub: '15–50 guests' },
  { value: 'classic', label: 'Family and friends', sub: '50–120 guests' },
  { value: 'grand', label: 'Everyone we love', sub: '120+ guests' },
]

const PLANNING_STYLE_OPTIONS: { value: PlanningStyle; label: string; sub: string }[] = [
  { value: 'full_diy', label: 'Mostly us', sub: "We want to make and do as much as possible" },
  { value: 'mixed', label: 'A mix', sub: "Some things ourselves, some things handled for us" },
  { value: 'vendor_led', label: 'Mostly vendors', sub: "We want the right people handling things" },
  { value: 'full_service', label: 'Hands off', sub: "We want someone else to run the show" },
]

const TIMELINE_OPTIONS: { value: TimelineMode; label: string; sub: string }[] = [
  { value: 'fast', label: 'Less than 6 months', sub: "We need to move quickly" },
  { value: 'medium', label: '6–12 months', sub: "A solid amount of time" },
  { value: 'comfortable', label: '12–18 months', sub: "Plenty of runway" },
  { value: 'relaxed', label: '18+ months', sub: "We have lots of time" },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { getToken } = useAuth()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [state, setState] = useState<OnboardingState>({
    vibeTags: [],
    priorityTags: [],
    guestCountMode: null,
    planningStyle: null,
    timelineMode: null,
    locationMode: 'suburban',
    partnerAName: '',
    partnerBName: '',
  })

  const toggleTag = (key: 'vibeTags' | 'priorityTags', value: string) => {
    setState((s) => ({
      ...s,
      [key]: s[key].includes(value) ? s[key].filter((v) => v !== value) : [...s[key], value],
    }))
  }

  const canContinue = () => {
    if (step === 1) return state.vibeTags.length >= 1
    if (step === 2) return state.priorityTags.length >= 1
    if (step === 3) return state.guestCountMode !== null
    if (step === 4) return state.planningStyle !== null
    if (step === 5) return state.timelineMode !== null
    return false
  }

  const handleFinish = async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const payload: OnboardingPayload = {
        vibeTags: state.vibeTags,
        priorityTags: state.priorityTags,
        guestCountMode: state.guestCountMode!,
        planningStyle: state.planningStyle!,
        timelineMode: state.timelineMode!,
        locationMode: state.locationMode,
        partnerName: state.partnerBName || undefined,
      }
      await api.createWedding(payload, token!)
      router.push('/dashboard')
    } catch (e) {
      console.error(e)
      setLoading(false)
    }
  }

  const progressPct = ((step - 1) / TOTAL_STEPS) * 100

  return (
    <div className="min-h-screen bg-bliss-cream flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-bliss-border">
        <div
          className="h-1 bg-bliss-rose-dark transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          {/* Step 1 — Ceremony vibe */}
          {step === 1 && (
            <div>
              <p className="text-bliss-muted text-sm mb-2">Step 1 of 5</p>
              <h2 className="font-serif text-3xl text-bliss-ink mb-2">
                What kind of wedding feels right to you?
              </h2>
              <p className="text-bliss-ink-light mb-8">
                There's no wrong answer here. Pick everything that resonates.
              </p>
              <div className="flex flex-wrap gap-3">
                {VIBE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => toggleTag('vibeTags', opt.value)}
                    className={cn('chip', state.vibeTags.includes(opt.value) ? 'chip-selected' : 'chip-unselected')}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Priorities */}
          {step === 2 && (
            <div>
              <p className="text-bliss-muted text-sm mb-2">Step 2 of 5</p>
              <h2 className="font-serif text-3xl text-bliss-ink mb-2">
                What matters most to you?
              </h2>
              <p className="text-bliss-ink-light mb-8">
                Pick your top 3–4 priorities. These shape how we guide you.
              </p>
              <div className="flex flex-wrap gap-3">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => toggleTag('priorityTags', opt.value)}
                    className={cn('chip', state.priorityTags.includes(opt.value) ? 'chip-selected' : 'chip-unselected')}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 — Guest count */}
          {step === 3 && (
            <div>
              <p className="text-bliss-muted text-sm mb-2">Step 3 of 5</p>
              <h2 className="font-serif text-3xl text-bliss-ink mb-2">
                Roughly how many people do you picture there?
              </h2>
              <p className="text-bliss-ink-light mb-8">
                An estimate is fine — you can adjust this later.
              </p>
              <div className="space-y-3">
                {GUEST_COUNT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setState((s) => ({ ...s, guestCountMode: opt.value }))}
                    className={cn(
                      'w-full text-left px-5 py-4 rounded-warm border-2 transition-all',
                      state.guestCountMode === opt.value
                        ? 'border-bliss-rose-dark bg-bliss-petal'
                        : 'border-bliss-border bg-white hover:border-bliss-rose'
                    )}
                  >
                    <div className="font-medium text-bliss-ink">{opt.label}</div>
                    <div className="text-sm text-bliss-muted">{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4 — Planning style */}
          {step === 4 && (
            <div>
              <p className="text-bliss-muted text-sm mb-2">Step 4 of 5</p>
              <h2 className="font-serif text-3xl text-bliss-ink mb-2">
                How hands-on do you want to be?
              </h2>
              <p className="text-bliss-ink-light mb-8">
                This shapes the guidance you get for every task.
              </p>
              <div className="space-y-3">
                {PLANNING_STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setState((s) => ({ ...s, planningStyle: opt.value }))}
                    className={cn(
                      'w-full text-left px-5 py-4 rounded-warm border-2 transition-all',
                      state.planningStyle === opt.value
                        ? 'border-bliss-rose-dark bg-bliss-petal'
                        : 'border-bliss-border bg-white hover:border-bliss-rose'
                    )}
                  >
                    <div className="font-medium text-bliss-ink">{opt.label}</div>
                    <div className="text-sm text-bliss-muted">{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 5 — Timeline */}
          {step === 5 && (
            <div>
              <p className="text-bliss-muted text-sm mb-2">Step 5 of 5</p>
              <h2 className="font-serif text-3xl text-bliss-ink mb-2">
                How long do you have to plan?
              </h2>
              <p className="text-bliss-ink-light mb-8">
                This helps us pace your stages realistically.
              </p>
              <div className="space-y-3">
                {TIMELINE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setState((s) => ({ ...s, timelineMode: opt.value }))}
                    className={cn(
                      'w-full text-left px-5 py-4 rounded-warm border-2 transition-all',
                      state.timelineMode === opt.value
                        ? 'border-bliss-rose-dark bg-bliss-petal'
                        : 'border-bliss-border bg-white hover:border-bliss-rose'
                    )}
                  >
                    <div className="font-medium text-bliss-ink">{opt.label}</div>
                    <div className="text-sm text-bliss-muted">{opt.sub}</div>
                  </button>
                ))}
              </div>

              {/* Optional name fields */}
              <div className="mt-6 space-y-3">
                <p className="text-sm text-bliss-ink-light font-medium">
                  What should we call you? (optional)
                </p>
                <input
                  className="input-warm"
                  placeholder="Your name"
                  value={state.partnerAName}
                  onChange={(e) => setState((s) => ({ ...s, partnerAName: e.target.value }))}
                />
                <input
                  className="input-warm"
                  placeholder="Partner's name"
                  value={state.partnerBName}
                  onChange={(e) => setState((s) => ({ ...s, partnerBName: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-10">
            {step > 1 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="btn-ghost flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <div />
            )}

            {step < TOTAL_STEPS ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canContinue()}
                className={cn(
                  'btn-primary flex items-center gap-1',
                  !canContinue() && 'opacity-40 cursor-not-allowed'
                )}
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={!canContinue() || loading}
                className={cn(
                  'btn-primary flex items-center gap-1',
                  (!canContinue() || loading) && 'opacity-40 cursor-not-allowed'
                )}
              >
                {loading ? 'Building your plan...' : 'Build my plan →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
