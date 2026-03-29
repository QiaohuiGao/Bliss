import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)
}

export function formatCentsRange(low: number, high: number): string {
  return `${formatCents(low)} – ${formatCents(high)}`
}

export function daysUntilText(days: number | null): string {
  if (days === null) return 'Date not set'
  if (days < 0) return 'Wedding has passed'
  if (days === 0) return 'Today is the day!'
  if (days === 1) return '1 day to go'
  if (days < 30) return `${days} days to go`
  const months = Math.floor(days / 30)
  return months === 1 ? '1 month to go' : `${months} months to go`
}

export const VIBE_OPTIONS = [
  { value: 'romantic', label: 'Romantic & dreamy' },
  { value: 'outdoor', label: 'Outdoor & natural' },
  { value: 'intimate', label: 'Intimate & personal' },
  { value: 'classic', label: 'Classic & elegant' },
  { value: 'modern', label: 'Modern & minimal' },
  { value: 'bohemian', label: 'Bohemian & free-spirited' },
  { value: 'rustic', label: 'Rustic & earthy' },
  { value: 'festive', label: 'Festive & fun' },
  { value: 'cultural', label: 'Cultural & traditional' },
  { value: 'spiritual', label: 'Spiritual & meaningful' },
]

export const PRIORITY_OPTIONS = [
  { value: 'photography', label: 'Beautiful photos' },
  { value: 'food', label: 'Great food and drinks' },
  { value: 'music', label: 'Dancing and music' },
  { value: 'ceremony', label: 'A meaningful ceremony' },
  { value: 'florals', label: 'Stunning florals' },
  { value: 'venue', label: 'An incredible venue' },
  { value: 'attire', label: 'Dream attire' },
  { value: 'guests', label: 'Every guest feels welcome' },
  { value: 'relaxed', label: 'A relaxed, stress-free day' },
  { value: 'personal', label: 'Personal DIY touches' },
]

export const STAGE_COLORS: Record<number, string> = {
  1: 'bg-bliss-sage/20 text-bliss-sage-dark border-bliss-sage/30',
  2: 'bg-bliss-rose/20 text-bliss-rose-dark border-bliss-rose/30',
  3: 'bg-bliss-gold/20 text-bliss-gold border-bliss-gold/30',
  4: 'bg-blue-50 text-blue-700 border-blue-200',
  5: 'bg-purple-50 text-purple-700 border-purple-200',
  6: 'bg-orange-50 text-orange-700 border-orange-200',
  7: 'bg-bliss-cream text-bliss-ink-light border-bliss-border',
}
