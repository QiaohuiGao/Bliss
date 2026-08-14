'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useToken } from '@/lib/useToken'
import { useRouter } from '@/i18n/routing'
import { api } from '@/lib/api'
import { cn, formatCents } from '@/lib/utils'
import { US_AVERAGE_BUDGET_CENTS, US_AVERAGE_PER_GUEST_CENTS } from '@/lib/constants'
import { US_STATES } from '@/lib/us-states'
import type {
  BudgetTier,
  Culture,
  GuestCountRange,
  OnboardingPayload,
  PlannerType,
  VenuePreference,
  WeddingStyle,
  WeddingType,
} from '@bliss/types'
import {
  ChevronRight, ChevronLeft, Calendar, Users, Palette, Wallet, MapPin,
  Sparkles, Leaf, Globe,
} from 'lucide-react'

const TOTAL_STEPS = 8

// Values are stable English slugs that reach the database. Only labels are
// translated, which is why nothing here is a display string.
const WEDDING_TYPES: WeddingType[] = [
  'traditional', 'micro', 'elopement', 'destination', 'courthouse',
]
const GUEST_RANGES: GuestCountRange[] = [
  'under_50', '50_100', '100_150', '150_250', 'over_250',
]
const STYLES: WeddingStyle[] = [
  'classic', 'modern', 'rustic', 'garden', 'beach_coastal', 'boho',
  'black_tie', 'destination', 'backyard', 'minimalist', 'vintage',
]
const VENUES: VenuePreference[] = [
  'hotel_ballroom', 'barn_farm', 'vineyard', 'estate_mansion', 'garden_park',
  'beach', 'church_temple', 'restaurant', 'museum_gallery', 'backyard',
  'all_inclusive_resort', 'courthouse',
]
const BUDGET_TIERS: BudgetTier[] = ['under_20k', '20k_40k', '40k_75k', 'over_75k']
const PLANNER_TYPES: PlannerType[] = ['full', 'partial', 'day_of', 'venue_only', 'none']
const CULTURES: Culture[] = [
  'south_asian', 'chinese', 'jewish', 'korean', 'nigerian', 'mexican',
  'persian', 'filipino', 'vietnamese', 'ethiopian', 'greek', 'italian',
  'polish', 'hmong', 'armenian', 'arab',
]

const STEP_ICONS = [Calendar, MapPin, Sparkles, Users, Palette, MapPin, Wallet, Globe]
const STEP_KEYS = [
  'date', 'location', 'type', 'guests', 'style', 'venue', 'budget', 'cultures',
] as const

interface State {
  weddingDate: string
  dateIsFlexible: boolean
  state: string
  city: string
  weddingType: WeddingType | null
  guestCountRange: GuestCountRange | null
  guestCountExact: string
  styles: WeddingStyle[]
  venuePreferences: VenuePreference[]
  budgetTier: BudgetTier | null
  weeklyCapacityHours: number
  plannerType: PlannerType | null
  cultures: Culture[]
}

