import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import { api } from '@/lib/api'
import { CheckCircle, Circle, ChevronRight, Calendar, Heart, DollarSign } from 'lucide-react-native'

function formatCents(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)
}

function daysText(days: number | null) {
  if (days === null) return 'Date not set'
  if (days <= 0) return 'Wedding day!'
  if (days < 30) return `${days} days to go`
  return `${Math.floor(days / 30)} months to go`
}

export default function DashboardScreen() {
  const { getToken } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [celebration, setCelebration] = useState<any>(null)
  const [showStress, setShowStress] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const token = await getToken()
    try {
      const wedding = await api.getMyWedding(token!)
      setWeddingId(wedding.id)
      const dashboard = await api.getDashboard(wedding.id, token!)
      setData(dashboard)
      if (dashboard.pendingCelebration) {
        setCelebration(dashboard.pendingCelebration)
      }
    } catch (e) {
      router.replace('/onboarding')
    } finally {
      setLoading(false)
    }
  }

  async function handleComplete(taskId: string) {
    const token = await getToken()
    await api.updateTask(taskId, { status: 'complete' }, token!)
    await loadData()
  }

  async function dismissCelebration() {
    if (!celebration) return
    const token = await getToken()
    await api.dismissCelebration(celebration.id, token!)
    setCelebration(null)
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bliss-cream items-center justify-center">
        <ActivityIndicator color="#C8766A" />
      </SafeAreaView>
    )
  }

  if (!data) return null

  const { wedding, nextTasks, stageProgress, daysUntilWedding, budgetSnapshot } = data
  const currentStage = stageProgress?.find((s: any) => s.stage === wedding.currentStage)
  const name = wedding.partnerAName && wedding.partnerBName
    ? `${wedding.partnerAName} & ${wedding.partnerBName}`
    : wedding.partnerAName ?? 'Your Wedding'

  return (
    <SafeAreaView className="flex-1 bg-bliss-cream">
      {/* Celebration modal */}
      {celebration?.content && celebration.content.type === 'full_card' && (
        <Modal transparent animationType="fade">
          <View className="flex-1 bg-black/50 items-center justify-center p-6">
            <View className="bg-white rounded-3xl p-8 w-full max-w-sm items-center shadow-2xl">
              <Text className="text-5xl mb-4">{celebration.content.emoji}</Text>
              <Text className="font-serif text-2xl text-bliss-ink mb-3 text-center">{celebration.content.headline}</Text>
              <Text className="text-bliss-ink-light text-center leading-relaxed mb-6">{celebration.content.body}</Text>
              <TouchableOpacity
                className="bg-bliss-rose-dark px-8 py-3 rounded-2xl w-full items-center"
                onPress={dismissCelebration}
              >
                <Text className="text-white font-semibold">Keep going →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text className="font-serif text-3xl text-bliss-ink mb-1">{name}</Text>
        <Text className="text-bliss-ink-light mb-5">Your wedding plan is looking good.</Text>

        {/* Stat cards */}
        <View className="flex-row gap-3 mb-5">
          <View className="flex-1 bg-white rounded-2xl p-4 border border-bliss-border">
            <Calendar size={16} color="#9C8E8A" />
            <Text className="text-xs text-bliss-muted mt-2">Wedding day</Text>
            <Text className="font-semibold text-bliss-ink text-sm mt-0.5">{daysText(daysUntilWedding)}</Text>
          </View>
          <View className="flex-1 bg-white rounded-2xl p-4 border border-bliss-border">
            <Heart size={16} color="#9C8E8A" />
            <Text className="text-xs text-bliss-muted mt-2">Stage</Text>
            <Text className="font-semibold text-bliss-ink text-sm mt-0.5">{currentStage?.title ?? `Stage ${wedding.currentStage}`}</Text>
          </View>
        </View>

        {/* Budget snapshot */}
        {budgetSnapshot && (
          <View className="bg-white rounded-2xl p-4 border border-bliss-border mb-5 flex-row items-center gap-3">
            <DollarSign size={16} color="#9C8E8A" />
            <View>
              <Text className="text-xs text-bliss-muted">Budget</Text>
              <Text className="text-sm font-medium text-bliss-ink">
                {formatCents(budgetSnapshot.totalActualCents)} of {formatCents(budgetSnapshot.totalEstimatedCents)}
              </Text>
            </View>
          </View>
        )}

        {/* Stress check-in */}
        {data.stressCheckInDue && (
          <TouchableOpacity
            className="bg-bliss-petal border border-bliss-rose/30 rounded-2xl p-4 mb-5 flex-row items-center justify-between"
            onPress={() => router.push('/check-in')}
          >
            <View className="flex-1">
              <Text className="font-medium text-bliss-ink text-sm">How are you feeling?</Text>
              <Text className="text-xs text-bliss-ink-light mt-0.5">A quick check-in. 30 seconds.</Text>
            </View>
            <ChevronRight size={16} color="#9C8E8A" />
          </TouchableOpacity>
        )}

        {/* Next tasks */}
        <View className="bg-white rounded-2xl border border-bliss-border overflow-hidden mb-8">
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-bliss-border">
            <Text className="font-serif text-lg text-bliss-ink">What's next</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/stages')}>
              <Text className="text-sm text-bliss-rose-dark">See all</Text>
            </TouchableOpacity>
          </View>

          {nextTasks?.length === 0 ? (
            <View className="p-6 items-center">
              <Text className="font-medium text-bliss-ink mb-1">All caught up!</Text>
              <Text className="text-sm text-bliss-ink-light text-center">Stage {wedding.currentStage} complete.</Text>
            </View>
          ) : (
            nextTasks?.map((task: any) => (
              <View key={task.id} className="flex-row items-start gap-3 px-4 py-3 border-b border-bliss-border last:border-0">
                <TouchableOpacity
                  onPress={() => handleComplete(task.id)}
                  disabled={task.status === 'complete'}
                  className="mt-0.5"
                >
                  {task.status === 'complete'
                    ? <CheckCircle size={20} color="#5C7A57" />
                    : <Circle size={20} color="#E8DDD8" />
                  }
                </TouchableOpacity>
                <View className="flex-1">
                  <Text className={`text-sm font-medium ${task.status === 'complete' ? 'line-through text-bliss-muted' : 'text-bliss-ink'}`}>
                    {task.title}
                  </Text>
                  <Text className="text-xs text-bliss-muted mt-0.5">{task.dueGuidance}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
