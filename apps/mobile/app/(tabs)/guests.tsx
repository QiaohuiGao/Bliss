import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@clerk/clerk-expo'
import { api } from '@/lib/api'
import { UserPlus, Check, X, Trash2 } from 'lucide-react-native'

export default function GuestsScreen() {
  const { getToken } = useAuth()
  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [guests, setGuests] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', side: 'mutual', plusOne: false })

  useEffect(() => { load() }, [])

  async function load() {
    const token = await getToken()
    const wedding = await api.getMyWedding(token!)
    setWeddingId(wedding.id)
    const data = await api.getGuests(wedding.id, token!)
    setGuests(data.guests)
    setStats(data.stats)
    setLoading(false)
  }

  async function handleAdd() {
    if (!weddingId || !form.name) return
    const token = await getToken()
    await api.addGuest(weddingId, form, token!)
    setShowAdd(false)
    setForm({ name: '', email: '', side: 'mutual', plusOne: false })
    await load()
  }

  async function handleRSVP(id: string, status: string) {
    const token = await getToken()
    await api.updateGuest(id, { rsvpStatus: status }, token!)
    await load()
  }

  async function handleDelete(id: string) {
    const token = await getToken()
    await api.deleteGuest(id, token!)
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
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="font-serif text-3xl text-bliss-ink">Guests</Text>
            <Text className="text-bliss-ink-light text-sm">
              {stats?.total ?? 0} total · {stats?.confirmed ?? 0} confirmed
            </Text>
          </View>
          <TouchableOpacity
            className="bg-bliss-rose-dark px-4 py-2 rounded-xl flex-row items-center gap-1"
            onPress={() => setShowAdd(true)}
          >
            <UserPlus size={14} color="white" />
            <Text className="text-white font-medium text-sm">Add</Text>
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        {guests.length > 0 && (
          <View className="flex-row gap-2 mb-5">
            {[
              { label: 'Coming', value: stats?.confirmed, color: 'text-green-700' },
              { label: 'Pending', value: stats?.pending, color: 'text-bliss-muted' },
              { label: 'Declined', value: stats?.declined, color: 'text-red-500' },
            ].map(({ label, value, color }) => (
              <View key={label} className="flex-1 bg-white rounded-xl p-3 border border-bliss-border items-center">
                <Text className={`font-serif text-xl ${color}`}>{value ?? 0}</Text>
                <Text className="text-xs text-bliss-muted">{label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Guest list */}
        {guests.length === 0 ? (
          <View className="bg-white rounded-2xl p-8 border border-bliss-border items-center">
            <Text className="font-medium text-bliss-ink mb-1">No guests yet</Text>
            <Text className="text-sm text-bliss-ink-light text-center mb-4">
              Start with the people you can't imagine it without.
            </Text>
            <TouchableOpacity className="bg-bliss-rose-dark px-6 py-2.5 rounded-xl" onPress={() => setShowAdd(true)}>
              <Text className="text-white font-semibold">Add first guest</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="bg-white rounded-2xl border border-bliss-border overflow-hidden mb-8">
            {guests.map((guest, i) => (
              <View key={guest.id} className={`flex-row items-center gap-3 px-4 py-3 ${i < guests.length - 1 ? 'border-b border-bliss-border' : ''}`}>
                <View className="w-8 h-8 rounded-full bg-bliss-petal items-center justify-center">
                  <Text className="text-sm font-bold text-bliss-rose-dark">
                    {guest.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-medium text-bliss-ink" numberOfLines={1}>{guest.name}</Text>
                  <Text className="text-xs text-bliss-muted">{guest.rsvpStatus}</Text>
                </View>
                {guest.rsvpStatus === 'pending' && (
                  <View className="flex-row gap-1">
                    <TouchableOpacity
                      className="w-7 h-7 rounded-full bg-green-50 border border-green-200 items-center justify-center"
                      onPress={() => handleRSVP(guest.id, 'yes')}
                    >
                      <Check size={12} color="#15803d" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="w-7 h-7 rounded-full bg-red-50 border border-red-200 items-center justify-center"
                      onPress={() => handleRSVP(guest.id, 'no')}
                    >
                      <X size={12} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                )}
                {guest.rsvpStatus === 'yes' && (
                  <View className="bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                    <Text className="text-xs text-green-700 font-medium">Coming</Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => handleDelete(guest.id)} className="ml-1">
                  <Trash2 size={14} color="#9C8E8A" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={showAdd} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6">
            <Text className="font-serif text-xl text-bliss-ink mb-4">Add a guest</Text>
            <View className="gap-3">
              <TextInput
                className="border border-bliss-border rounded-xl px-4 py-3 text-bliss-ink"
                placeholder="Full name"
                placeholderTextColor="#9C8E8A"
                value={form.name}
                onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
              />
              <TextInput
                className="border border-bliss-border rounded-xl px-4 py-3 text-bliss-ink"
                placeholder="Email (optional)"
                placeholderTextColor="#9C8E8A"
                keyboardType="email-address"
                value={form.email}
                onChangeText={(t) => setForm((f) => ({ ...f, email: t }))}
              />
            </View>
            <View className="flex-row gap-3 mt-5">
              <TouchableOpacity className="flex-1 border border-bliss-border rounded-xl py-3 items-center" onPress={() => setShowAdd(false)}>
                <Text className="font-medium text-bliss-ink">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 bg-bliss-rose-dark rounded-xl py-3 items-center" onPress={handleAdd}>
                <Text className="text-white font-semibold">Add guest</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
