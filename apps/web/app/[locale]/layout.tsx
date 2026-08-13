import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ClerkProvider } from '@clerk/nextjs'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import { Nunito, Cormorant_Garamond } from 'next/font/google'
import { dirFor, isSupportedLocale, SUPPORTED_LOCALES } from '@bliss/i18n'
import '../globals.css'

// Latin-first pairing. The CJK fallback stack lives in globals.css so a future
// `zh` locale renders real glyphs instead of tofu.
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito' })
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-cormorant',
})

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map(locale => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'common.app' })

  return {
    title: `${t('name')} — Wedding planning, naturally`,
    description: t('description'),
    openGraph: {
      title: t('name'),
      description: t('tagline'),
      type: 'website',
      locale,
    },
    twitter: {
      card: 'summary',
      title: t('name'),
      description: t('tagline'),
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isSupportedLocale(locale)) notFound()

  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    <ClerkProvider>
      <html
        lang={locale}
        dir={dirFor(locale)}
        className={`${nunito.variable} ${cormorant.variable}`}
      >
        <body className="bg-bliss-surface text-bliss-ink antialiased font-sans">
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
