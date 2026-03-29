'use client'

import { X } from 'lucide-react'

export function CelebrationModal({
  celebration,
  onDismiss,
}: {
  celebration: any
  onDismiss: () => void
}) {
  const content = celebration.content
  if (!content) return null

  if (content.type === 'toast') {
    return (
      <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
        <div className="warm-card px-5 py-3 flex items-center gap-3 shadow-warm-lg">
          <span className="text-lg">{content.emoji ?? '✨'}</span>
          <p className="text-sm font-medium text-bliss-ink">{content.message}</p>
          <button onClick={onDismiss} className="ml-2 text-bliss-muted hover:text-bliss-ink">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bliss-ink/40 backdrop-blur-sm p-4">
      <div className="warm-card-lg max-w-md w-full p-8 text-center shadow-warm-lg animate-in zoom-in-95">
        <div className="text-5xl mb-5">{content.emoji ?? '💍'}</div>
        <h2 className="font-serif text-2xl text-bliss-ink mb-3">{content.headline}</h2>
        <p className="text-bliss-ink-light leading-relaxed mb-8">{content.body}</p>
        <button onClick={onDismiss} className="btn-primary w-full">
          Keep going →
        </button>
      </div>
    </div>
  )
}
