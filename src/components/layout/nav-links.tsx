'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { label: 'Browse', href: '/series' },
  { label: 'Coming Soon', href: '/coming-soon' },
  { label: 'Support', href: '/support' },
]

export function NavLinks() {
  const pathname = usePathname()

  return (
    <nav aria-label="Site navigation">
      <div className="flex items-center gap-2">
        {NAV_LINKS.map(({ label, href }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'whitespace-nowrap text-sm transition-colors',
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
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
