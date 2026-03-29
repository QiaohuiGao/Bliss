'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Guest, GuestSide, RSVPStatus } from '@bliss/types'
import { Plus, Trash2, Users, Check, X, Clock, UserPlus } from 'lucide-react'
import { NavBar } from '../shared/NavBar'

const RSVP_BADGE: Record<RSVPStatus, { label: string; class: string; icon: React.ElementType }> = {
  yes: { label: 'Coming', class: 'bg-green-50 text-green-700 border-green-200', icon: Check },
  no: { label: 'Not coming', class: 'bg-red-50 text-red-600 border-red-200', icon: X },
  pending: { label: 'Pending', class: 'bg-bliss-cream text-bliss-muted border-bliss-border', icon: Clock },
}

const SIDE_LABELS: Record<GuestSide, string> = {
  partner_a: 'Partner A',
  partner_b: 'Partner B',
  mutual: 'Mutual',
}

export function GuestsClient({ token }: { token: string }) {
  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [guests, setGuests] = useState<Guest[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState<RSVPStatus | 'all'>('all')
  const [form, setForm] = useState({
    name: '', email: '', side: 'mutual' as GuestSide,
    priority: 'must_invite' as const, dietaryNotes: '', plusOne: false,
  })

  useEffect(() => {
    async function load() {
      const wedding = await api.getMyWedding(token)
      setWeddingId(wedding.id)
      const data = await api.getGuests(wedding.id, token)
      setGuests(data.guests)
      setStats(data.stats)
      setLoading(false)
    }
    load()
  }, [token])

  const reload = async () => {
    if (!weddingId) return
    const data = await api.getGuests(weddingId, token)
    setGuests(data.guests)
    setStats(data.stats)
  }

  const handleAdd = async () => {
    if (!weddingId || !form.name) return
    await api.addGuest(weddingId, form, token)
    setShowAdd(false)
    setForm({ name: '', email: '', side: 'mutual', priority: 'must_invite', dietaryNotes: '', plusOne: false })
    await reload()
  }

  const handleRSVP = async (guest: Guest, status: RSVPStatus) => {
    await api.updateGuest(guest.id, { rsvpStatus: status }, token)
    await reload()
  }

  const handleDelete = async (id: string) => {
    await api.deleteGuest(id, token)
    await reload()
  }

  const filtered = filter === 'all' ? guests : guests.filter((g) => g.rsvpStatus === filter)

  if (loading) {
    return <div className="min-h-screen bg-bliss-cream flex items-center justify-center"><div className="text-bliss-muted">Loading guests...</div></div>
  }

  return (
    <div className="min-h-screen bg-bliss-cream pb-24 md:pb-0">
      <NavBar weddingId={weddingId!} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif text-3xl text-bliss-ink mb-1">Guests</h1>
            <p className="text-bliss-ink-light text-sm">
              {guests.length === 0
                ? "No guests yet — start with the people you can't imagine it without."
                : `${stats?.total ?? 0} guests · ${stats?.confirmed ?? 0} confirmed`}
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5 text-sm py-2">
            <UserPlus className="w-4 h-4" /> Add guest
          </button>
        </div>

        {/* Stats */}
        {guests.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mb-6">
            {[
              { label: 'Total', value: stats?.total, status: 'all' },
              { label: 'Coming', value: stats?.confirmed, status: 'yes' },
              { label: 'Declined', value: stats?.declined, status: 'no' },
              { label: 'Pending', value: stats?.pending, status: 'pending' },
            ].map(({ label, value, status }) => (
              <button
                key={status}
                onClick={() => setFilter(status as any)}
                className={cn(
                  'warm-card p-3 text-center transition-all',
                  filter === status && 'ring-2 ring-bliss-rose-dark'
                )}
              >
                <div className="font-serif text-xl text-bliss-ink">{value ?? 0}</div>
                <div className="text-xs text-bliss-muted">{label}</div>
              </button>
            ))}
          </div>
        )}

        {/* Guest list */}
        {filtered.length === 0 ? (
          <div className="warm-card p-8 text-center">
            <Users className="w-10 h-10 text-bliss-border mx-auto mb-3" />
            <p className="font-medium text-bliss-ink mb-1">No guests here yet</p>
            <p className="text-sm text-bliss-ink-light mb-4">Add the people who matter most first.</p>
            <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">Add first guest</button>
          </div>
        ) : (
          <div className="warm-card divide-y divide-bliss-border overflow-hidden">
            {filtered.map((guest) => {
              const badge = RSVP_BADGE[guest.rsvpStatus]
              return (
                <div key={guest.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-8 h-8 rounded-full bg-bliss-petal flex items-center justify-center shrink-0">
                    <span className="text-sm font-medium text-bliss-rose-dark">
                      {guest.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-bliss-ink truncate">{guest.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-bliss-muted">{SIDE_LABELS[guest.side]}</span>
                      {guest.plusOne && <span className="text-xs text-bliss-ink-light">+ plus one</span>}
                      {guest.dietaryNotes && <span className="text-xs text-bliss-muted">· {guest.dietaryNotes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', badge.class)}>
                      {badge.label}
                    </span>
                    {guest.rsvpStatus === 'pending' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleRSVP(guest, 'yes')}
                          className="w-6 h-6 rounded-full bg-green-50 border border-green-200 flex items-center justify-center hover:bg-green-100 transition-colors"
                        >
                          <Check className="w-3 h-3 text-green-700" />
                        </button>
                        <button
                          onClick={() => handleRSVP(guest, 'no')}
                          className="w-6 h-6 rounded-full bg-red-50 border border-red-200 flex items-center justify-center hover:bg-red-100 transition-colors"
                        >
                          <X className="w-3 h-3 text-red-600" />
                        </button>
                      </div>
                    )}
                    <button onClick={() => handleDelete(guest.id)} className="text-bliss-muted hover:text-red-500 ml-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add guest modal */}
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-bliss-ink/40 backdrop-blur-sm p-4">
            <div className="warm-card-lg w-full max-w-md p-6 shadow-warm-lg">
              <h3 className="font-serif text-xl text-bliss-ink mb-4">Add a guest</h3>
              <div className="space-y-3">
                <input className="input-warm" placeholder="Full name" value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                <input className="input-warm" placeholder="Email (optional)" type="email" value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                <select className="input-warm" value={form.side}
                  onChange={(e) => setForm((f) => ({ ...f, side: e.target.value as GuestSide }))}>
                  <option value="mutual">Mutual friend / family</option>
                  <option value="partner_a">Partner A's side</option>
                  <option value="partner_b">Partner B's side</option>
                </select>
                <input className="input-warm" placeholder="Dietary notes (optional)" value={form.dietaryNotes}
                  onChange={(e) => setForm((f) => ({ ...f, dietaryNotes: e.target.value }))} />
                <label className="flex items-center gap-2 text-sm text-bliss-ink-light cursor-pointer">
                  <input type="checkbox" checked={form.plusOne}
                    onChange={(e) => setForm((f) => ({ ...f, plusOne: e.target.checked }))} className="rounded" />
                  Bringing a plus one
                </label>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleAdd} disabled={!form.name} className="btn-primary flex-1 disabled:opacity-40">Add guest</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
