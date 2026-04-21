'use client'

import Link from 'next/link'
import { usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

export const NAV_LINKS = [
  { label: 'Browse', href: '/browse' },
  { label: 'Coming Soon', href: '/coming-soon' },
  { label: 'Support', href: '/support' },
]

export function NavLinks() {
  const pathname = usePathname()

  return (
    <nav aria-label="Site navigation">
      <div className="flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.02] p-1.5">
        {NAV_LINKS.map(({ label, href }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'rounded-full px-3 py-2 whitespace-nowrap text-sm font-medium tracking-[-0.01em] transition-colors',
                isActive
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/56 hover:text-white'
              )}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
