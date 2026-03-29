import { useEffect } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { useSSO } from '@clerk/clerk-expo'

export default function WelcomeScreen() {
  const { isSignedIn, isLoaded } = useAuth()
  const router = useRouter()
  const { startSSOFlow } = useSSO()

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace('/(tabs)')
    }
  }, [isLoaded, isSignedIn])

  const handleGoogleSignIn = async () => {
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: 'bliss://oauth-callback',
      })
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId })
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <View className="flex-1 bg-bliss-cream items-center justify-center px-8">
      <Text className="text-4xl font-serif text-bliss-ink mb-2">Bliss</Text>
      <Text className="text-bliss-muted text-center text-base mb-12 leading-relaxed">
        Wedding planning that feels{'\n'}calm and supported.
      </Text>

      <TouchableOpacity
        className="bg-bliss-rose-dark px-8 py-4 rounded-2xl w-full items-center mb-3 shadow-sm"
        onPress={handleGoogleSignIn}
      >
        <Text className="text-white font-semibold text-base">Continue with Google</Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="border border-bliss-border bg-white px-8 py-4 rounded-2xl w-full items-center"
        onPress={() => router.push('/onboarding')}
      >
        <Text className="text-bliss-ink font-medium text-base">Start planning</Text>
      </TouchableOpacity>

      <Text className="text-bliss-muted text-xs text-center mt-8 leading-relaxed">
        Free to start. Never overwhelming.{'\n'}Always one clear next step.
      </Text>
    </View>
  )
}
