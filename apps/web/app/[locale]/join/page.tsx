'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from '@/i18n/routing'
import { api } from '@/lib/api'
import { Heart } from 'lucide-react'

export default function JoinPage() {
  const t = useTranslations('common')
  const tErrors = useTranslations('errors')
  const searchParams = useSearchParams()
  const router = useRouter()
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const [status, setStatus] = useState<'loading' | 'joining' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  const inviteToken = searchParams.get('token')

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.push(`/sign-up?redirect_url=/join?token=${inviteToken}`)
      return
    }
    if (!inviteToken) {
      setError(tErrors('wedding.inviteInvalid'))
      setStatus('error')
      return
    }
    joinWedding()
  }, [isLoaded, isSignedIn])

  async function joinWedding() {
    setStatus('joining')
    try {
      const token = await getToken()
      await api.joinWedding(inviteToken!, token!)
      setStatus('success')
      setTimeout(() => router.push('/dashboard'), 2000)
    } catch (e: any) {
      setError(tErrors('generic'))
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-bliss-cream flex items-center justify-center px-4">
      <div className="warm-card-lg max-w-sm w-full p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-bliss-petal flex items-center justify-center mx-auto mb-4">
          <Heart className="w-6 h-6 text-bliss-rose-dark" />
        </div>

        {status === 'loading' || status === 'joining' ? (
          <>
            <h2 className="font-serif text-2xl text-bliss-ink mb-2">{t('join.title')}</h2>
            <p className="text-bliss-ink-light text-sm">{t('state.loading')}</p>
          </>
        ) : status === 'success' ? (
          <>
            <h2 className="font-serif text-2xl text-bliss-ink mb-2">{t('join.success')}</h2>
            <p className="text-bliss-ink-light text-sm">{t('join.redirecting')}</p>
          </>
        ) : (
          <>
            <h2 className="font-serif text-2xl text-bliss-ink mb-2">{tErrors('generic')}</h2>
            <p className="text-bliss-ink-light text-sm mb-4">{error}</p>
            <button onClick={() => router.push('/dashboard')} className="btn-secondary w-full">
              {t('nav.dashboard')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
