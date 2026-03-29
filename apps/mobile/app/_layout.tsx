import '../global.css'
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { ClerkProvider, useAuth } from '@clerk/clerk-expo'
import * as SecureStore from 'expo-secure-store'
import * as SplashScreen from 'expo-splash-screen'
import { registerForPushNotifications } from '@/lib/notifications'

SplashScreen.preventAutoHideAsync()

const tokenCache = {
  async getToken(key: string) {
    return SecureStore.getItemAsync(key)
  },
  async saveToken(key: string, value: string) {
    return SecureStore.setItemAsync(key, value)
  },
}

function RootLayoutNav() {
  const { isLoaded } = useAuth()

  useEffect(() => {
    if (isLoaded) SplashScreen.hideAsync()
  }, [isLoaded])

  useEffect(() => {
    registerForPushNotifications()
  }, [])

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="check-in" options={{ presentation: 'modal' }} />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={process.env['EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY']!}
      tokenCache={tokenCache}
    >
      <RootLayoutNav />
    </ClerkProvider>
  )
}
