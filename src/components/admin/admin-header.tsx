'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const tabs = [
  { label: 'Shows', href: '/admin' },
  { label: 'Archive', href: '/admin/archive' },
  { label: 'Settings', href: '/admin/settings' },
]

export function AdminHeader() {
  const pathname = usePathname()

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[rgba(5,7,12,0.76)] backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[rgba(241,246,252,0.3)] md:flex">
            <Image
              src="/brand/Clickit_final_logo.svg"
              alt="Clickit Story Admin"
              width={90}
              height={24}
              className="h-6 w-auto"
            />
          </div>
        </div>

        <nav className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] p-1.5">
          {tabs.map((tab) => {
            const isActive =
              tab.href === '/admin'
                ? pathname === '/admin' || pathname.startsWith('/admin/shows')
                : pathname === tab.href || pathname.startsWith(tab.href + '/')

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.18)]'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>

        <Link
          href="/profile"
          className="hidden rounded-full border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
        >
          Account
        </Link>
      </div>
    </header>
  )
}
