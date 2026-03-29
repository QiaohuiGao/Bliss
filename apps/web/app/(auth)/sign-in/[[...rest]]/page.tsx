import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-bliss-cream flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <h1 className="font-serif text-3xl text-bliss-ink mb-2">Welcome back</h1>
        <p className="text-bliss-ink-light">Pick up right where you left off.</p>
      </div>
      <SignIn
        routing="hash"
        appearance={{
          elements: {
            rootBox: 'w-full max-w-md',
            card: 'warm-card-lg shadow-warm-lg',
            headerTitle: 'hidden',
            headerSubtitle: 'hidden',
            socialButtonsBlockButton: 'btn-secondary w-full mb-2',
            formButtonPrimary: 'btn-primary w-full',
            formFieldInput: 'input-warm',
          },
        }}
      />
    </div>
  )
}
