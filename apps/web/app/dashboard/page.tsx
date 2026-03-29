import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

export default async function DashboardPage() {
  const { userId, getToken } = await auth()
  if (!userId) redirect('/sign-in')

  const token = await getToken()

  return <DashboardClient token={token!} />
}
