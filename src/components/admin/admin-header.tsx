'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
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
        {/* Top bar: back link + branding + view site */}
        <div className="flex items-center justify-between py-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Back to Site</span>
          </Link>

          <Image
            src="/brand/Clickit_final_logo.svg"
            alt="Clickit Story Admin"
            width={100}
            height={28}
            className="h-7 w-auto"
          />

          <Link
            href="/profile"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Account
          </Link>
        </div>

        {/* Tab navigation */}
        <nav className="flex gap-6 -mb-px">
          {tabs.map((tab) => {
            const isActive =
              tab.href === '/admin'
                ? pathname === '/admin' || pathname.startsWith('/admin/shows')
                : pathname.startsWith(tab.href)

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'relative py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--primary)]" />
                )}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
