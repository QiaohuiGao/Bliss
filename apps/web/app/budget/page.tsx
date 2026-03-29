import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { BudgetClient } from '@/components/budget/BudgetClient'

export default async function BudgetPage() {
  const { userId, getToken } = await auth()
  if (!userId) redirect('/sign-in')
  const token = await getToken()
  return <BudgetClient token={token!} />
}
