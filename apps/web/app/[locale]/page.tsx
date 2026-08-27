import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { LandingExperience } from '@/components/landing/LandingExperience'

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const { userId } = await auth()
  if (userId) redirect('/dashboard')

  return <LandingExperience />
}
