'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback } from 'react'

export function useToken() {
  const { getToken } = useAuth()

  return useCallback(async (): Promise<string> => {
    const token = await getToken()
    if (token) return token
    if (process.env.NODE_ENV === 'development') return 'dev'
    throw new Error('Authentication required')
  }, [getToken])
}
