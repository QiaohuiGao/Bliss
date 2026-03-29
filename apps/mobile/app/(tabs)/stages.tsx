import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@clerk/clerk-expo'
import { api } from '@/lib/api'
import { CheckCircle, Circle, Lock, ChevronDown, ChevronRight } from 'lucide-react-native'

export default function StagesScreen() {
  const { getToken } = useAuth()
  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [stages, setStages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const token = await getToken()
    const wedding = await api.getMyWedding(token!)
    setWeddingId(wedding.id)
    const data = await api.getStages(wedding.id, token!)
    setStages(data)
    const current = data.find((s: any) => s.isUnlocked && !s.isComplete)
    if (current) setExpanded(current.stage)
    setLoading(false)
  }

  async function handleComplete(taskId: string) {
    const token = await getToken()
    await api.updateTask(taskId, { status: 'complete' }, token!)
    await load()
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bliss-cream items-center justify-center">
        <ActivityIndicator color="#C8766A" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-bliss-cream">
      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        <Text className="font-serif text-3xl text-bliss-ink mb-1">Your 7 stages</Text>
        <Text className="text-bliss-ink-light text-sm mb-6">
          Each stage unlocks when you complete the key deliverables.
        </Text>

        {stages.map((stage) => (
          <View key={stage.stage} className={`bg-white rounded-2xl border border-bliss-border mb-3 overflow-hidden ${!stage.isUnlocked ? 'opacity-60' : ''}`}>
            <TouchableOpacity
              className="flex-row items-center justify-between p-4"
              onPress={() => stage.isUnlocked && setExpanded(expanded === stage.stage ? null : stage.stage)}
              disabled={!stage.isUnlocked}
            >
              <View className="flex-row items-center gap-3 flex-1">
                <View className="w-7 h-7 rounded-full bg-bliss-petal items-center justify-center">
                  <Text className="text-xs font-bold text-bliss-rose-dark">{stage.stage}</Text>
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="font-medium text-bliss-ink">{stage.title}</Text>
                    {stage.isComplete && <CheckCircle size={14} color="#5C7A57" />}
                    {!stage.isUnlocked && <Lock size={12} color="#9C8E8A" />}
                  </View>
                  <Text className="text-xs text-bliss-muted">{stage.timeframe}</Text>
                </View>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-xs text-bliss-muted">{stage.completedTasks}/{stage.totalTasks}</Text>
                {stage.isUnlocked && (
                  expanded === stage.stage
                    ? <ChevronDown size={14} color="#9C8E8A" />
                    : <ChevronRight size={14} color="#9C8E8A" />
                )}
              </View>
            </TouchableOpacity>

            {/* Progress */}
            <View className="h-1 bg-bliss-border mx-4 mb-2 rounded-full overflow-hidden">
              <View
                className="h-full bg-bliss-rose-dark rounded-full"
                style={{ width: stage.totalTasks > 0 ? `${(stage.completedTasks / stage.totalTasks) * 100}%` : '0%' }}
              />
            </View>

            {/* Tasks */}
            {expanded === stage.stage && (
              <View className="border-t border-bliss-border px-4 pt-3 pb-4 gap-2">
                {stage.tasks.map((task: any) => (
                  <View key={task.id} className={`flex-row items-start gap-3 p-3 rounded-xl border ${task.isDeliverable ? 'border-bliss-rose/30 bg-bliss-petal/30' : 'border-bliss-border'}`}>
                    <TouchableOpacity
                      onPress={() => handleComplete(task.id)}
                      disabled={task.status === 'complete'}
                      className="mt-0.5"
                    >
                      {task.status === 'complete'
                        ? <CheckCircle size={18} color="#5C7A57" />
                        : <Circle size={18} color="#E8DDD8" />
                      }
                    </TouchableOpacity>
                    <View className="flex-1">
                      <Text className={`text-sm font-medium ${task.status === 'complete' ? 'line-through text-bliss-muted' : 'text-bliss-ink'}`}>
                        {task.title}
                        {task.isDeliverable && (
                          <Text className="text-bliss-rose-dark font-normal"> · key</Text>
                        )}
                      </Text>
                      <Text className="text-xs text-bliss-muted mt-0.5">{task.dueGuidance}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  )
}
