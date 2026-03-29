import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Heart, CheckCircle, Calendar, Users } from 'lucide-react'

export default async function HomePage() {
  const { userId } = await auth()
  if (userId) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-bliss-cream">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
        <span className="font-serif text-2xl text-bliss-ink">Bliss</span>
        <div className="flex items-center gap-4">
          <Link href="/sign-in" className="btn-ghost text-sm">Sign in</Link>
          <Link href="/sign-up" className="btn-primary text-sm py-2">Start planning</Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-4xl mx-auto px-8 pt-20 pb-32 text-center">
        <p className="text-bliss-muted text-sm font-medium tracking-widest uppercase mb-6">
          Wedding planning, reimagined
        </p>
        <h1 className="text-5xl md:text-6xl text-bliss-ink leading-tight mb-6">
          Never overwhelming.<br />
          <span className="text-bliss-rose-dark">Always one clear next step.</span>
        </h1>
        <p className="text-xl text-bliss-ink-light max-w-2xl mx-auto mb-10 leading-relaxed">
          Bliss guides you through every stage of planning — from first vision to wedding day —
          like a calm, wise friend who has done this before.
        </p>
        <Link href="/sign-up" className="btn-primary text-base px-10 py-4 inline-block">
          Start your wedding plan →
        </Link>
        <p className="text-bliss-muted text-sm mt-4">Free to start. No credit card required.</p>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 text-left">
          {[
            {
              icon: Heart,
              title: 'Dream first, budget later',
              body: 'We start with your vision. Budget comes after — framed as how to make it happen, not a ceiling.',
            },
            {
              icon: CheckCircle,
              title: '7 stages, one step at a time',
              body: 'Each stage unlocks when you\'re ready. You always know exactly what to do next.',
            },
            {
              icon: Calendar,
              title: 'Emotional support built in',
              body: 'Stress check-ins and celebration moments — because planning a wedding is emotional, not just logistical.',
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="warm-card p-6">
              <div className="w-10 h-10 rounded-warm bg-bliss-petal flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-bliss-rose-dark" />
              </div>
              <h3 className="font-serif text-lg text-bliss-ink mb-2">{title}</h3>
              <p className="text-bliss-ink-light text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        {/* Social proof */}
        <div className="mt-20 warm-card p-8">
          <p className="font-serif text-xl text-bliss-ink mb-2">
            "Bliss feels like a friend who's already been through it."
          </p>
          <p className="text-bliss-muted text-sm">— Alex & Jordan, married June 2025</p>
        </div>
      </main>
    </div>
  )
}
