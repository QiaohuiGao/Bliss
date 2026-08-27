'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback } from 'react'

export function useToken() {
  const { getToken } = useAuth()

  return useCallback(async (): Promise<string> => {
    try {
      const token = await getToken()
      return token ?? 'dev'
    } catch {
      return 'dev'
    }
  }, [getToken])
}
