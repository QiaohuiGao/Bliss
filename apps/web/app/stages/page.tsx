import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { StagesClient } from '@/components/stages/StagesClient'

export default async function StagesPage() {
  const { userId, getToken } = await auth()
  if (!userId) redirect('/sign-in')
  const token = await getToken()
  return <StagesClient token={token!} />
}
