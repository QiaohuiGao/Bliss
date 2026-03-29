import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import { api } from '@/lib/api'

const VIBE_OPTIONS = [
  { value: 'romantic', label: 'Romantic & dreamy' },
  { value: 'outdoor', label: 'Outdoor & natural' },
  { value: 'intimate', label: 'Intimate & personal' },
  { value: 'classic', label: 'Classic & elegant' },
  { value: 'modern', label: 'Modern & minimal' },
  { value: 'bohemian', label: 'Bohemian & free-spirited' },
  { value: 'rustic', label: 'Rustic & earthy' },
  { value: 'festive', label: 'Festive & fun' },
]

const PRIORITY_OPTIONS = [
  { value: 'photography', label: 'Beautiful photos' },
  { value: 'food', label: 'Great food & drinks' },
  { value: 'music', label: 'Dancing and music' },
  { value: 'ceremony', label: 'A meaningful ceremony' },
  { value: 'florals', label: 'Stunning florals' },
  { value: 'venue', label: 'An incredible venue' },
  { value: 'guests', label: 'Every guest feels welcome' },
  { value: 'personal', label: 'Personal DIY touches' },
]

const GUEST_OPTIONS = [
  { value: 'micro', label: 'Just us + a few people', sub: 'Under 15 guests' },
  { value: 'intimate', label: 'A close circle', sub: '15–50 guests' },
  { value: 'classic', label: 'Family and friends', sub: '50–120 guests' },
  { value: 'grand', label: 'Everyone we love', sub: '120+ guests' },
]

const STYLE_OPTIONS = [
  { value: 'full_diy', label: 'Mostly us', sub: 'DIY everything possible' },
  { value: 'mixed', label: 'A mix', sub: 'Some DIY, some vendors' },
  { value: 'vendor_led', label: 'Mostly vendors', sub: 'Professionals handle most' },
  { value: 'full_service', label: 'Hands off', sub: 'Someone else runs it' },
]

const TIMELINE_OPTIONS = [
  { value: 'fast', label: 'Under 6 months', sub: 'Need to move quickly' },
  { value: 'medium', label: '6–12 months', sub: 'Solid amount of time' },
  { value: 'comfortable', label: '12–18 months', sub: 'Plenty of runway' },
  { value: 'relaxed', label: '18+ months', sub: 'Lots of time' },
]

