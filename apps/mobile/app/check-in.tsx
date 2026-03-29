import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import { api } from '@/lib/api'
import { X } from 'lucide-react-native'

type Mood = 'great' | 'okay' | 'overwhelmed' | 'stressed' | 'lost'

const MOODS = [
  { value: 'great' as Mood, label: 'Excited & good', emoji: '😊' },
  { value: 'okay' as Mood, label: 'Okay, managing', emoji: '🙂' },
  { value: 'overwhelmed' as Mood, label: 'A bit overwhelmed', emoji: '😓' },
  { value: 'stressed' as Mood, label: 'Really stressed', emoji: '😰' },
  { value: 'lost' as Mood, label: 'Lost & unsure', emoji: '😕' },
]

const MOOD_CONTEXTS: Record<Mood, string[]> = {
  great: ['everything_going_well', 'excited_about_decision', 'ahead_of_schedule', 'partner_aligned', 'just_finished_something_big'],
  okay: ['managing_but_tired', 'some_things_uncertain', 'partner_not_engaged', 'budget_feeling_tight', 'decisions_feeling_big'],
  overwhelmed: ['too_many_decisions', 'too_many_tasks', 'family_pressure', 'vendor_coordination', 'time_running_out'],
  stressed: ['conflict_with_partner', 'financial_strain', 'something_went_wrong', 'overwhelmed_by_options', 'work_life_balance'],
  lost: ['dont_know_where_to_start', 'conflicting_advice', 'changed_my_mind', 'comparison_anxiety', 'not_enjoying_planning'],
}

const CONTEXT_LABELS: Record<string, string> = {
  everything_going_well: 'Everything is going well',
  excited_about_decision: 'Just made a great decision',
  ahead_of_schedule: 'Ahead of schedule',
  partner_aligned: 'Partner and I are in sync',
  just_finished_something_big: 'Just finished something big',
  managing_but_tired: 'Managing but feeling tired',
  some_things_uncertain: 'Some things still uncertain',
  partner_not_engaged: "Partner isn't as engaged",
  budget_feeling_tight: 'Budget is feeling tight',
  decisions_feeling_big: 'Decisions feel too big',
  too_many_decisions: 'Too many decisions at once',
  too_many_tasks: 'Too many tasks piling up',
  family_pressure: 'Family pressure',
  vendor_coordination: 'Vendor coordination stress',
  time_running_out: 'Time is running out',
  conflict_with_partner: 'Conflict with partner',
  financial_strain: 'Financial strain',
  something_went_wrong: 'Something went wrong',
  overwhelmed_by_options: 'Too many options',
  work_life_balance: 'Hard to balance with work',
  dont_know_where_to_start: "Don't know where to start",
  conflicting_advice: 'Too much conflicting advice',
  changed_my_mind: 'Changed my mind about something',
  comparison_anxiety: 'Comparing myself to others',
  not_enjoying_planning: 'Not enjoying the process',
}

export default function CheckInScreen() {
  const { getToken } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<'mood' | 'context' | 'response'>('mood')
  const [mood, setMood] = useState<Mood | null>(null)
  const [response, setResponse] = useState<any>(null)

  async function handleContext(ctx: string) {
    const token = await getToken()
    const wedding = await api.getMyWedding(token!)
    const [res] = await Promise.all([
      api.getStressResponse(mood!, ctx),
      api.saveCheckIn(wedding.id, mood!, ctx, token!),
    ])
    setResponse(res)
    setStep('response')
  }

  return (
    <SafeAreaView className="flex-1 bg-bliss-cream">
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-bliss-border">
        <Text className="font-serif text-lg text-bliss-ink">How are you doing?</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <X size={20} color="#9C8E8A" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 pt-5">
        {step === 'mood' && (
          <View>
            <Text className="text-bliss-ink-light mb-4">Pick the one that feels most true right now.</Text>
            {MOODS.map((m) => (
              <TouchableOpacity
                key={m.value}
                className="flex-row items-center gap-3 bg-white border border-bliss-border rounded-2xl px-4 py-3.5 mb-2"
                onPress={() => { setMood(m.value); setStep('context') }}
              >
                <Text className="text-2xl">{m.emoji}</Text>
                <Text className="font-medium text-bliss-ink">{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 'context' && mood && (
          <View>
            <Text className="text-bliss-ink-light mb-4">What's taking up the most headspace?</Text>
            {MOOD_CONTEXTS[mood].map((ctx) => (
              <TouchableOpacity
                key={ctx}
                className="bg-white border border-bliss-border rounded-2xl px-4 py-3.5 mb-2"
                onPress={() => handleContext(ctx)}
              >
                <Text className="text-bliss-ink">{CONTEXT_LABELS[ctx] ?? ctx}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 'response' && response && (
          <View>
            <Text className="text-bliss-ink text-base leading-relaxed mb-4">{response.validation}</Text>
            <View className="bg-bliss-petal rounded-2xl p-4 mb-4">
              <Text className="text-xs font-medium text-bliss-muted uppercase tracking-wide mb-1">One honest tip</Text>
              <Text className="text-sm text-bliss-ink leading-relaxed">{response.honestTip}</Text>
            </View>
            {response.actionTiles?.length > 0 && (
              <View>
                <Text className="text-xs font-medium text-bliss-muted uppercase tracking-wide mb-2">Things to try</Text>
                <View className="flex-row flex-wrap gap-2 mb-6">
                  {response.actionTiles.map((tile: string) => (
                    <View key={tile} className="bg-white border border-bliss-border rounded-xl px-3 py-2">
                      <Text className="text-sm text-bliss-ink-light">{tile}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            <TouchableOpacity
              className="bg-bliss-rose-dark rounded-2xl py-4 items-center"
              onPress={() => router.back()}
            >
              <Text className="text-white font-semibold">Back to planning</Text>
            </TouchableOpacity>
          </View>
        )}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  )
}
