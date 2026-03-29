import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@clerk/clerk-expo'
import { api } from '@/lib/api'
import { Plus, Trash2 } from 'lucide-react-native'

function formatCents(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)
}

const CATEGORIES = ['venue', 'catering', 'photography', 'music', 'florals', 'attire', 'stationery', 'other']
const CATEGORY_LABELS: Record<string, string> = {
  venue: 'Venue', catering: 'Catering', photography: 'Photography',
  music: 'Music', florals: 'Florals', attire: 'Attire',
  stationery: 'Stationery', other: 'Other',
}

export default function BudgetScreen() {
  const { getToken } = useAuth()
  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [budgetData, setBudgetData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ category: 'venue', label: '', amount: '' })

  useEffect(() => { load() }, [])

  async function load() {
    const token = await getToken()
    const wedding = await api.getMyWedding(token!)
    setWeddingId(wedding.id)
    const budget = await api.getBudget(wedding.id, token!)
    setBudgetData(budget)
    setLoading(false)
  }

  async function handleAdd() {
    if (!weddingId || !form.label) return
    const token = await getToken()
    await api.addBudgetItem(weddingId, {
      category: form.category,
      label: form.label,
      estimatedCents: Math.round(parseFloat(form.amount || '0') * 100),
    }, token!)
    setShowAdd(false)
    setForm({ category: 'venue', label: '', amount: '' })
    await load()
  }

  async function handleDelete(id: string) {
    const token = await getToken()
    await api.deleteBudgetItem(id, token!)
    await load()
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bliss-cream items-center justify-center">
        <ActivityIndicator color="#C8766A" />
      </SafeAreaView>
    )
  }

  const { items, totalEstimatedCents, totalActualCents, estimateRanges } = budgetData

  return (
    <SafeAreaView className="flex-1 bg-bliss-cream">
      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between mb-5">
          <Text className="font-serif text-3xl text-bliss-ink">Budget</Text>
          <TouchableOpacity
            className="bg-bliss-rose-dark px-4 py-2 rounded-xl flex-row items-center gap-1"
            onPress={() => setShowAdd(true)}
          >
            <Plus size={14} color="white" />
            <Text className="text-white font-medium text-sm">Add</Text>
          </TouchableOpacity>
        </View>

        {/* Summary */}
        <View className="flex-row gap-3 mb-5">
          <View className="flex-1 bg-white rounded-2xl p-4 border border-bliss-border">
            <Text className="text-xs text-bliss-muted">Estimated</Text>
            <Text className="font-serif text-xl text-bliss-ink mt-1">{formatCents(totalEstimatedCents)}</Text>
          </View>
          <View className="flex-1 bg-white rounded-2xl p-4 border border-bliss-border">
            <Text className="text-xs text-bliss-muted">Paid</Text>
            <Text className="font-serif text-xl text-bliss-ink mt-1">{formatCents(totalActualCents)}</Text>
          </View>
        </View>

        {/* Items */}
        {items.length === 0 ? (
          <View className="bg-white rounded-2xl p-8 border border-bliss-border items-center">
            <Text className="font-medium text-bliss-ink mb-1">No items yet</Text>
            <Text className="text-sm text-bliss-ink-light text-center mb-4">
              {estimateRanges?.length > 0
                ? 'Here are typical ranges for a wedding like yours:'
                : 'Add your first budget item to start tracking.'}
            </Text>
            {estimateRanges?.map((r: any) => (
              <View key={r.category} className="flex-row justify-between w-full py-1 border-b border-bliss-border">
                <Text className="text-sm text-bliss-ink">{r.label}</Text>
                <Text className="text-sm text-bliss-muted">{formatCents(r.lowCents)}–{formatCents(r.highCents)}</Text>
              </View>
            ))}
          </View>
        ) : (
          CATEGORIES.filter((cat) => items.some((i: any) => i.category === cat)).map((cat) => {
            const catItems = items.filter((i: any) => i.category === cat)
            return (
              <View key={cat} className="bg-white rounded-2xl border border-bliss-border mb-3 overflow-hidden">
                <Text className="font-medium text-bliss-ink px-4 py-3 border-b border-bliss-border">{CATEGORY_LABELS[cat]}</Text>
                {catItems.map((item: any) => (
                  <View key={item.id} className="flex-row items-center px-4 py-3 border-b border-bliss-border last:border-0">
                    <View className="flex-1">
                      <Text className="text-sm text-bliss-ink">{item.label}</Text>
                      {item.isDiy && <Text className="text-xs text-bliss-sage-dark font-medium">DIY</Text>}
                    </View>
                    <Text className="text-sm text-bliss-ink-light mr-3">{formatCents(item.estimatedCents)}</Text>
                    <TouchableOpacity onPress={() => handleDelete(item.id)}>
                      <Trash2 size={14} color="#9C8E8A" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )
          })
        )}
        <View className="h-8" />
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={showAdd} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6">
            <Text className="font-serif text-xl text-bliss-ink mb-4">Add budget item</Text>
            <View className="gap-3">
              <TextInput
                className="border border-bliss-border rounded-xl px-4 py-3 text-bliss-ink"
                placeholder="Label (e.g. Main Street Venue)"
                placeholderTextColor="#9C8E8A"
                value={form.label}
                onChangeText={(t) => setForm((f) => ({ ...f, label: t }))}
              />
              <TextInput
                className="border border-bliss-border rounded-xl px-4 py-3 text-bliss-ink"
                placeholder="Amount ($)"
                placeholderTextColor="#9C8E8A"
                keyboardType="decimal-pad"
                value={form.amount}
                onChangeText={(t) => setForm((f) => ({ ...f, amount: t }))}
              />
            </View>
            <View className="flex-row gap-3 mt-5">
              <TouchableOpacity className="flex-1 border border-bliss-border rounded-xl py-3 items-center" onPress={() => setShowAdd(false)}>
                <Text className="font-medium text-bliss-ink">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 bg-bliss-rose-dark rounded-xl py-3 items-center" onPress={handleAdd}>
                <Text className="text-white font-semibold">Add item</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