export default function OnboardingScreen() {
  const { getToken } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [state, setState] = useState({
    vibeTags: [] as string[],
    priorityTags: [] as string[],
    guestCountMode: '' as any,
    planningStyle: '' as any,
    timelineMode: '' as any,
    locationMode: 'suburban' as any,
    partnerAName: '',
  })

  const toggleTag = (key: 'vibeTags' | 'priorityTags', val: string) => {
    setState((s) => ({
      ...s,
      [key]: s[key].includes(val) ? s[key].filter((v) => v !== val) : [...s[key], val],
    }))
  }

  const canContinue = () => {
    if (step === 1) return state.vibeTags.length >= 1
    if (step === 2) return state.priorityTags.length >= 1
    if (step === 3) return !!state.guestCountMode
    if (step === 4) return !!state.planningStyle
    if (step === 5) return !!state.timelineMode
    return false
  }

  const handleFinish = async () => {
    setLoading(true)
    try {
      const token = await getToken()
      await api.createWedding({
        vibeTags: state.vibeTags,
        priorityTags: state.priorityTags,
        guestCountMode: state.guestCountMode,
        planningStyle: state.planningStyle,
        timelineMode: state.timelineMode,
        locationMode: state.locationMode,
        partnerAName: state.partnerAName || undefined,
      }, token!)
      router.replace('/(tabs)')
    } finally {
      setLoading(false)
    }
  }

  const progress = ((step - 1) / 5) * 100

  const ChipGrid = ({ options, selected, onToggle }: { options: { value: string; label: string }[]; selected: string[]; onToggle: (v: string) => void }) => (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          onPress={() => onToggle(opt.value)}
          className={`px-4 py-2 rounded-full border ${selected.includes(opt.value) ? 'bg-bliss-rose-dark border-bliss-rose-dark' : 'bg-white border-bliss-border'}`}
        >
          <Text className={`text-sm font-medium ${selected.includes(opt.value) ? 'text-white' : 'text-bliss-ink-light'}`}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )

  const SingleSelect = ({ options, value, onChange }: { options: any[]; value: string; onChange: (v: string) => void }) => (
    <View className="gap-3">
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          onPress={() => onChange(opt.value)}
          className={`px-5 py-4 rounded-2xl border-2 ${value === opt.value ? 'border-bliss-rose-dark bg-bliss-petal' : 'border-bliss-border bg-white'}`}
        >
          <Text className="font-medium text-bliss-ink">{opt.label}</Text>
          {opt.sub && <Text className="text-sm text-bliss-muted mt-0.5">{opt.sub}</Text>}
        </TouchableOpacity>
      ))}
    </View>
  )

  return (
    <SafeAreaView className="flex-1 bg-bliss-cream">
      {/* Progress */}
      <View className="h-1 bg-bliss-border">
        <View className="h-full bg-bliss-rose-dark" style={{ width: `${progress}%` }} />
      </View>

      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
        <Text className="text-bliss-muted text-sm mb-1">Step {step} of 5</Text>

        {step === 1 && (
          <>
            <Text className="font-serif text-3xl text-bliss-ink mb-1">What kind of wedding feels right?</Text>
            <Text className="text-bliss-ink-light mb-6">There's no wrong answer here.</Text>
            <ChipGrid options={VIBE_OPTIONS} selected={state.vibeTags} onToggle={(v) => toggleTag('vibeTags', v)} />
          </>
        )}
        {step === 2 && (
          <>
            <Text className="font-serif text-3xl text-bliss-ink mb-1">What matters most to you?</Text>
            <Text className="text-bliss-ink-light mb-6">Pick your top 3–4 priorities.</Text>
            <ChipGrid options={PRIORITY_OPTIONS} selected={state.priorityTags} onToggle={(v) => toggleTag('priorityTags', v)} />
          </>
        )}
        {step === 3 && (
          <>
            <Text className="font-serif text-3xl text-bliss-ink mb-1">How many people do you picture?</Text>
            <Text className="text-bliss-ink-light mb-6">An estimate is fine.</Text>
            <SingleSelect options={GUEST_OPTIONS} value={state.guestCountMode} onChange={(v) => setState((s) => ({ ...s, guestCountMode: v }))} />
          </>
        )}
        {step === 4 && (
          <>
            <Text className="font-serif text-3xl text-bliss-ink mb-1">How hands-on do you want to be?</Text>
            <Text className="text-bliss-ink-light mb-6">This shapes your guidance for every task.</Text>
            <SingleSelect options={STYLE_OPTIONS} value={state.planningStyle} onChange={(v) => setState((s) => ({ ...s, planningStyle: v }))} />
          </>
        )}
        {step === 5 && (
          <>
            <Text className="font-serif text-3xl text-bliss-ink mb-1">How long do you have?</Text>
            <Text className="text-bliss-ink-light mb-6">This helps us pace your stages.</Text>
            <SingleSelect options={TIMELINE_OPTIONS} value={state.timelineMode} onChange={(v) => setState((s) => ({ ...s, timelineMode: v }))} />
            <View className="mt-5">
              <Text className="text-sm text-bliss-ink-light font-medium mb-2">What should we call you? (optional)</Text>
              <TextInput
                className="border border-bliss-border rounded-xl px-4 py-3 text-bliss-ink bg-white"
                placeholder="Your name"
                placeholderTextColor="#9C8E8A"
                value={state.partnerAName}
                onChangeText={(t) => setState((s) => ({ ...s, partnerAName: t }))}
              />
            </View>
          </>
        )}

        <View className="h-24" />
      </ScrollView>

      {/* Footer */}
      <View className="px-5 pb-6 pt-3 flex-row gap-3">
        {step > 1 && (
          <TouchableOpacity className="border border-bliss-border bg-white rounded-xl py-3.5 px-5" onPress={() => setStep((s) => s - 1)}>
            <Text className="font-medium text-bliss-ink">Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          className={`flex-1 rounded-xl py-3.5 items-center ${canContinue() && !loading ? 'bg-bliss-rose-dark' : 'bg-bliss-rose-dark/40'}`}
          onPress={step < 5 ? () => setStep((s) => s + 1) : handleFinish}
          disabled={!canContinue() || loading}
        >
          <Text className="text-white font-semibold">
            {step < 5 ? 'Continue' : loading ? 'Building your plan...' : 'Build my plan →'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
