'use client'

import { useAuth } from '@clerk/nextjs'

export function useToken() {
  const { getToken } = useAuth()

  return async (): Promise<string> => {
    try {
      const token = await getToken()
      return token ?? 'dev'
    } catch {
      return 'dev'
    }
  }
}
