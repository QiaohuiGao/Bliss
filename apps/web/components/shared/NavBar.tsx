'use client'

import { UserButton } from '@clerk/nextjs'
import { useTranslations } from 'next-intl'
import { Home, Map, Heart } from 'lucide-react'
import { Link, usePathname } from '@/i18n/routing'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', labelKey: 'dashboard', icon: Home },
  { href: '/board', labelKey: 'board', icon: Map },
] as const

export function NavBar() {
  const pathname = usePathname()
  const t = useTranslations('common.nav')

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-bliss-border">
      <div className="max-w-3xl mx-auto px-4 flex items-center justify-between h-14">
        <Link
          href="/dashboard"
          className="font-serif text-xl text-bliss-ink flex items-center gap-1.5"
        >
          <Heart className="w-4 h-4 text-bliss-rose-dark" />
          Bliss
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-warm text-sm font-medium transition-colors',
                isActive(href)
                  ? 'bg-bliss-petal text-bliss-rose-dark'
                  : 'text-bliss-ink-light hover:text-bliss-ink hover:bg-bliss-cream',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t(labelKey)}
            </Link>
          ))}
        </nav>

        <UserButton afterSignOutUrl="/" />
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-bliss-border z-50 flex">
        {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors',
              isActive(href) ? 'text-bliss-rose-dark' : 'text-bliss-muted',
            )}
          >
            <Icon className="w-5 h-5" />
            {t(labelKey)}
          </Link>
        ))}
      </div>
    </header>
  )
}
