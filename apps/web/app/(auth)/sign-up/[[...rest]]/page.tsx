import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-bliss-cream flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <h1 className="font-serif text-3xl text-bliss-ink mb-2">Start your wedding plan</h1>
        <p className="text-bliss-ink-light">Takes about 3 minutes. No credit card needed.</p>
      </div>
      <SignUp
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
