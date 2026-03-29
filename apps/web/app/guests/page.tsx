import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { GuestsClient } from '@/components/guests/GuestsClient'

export default async function GuestsPage() {
  const { userId, getToken } = await auth()
  if (!userId) redirect('/sign-in')
  const token = await getToken()
  return <GuestsClient token={token!} />
}
