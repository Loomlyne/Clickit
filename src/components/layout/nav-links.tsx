'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { label: 'Series', href: '/series' },
  { label: 'Coming Soon', href: '/coming-soon' },
  { label: 'Schedule', href: '/schedule' },
]

export function NavLinks() {
  const pathname = usePathname()

  return (
    <nav aria-label="Site navigation">
      <div className="flex items-center gap-8">
        {NAV_LINKS.map(({ label, href }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative whitespace-nowrap text-sm font-medium tracking-wide transition-colors pb-0.5',
                isActive
                  ? 'text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-[#5B7FFF]'
                  : 'text-white/60 hover:text-white'
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
