import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Heart, CheckCircle, Users } from 'lucide-react'
import { Link } from '@/i18n/routing'
import { QUEST_COUNT } from '@/lib/constants'

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const { userId } = await auth()
  if (userId) redirect('/dashboard')

  const t = await getTranslations('common')

  const features = [
    { icon: Heart, key: 'dreamFirst' as const, values: {} },
    { icon: CheckCircle, key: 'oneStep' as const, values: { count: QUEST_COUNT } },
    { icon: Users, key: 'multicultural' as const, values: {} },
  ]

  return (
    <div className="min-h-screen bg-bliss-cream">
      <nav className="flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
        <span className="font-serif text-2xl text-bliss-ink">{t('app.name')}</span>
        <div className="flex items-center gap-4">
          <Link href="/sign-in" className="btn-ghost text-sm">
            {t('nav.signIn')}
          </Link>
          <Link href="/sign-up" className="btn-primary text-sm py-2">
            {t('nav.signUp')}
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-8 pt-20 pb-32 text-center">
        <p className="text-bliss-muted text-sm font-medium tracking-widest uppercase mb-6">
          {t('marketing.eyebrow')}
        </p>
        <h1 className="text-5xl md:text-6xl text-bliss-ink leading-tight mb-6">
          {t('marketing.headlineTop')}
          <br />
          <span className="text-bliss-rose-dark">{t('marketing.headlineBottom')}</span>
        </h1>
        <p className="text-xl text-bliss-ink-light max-w-2xl mx-auto mb-10 leading-relaxed">
          {t('marketing.subhead')}
        </p>
        <Link
          href="/sign-up"
          className="btn-primary text-base px-10 py-4 inline-block"
        >
          {t('action.getStarted')}
        </Link>
        <p className="text-bliss-muted text-sm mt-4">{t('marketing.ctaNote')}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 text-left">
          {features.map(({ icon: Icon, key, values }) => (
            <div key={key} className="warm-card p-6">
              <div className="w-10 h-10 rounded-warm bg-bliss-petal flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-bliss-rose-dark" />
              </div>
              <h3 className="font-serif text-lg text-bliss-ink mb-2">
                {t(`marketing.feature.${key}.title`, values)}
              </h3>
              <p className="text-bliss-ink-light text-sm leading-relaxed">
                {t(`marketing.feature.${key}.body`)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-20 warm-card p-8">
          <p className="font-serif text-xl text-bliss-ink mb-2">
            &ldquo;{t('marketing.quote.text')}&rdquo;
          </p>
          <p className="text-bliss-muted text-sm">
            {t('marketing.quote.attribution')}
          </p>
        </div>
      </main>
    </div>
  )
}
