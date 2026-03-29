'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { formatCents, formatCentsRange, cn } from '@/lib/utils'
import type { BudgetItem, BudgetCategory } from '@bliss/types'
import { Plus, Trash2, DollarSign, TrendingUp, Info } from 'lucide-react'
import { NavBar } from '../shared/NavBar'

const CATEGORY_LABELS: Record<BudgetCategory, string> = {
  venue: 'Venue', catering: 'Catering & Food', photography: 'Photography',
  music: 'Music & Entertainment', florals: 'Florals & Décor', attire: 'Attire',
  stationery: 'Stationery & Paper', other: 'Everything Else',
}
const CATEGORIES = Object.keys(CATEGORY_LABELS) as BudgetCategory[]

export function BudgetClient({ token }: { token: string }) {
  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [budgetData, setBudgetData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ category: 'venue' as BudgetCategory, label: '', estimatedCents: 0, isDiy: false, vendorName: '' })

  useEffect(() => {
    async function load() {
      const wedding = await api.getMyWedding(token)
      setWeddingId(wedding.id)
      const budget = await api.getBudget(wedding.id, token)
      setBudgetData(budget)
      setLoading(false)
    }
    load()
  }, [token])

  const reload = async () => {
    if (!weddingId) return
    const budget = await api.getBudget(weddingId, token)
    setBudgetData(budget)
  }

  const handleAdd = async () => {
    if (!weddingId || !form.label) return
    await api.addBudgetItem(weddingId, {
      ...form,
      estimatedCents: Math.round(form.estimatedCents * 100),
    }, token)
    setShowAdd(false)
    setForm({ category: 'venue', label: '', estimatedCents: 0, isDiy: false, vendorName: '' })
    await reload()
  }

  const handleDelete = async (id: string) => {
    await api.deleteBudgetItem(id, token)
    await reload()
  }

  const handleMarkPaid = async (item: BudgetItem, actualCents: number) => {
    await api.updateBudgetItem(item.id, { actualCents, paidAt: new Date().toISOString() }, token)
    await reload()
  }

  if (loading) {
    return <div className="min-h-screen bg-bliss-cream flex items-center justify-center"><div className="text-bliss-muted">Loading budget...</div></div>
  }

  const { items, totalEstimatedCents, totalActualCents, estimateRanges, tips } = budgetData

  return (
    <div className="min-h-screen bg-bliss-cream pb-24 md:pb-0">
      <NavBar weddingId={weddingId!} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif text-3xl text-bliss-ink mb-1">Budget</h1>
            <p className="text-bliss-ink-light text-sm">Here's what a wedding like yours typically looks like. Shape it to fit you.</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5 text-sm py-2">
            <Plus className="w-4 h-4" /> Add item
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="warm-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-bliss-muted" />
              <span className="text-xs text-bliss-muted">Estimated total</span>
            </div>
            <div className="font-serif text-2xl text-bliss-ink">{formatCents(totalEstimatedCents)}</div>
          </div>
          <div className="warm-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-bliss-muted" />
              <span className="text-xs text-bliss-muted">Paid so far</span>
            </div>
            <div className="font-serif text-2xl text-bliss-ink">{formatCents(totalActualCents)}</div>
          </div>
        </div>

        {/* Tips */}
        {tips?.length > 0 && (
          <div className="warm-card p-4 mb-6 border-l-4 border-bliss-gold">
            {tips.map((tip: string) => (
              <div key={tip} className="flex items-start gap-2">
                <Info className="w-4 h-4 text-bliss-gold mt-0.5 shrink-0" />
                <p className="text-sm text-bliss-ink-light">{tip}</p>
              </div>
            ))}
          </div>
        )}

        {/* Estimate ranges */}
        {estimateRanges?.length > 0 && items.length === 0 && (
          <div className="warm-card p-5 mb-6">
            <h2 className="font-serif text-lg text-bliss-ink mb-3">Typical ranges for your wedding</h2>
            <div className="space-y-2">
              {estimateRanges.map((r: any) => (
                <div key={r.category} className="flex items-center justify-between py-1.5 border-b border-bliss-border last:border-0">
                  <span className="text-sm text-bliss-ink">{r.label}</span>
                  <span className="text-sm text-bliss-ink-light">{formatCentsRange(r.lowCents, r.highCents)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Items by category */}
        {CATEGORIES.filter((cat) => items.some((i: BudgetItem) => i.category === cat)).map((cat) => {
          const catItems = items.filter((i: BudgetItem) => i.category === cat)
          const catEstimate = catItems.reduce((s: number, i: BudgetItem) => s + i.estimatedCents, 0)
          const catActual = catItems.reduce((s: number, i: BudgetItem) => s + i.actualCents, 0)
          const range = estimateRanges?.find((r: any) => r.category === cat)

          return (
            <div key={cat} className="warm-card p-5 mb-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-bliss-ink">{CATEGORY_LABELS[cat]}</h3>
                <div className="text-right">
                  <div className="text-sm font-medium text-bliss-ink">{formatCents(catEstimate)}</div>
                  {range && (
                    <div className="text-xs text-bliss-muted">
                      Typical: {formatCentsRange(range.lowCents, range.highCents)}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {catItems.map((item: BudgetItem) => (
                  <div key={item.id} className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-bliss-ink truncate">{item.label}</p>
                      {item.vendorName && <p className="text-xs text-bliss-muted">{item.vendorName}</p>}
                      {item.isDiy && <span className="text-xs text-bliss-sage-dark font-medium">DIY</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm text-bliss-ink-light">{formatCents(item.estimatedCents)}</span>
                      {item.actualCents > 0 && (
                        <span className="text-xs text-bliss-sage-dark font-medium">paid</span>
                      )}
                      {item.actualCents === 0 && (
                        <button
                          onClick={() => handleMarkPaid(item, item.estimatedCents)}
                          className="text-xs text-bliss-rose-dark hover:underline"
                        >
                          Mark paid
                        </button>
                      )}
                      <button onClick={() => handleDelete(item.id)} className="text-bliss-muted hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {items.length === 0 && (
          <div className="warm-card p-8 text-center">
            <DollarSign className="w-10 h-10 text-bliss-border mx-auto mb-3" />
            <p className="font-medium text-bliss-ink mb-1">No budget items yet</p>
            <p className="text-sm text-bliss-ink-light mb-4">Add your first item to start tracking.</p>
            <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">
              Add your first item
            </button>
          </div>
        )}

        {/* Add item modal */}
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-bliss-ink/40 backdrop-blur-sm p-4">
            <div className="warm-card-lg w-full max-w-md p-6 shadow-warm-lg">
              <h3 className="font-serif text-xl text-bliss-ink mb-4">Add budget item</h3>
              <div className="space-y-3">
                <select
                  className="input-warm"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as BudgetCategory }))}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
                <input
                  className="input-warm"
                  placeholder="Label (e.g. Main Street Venue)"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                />
                <input
                  className="input-warm"
                  type="number"
                  placeholder="Estimated amount ($)"
                  value={form.estimatedCents || ''}
                  onChange={(e) => setForm((f) => ({ ...f, estimatedCents: parseFloat(e.target.value) || 0 }))}
                />
                <input
                  className="input-warm"
                  placeholder="Vendor name (optional)"
                  value={form.vendorName}
                  onChange={(e) => setForm((f) => ({ ...f, vendorName: e.target.value }))}
                />
                <label className="flex items-center gap-2 text-sm text-bliss-ink-light cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isDiy}
                    onChange={(e) => setForm((f) => ({ ...f, isDiy: e.target.checked }))}
                    className="rounded"
                  />
                  This is a DIY item
                </label>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleAdd} disabled={!form.label} className="btn-primary flex-1 disabled:opacity-40">Add item</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