export default function OnboardingPage() {
  const router = useRouter()
  const locale = useLocale()
  const getToken = useToken()
  const t = useTranslations('onboarding')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [s, setS] = useState<State>({
    weddingDate: '',
    dateIsFlexible: false,
    state: '',
    city: '',
    weddingType: null,
    guestCountRange: null,
    guestCountExact: '',
    styles: [],
    venuePreferences: [],
    budgetTier: null,
    weeklyCapacityHours: 5,
    plannerType: null,
    cultures: [],
  })

  function toggle<K extends 'styles' | 'venuePreferences' | 'cultures'>(
    key: K,
    value: State[K][number],
  ) {
    setS(prev => {
      const list = prev[key] as State[K][number][]
      return {
        ...prev,
        [key]: list.includes(value)
          ? list.filter(v => v !== value)
          : [...list, value],
      }
    })
  }

  const canContinue = () => {
    switch (step) {
      case 1: return s.weddingDate !== '' || s.dateIsFlexible
      case 2: return s.state !== ''
      case 3: return s.weddingType !== null
      case 4: return s.guestCountRange !== null || s.guestCountExact !== ''
      case 5: return s.styles.length >= 1
      case 6: return s.venuePreferences.length >= 1
      case 7: return s.budgetTier !== null && s.plannerType !== null
      case 8: return true
      default: return false
    }
  }

  const handleFinish = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      const payload: OnboardingPayload = {
        weddingDate: s.weddingDate || undefined,
        state: s.state || undefined,
        city: s.city || undefined,
        weddingType: s.weddingType ?? undefined,
        cultures: s.cultures.length ? s.cultures : undefined,
        guestCountRange: s.guestCountRange ?? undefined,
        guestCountExact: s.guestCountExact ? Number(s.guestCountExact) : undefined,
        styles: s.styles,
        budgetTier: s.budgetTier ?? undefined,
        weeklyCapacityHours: s.weeklyCapacityHours,
        venuePreferences: s.venuePreferences,
        hasPlanner: s.plannerType !== null && s.plannerType !== 'none',
        plannerType: s.plannerType ?? undefined,
      }
      await api.createWedding(payload, token)
      router.push('/board')
    } catch (e) {
      const message = e instanceof Error ? e.message : ''
      if (message.includes('already has a wedding')) {
        router.push('/board')
        return
      }
      setError(tErrors('generic'))
      setLoading(false)
    }
  }

  const StepIcon = STEP_ICONS[step - 1]!
  const stepKey = STEP_KEYS[step - 1]!

  const optionButton = (selected: boolean, extra = '') =>
    cn(
      'rounded-warm-lg border-2 transition-all duration-300 bg-white/80 backdrop-blur-sm',
      selected
        ? 'border-bliss-sage-dark shadow-glow-sage'
        : 'border-bliss-border/60 hover:border-bliss-sage hover:shadow-warm',
      extra,
    )

  return (
    <div className="min-h-screen bg-gradient-garden flex flex-col relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-bliss-sage-mist/40 rounded-full -translate-y-1/3 translate-x-1/3 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-bliss-terra-mist/30 rounded-full translate-y-1/3 -translate-x-1/3 blur-3xl" />

      <div className="fixed top-0 left-0 right-0 z-50 h-1.5 bg-bliss-sage-mist">
        <div
          className="h-1.5 bg-gradient-to-r from-bliss-sage-dark via-bliss-sage to-bliss-sage-light transition-all duration-700 ease-out rounded-r-full"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      <div className="pt-8 pb-2 text-center relative z-10">
        <span className="font-serif text-3xl font-light text-bliss-ink tracking-widest">
          {tCommon('app.name')}
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-12 relative z-10">
        <div className="w-full max-w-lg animate-fade-in" key={step}>
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-white/80 backdrop-blur-sm shadow-warm-md border border-bliss-sage-light/30 flex items-center justify-center mx-auto mb-5">
              <StepIcon className="w-7 h-7 text-bliss-sage-dark" />
            </div>
            <p className="text-bliss-muted text-sm font-medium mb-3 tracking-wider">
              {t('progress', { current: step, total: TOTAL_STEPS })}
            </p>
            <h2 className="font-serif text-3xl md:text-4xl text-bliss-ink mb-3 leading-tight font-medium">
              {t(`step.${stepKey}.title`)}
            </h2>
            <p className="text-bliss-ink-light text-base">
              {stepKey === 'budget'
                ? t('step.budget.help', {
                    average: formatCents(US_AVERAGE_BUDGET_CENTS, locale),
                    perGuest: formatCents(US_AVERAGE_PER_GUEST_CENTS, locale),
                  })
                : t(`step.${stepKey}.help`)}
            </p>
          </div>

          {/* 1 — Date */}
          {step === 1 && (
            <div className="max-w-sm mx-auto space-y-4">
              <input
                type="date"
                aria-label={t('step.date.label')}
                className="input-warm text-center text-lg font-medium bg-white/80 backdrop-blur-sm"
                value={s.weddingDate}
                onChange={e => setS(p => ({ ...p, weddingDate: e.target.value }))}
              />
              <button
                onClick={() => setS(p => ({ ...p, dateIsFlexible: !p.dateIsFlexible }))}
                className={optionButton(s.dateIsFlexible, 'w-full px-5 py-3 text-sm text-left')}
              >
                {t('step.date.flexible')}
              </button>
            </div>
          )}

          {/* 2 — Location */}
          {step === 2 && (
            <div className="max-w-sm mx-auto space-y-4">
              <select
                aria-label={t('step.location.stateLabel')}
                className="input-warm bg-white/80 backdrop-blur-sm"
                value={s.state}
                onChange={e => setS(p => ({ ...p, state: e.target.value }))}
              >
                <option value="">{t('step.location.statePlaceholder')}</option>
                {US_STATES.map(code => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
              <input
                aria-label={t('step.location.cityLabel')}
                className="input-warm bg-white/80 backdrop-blur-sm"
                placeholder={t('step.location.cityPlaceholder')}
                value={s.city}
                onChange={e => setS(p => ({ ...p, city: e.target.value }))}
              />
            </div>
          )}

          {/* 3 — Wedding type */}
          {step === 3 && (
            <div className="space-y-3 max-w-md mx-auto">
              {WEDDING_TYPES.map(value => (
                <button
                  key={value}
                  onClick={() => setS(p => ({ ...p, weddingType: value }))}
                  className={optionButton(s.weddingType === value, 'w-full text-left px-6 py-4')}
                >
                  <div className="font-semibold text-bliss-ink">
                    {t(`step.type.option.${value}`)}
                  </div>
                  <div className="text-sm text-bliss-muted mt-0.5">
                    {t(`step.type.option.${value}Hint`)}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* 4 — Guests */}
          {step === 4 && (
            <div className="max-w-md mx-auto space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {GUEST_RANGES.map(value => (
                  <button
                    key={value}
                    onClick={() => setS(p => ({ ...p, guestCountRange: value }))}
                    className={optionButton(s.guestCountRange === value, 'px-4 py-4 text-center font-medium text-bliss-ink')}
                  >
                    {t(`step.guests.range.${value}`)}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                max={5000}
                aria-label={t('step.guests.exactLabel')}
                className="input-warm text-center bg-white/80 backdrop-blur-sm"
                placeholder={t('step.guests.exactLabel')}
                value={s.guestCountExact}
                onChange={e => setS(p => ({ ...p, guestCountExact: e.target.value }))}
              />
            </div>
          )}

          {/* 5 — Style */}
          {step === 5 && (
            <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
              {STYLES.map(value => (
                <button
                  key={value}
                  onClick={() => toggle('styles', value)}
                  className={optionButton(s.styles.includes(value), 'px-4 py-2.5 text-sm font-medium text-bliss-ink')}
                >
                  {t(`step.style.option.${value}`)}
                </button>
              ))}
            </div>
          )}

          {/* 6 — Venue */}
          {step === 6 && (
            <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
              {VENUES.map(value => (
                <button
                  key={value}
                  onClick={() => toggle('venuePreferences', value)}
                  className={optionButton(s.venuePreferences.includes(value), 'px-4 py-2.5 text-sm font-medium text-bliss-ink')}
                >
                  {t(`step.venue.option.${value}`)}
                </button>
              ))}
            </div>
          )}

          {/* 7 — Budget and planner */}
          {step === 7 && (
            <div className="max-w-md mx-auto space-y-6">
              <div className="grid grid-cols-2 gap-3">
                {BUDGET_TIERS.map(value => (
                  <button
                    key={value}
                    onClick={() => setS(p => ({ ...p, budgetTier: value }))}
                    className={optionButton(s.budgetTier === value, 'px-4 py-4 text-center font-medium text-bliss-ink')}
                  >
                    {t(`step.budget.tier.${value}`)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-bliss-muted text-center px-4">
                {tCommon('money.regionalNote')}
              </p>
              <div className="rounded-warm-lg border border-bliss-border/60 bg-white/80 px-5 py-4">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div>
                    <p className="text-sm font-medium text-bliss-ink">{t('step.budget.capacityLabel')}</p>
                    <p className="text-xs text-bliss-muted mt-1">{t('step.budget.capacityHint')}</p>
                  </div>
                  <span className="font-serif text-2xl text-bliss-sage-dark shrink-0">
                    {t('step.budget.capacityValue', { hours: s.weeklyCapacityHours })}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={s.weeklyCapacityHours}
                  aria-label={t('step.budget.capacityLabel')}
                  onChange={event => setS(previous => ({
                    ...previous,
                    weeklyCapacityHours: Number(event.target.value),
                  }))}
                  className="w-full accent-bliss-sage-dark"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-bliss-ink mb-3">
                  {t('step.budget.plannerLabel')}
                </p>
                <div className="space-y-2">
                  {PLANNER_TYPES.map(value => (
                    <button
                      key={value}
                      onClick={() => setS(p => ({ ...p, plannerType: value }))}
                      className={optionButton(s.plannerType === value, 'w-full text-left px-5 py-3 text-sm text-bliss-ink')}
                    >
                      {t(`step.budget.planner.${value}`)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-bliss-muted mt-3">
                  {t('step.budget.plannerHint')}
                </p>
              </div>
            </div>
          )}

          {/* 8 — Cultural traditions */}
          {step === 8 && (
            <div className="max-w-md mx-auto">
              <div className="flex flex-wrap justify-center gap-2">
                {CULTURES.map(value => (
                  <button
                    key={value}
                    onClick={() => toggle('cultures', value)}
                    className={optionButton(s.cultures.includes(value), 'px-4 py-2.5 text-sm font-medium text-bliss-ink')}
                  >
                    {t(`step.cultures.option.${value}`)}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setS(p => ({ ...p, cultures: [] }))}
                className="btn-ghost text-sm mx-auto block mt-6"
              >
                {t('step.cultures.none')}
              </button>
            </div>
          )}

          {error && (
            <div role="alert" className="mt-4 text-center text-red-500 text-sm animate-slide-down">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between mt-12 max-w-md mx-auto">
            {step > 1 ? (
              <button onClick={() => setStep(v => v - 1)} className="btn-ghost flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> {tCommon('action.back')}
              </button>
            ) : (
              <div />
            )}

            {step < TOTAL_STEPS ? (
              <button
                onClick={() => { setStep(v => v + 1); setError(null) }}
                disabled={!canContinue()}
                className={cn('btn-primary flex items-center gap-2', !canContinue() && 'opacity-40 cursor-not-allowed')}
              >
                {tCommon('action.next')} <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={loading}
                className={cn('btn-primary flex items-center gap-2 px-10', loading && 'opacity-70 cursor-not-allowed')}
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    {t('generating.title')}
                  </>
                ) : (
                  <>{t('finish')} <Leaf className="w-4 h-4" /></>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
