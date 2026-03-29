'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { cn } from '@/lib/utils'
import { Home, List, DollarSign, Users, Heart } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/stages', label: 'Stages', icon: List },
  { href: '/budget', label: 'Budget', icon: DollarSign },
  { href: '/guests', label: 'Guests', icon: Users },
]

export function NavBar({ weddingId }: { weddingId: string }) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-bliss-border">
      <div className="max-w-3xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/dashboard" className="font-serif text-xl text-bliss-ink flex items-center gap-1.5">
          <Heart className="w-4 h-4 text-bliss-rose-dark" />
          Bliss
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-warm text-sm font-medium transition-colors',
                pathname === href || pathname.startsWith(href + '/')
                  ? 'bg-bliss-petal text-bliss-rose-dark'
                  : 'text-bliss-ink-light hover:text-bliss-ink hover:bg-bliss-cream'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          ))}
        </nav>

        <UserButton afterSignOutUrl="/" />
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-bliss-border z-50 flex">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors',
              pathname === href || pathname.startsWith(href + '/')
                ? 'text-bliss-rose-dark'
                : 'text-bliss-muted'
            )}
          >
            <Icon className="w-5 h-5" />
            {label}
          </Link>
        ))}
      </div>
    </header>
  )
}
