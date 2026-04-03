'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const tabs = [
  { label: 'Shows', href: '/admin' },
  { label: 'Archive', href: '/admin/archive' },
]

export function AdminHeader() {
  const pathname = usePathname()

  return (
    <header className="bg-[var(--card)] border-b border-border">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        {/* Title row */}
        <div className="pt-4 pb-3">
          <span className="text-[20px] font-semibold text-foreground">
            CIT Admin
          </span>
        </div>

        {/* Tab navigation */}
        <nav className="flex gap-6 border-t border-border -mb-px">
          {tabs.map((tab) => {
            const isActive =
              tab.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(tab.href)

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'relative py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--primary)]" />
                )}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
