'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

export function AdminHeader() {
  const pathname = usePathname()
  const t = useTranslations('admin.dashboard')
  const tNav = useTranslations('nav')

  const tabs = [
    { label: t('shows'), href: '/admin' },
    { label: 'Shorts', href: '/admin/shorts' },
    { label: 'Reviews', href: '/admin/reviews' },
    { label: t('archive'), href: '/admin/archive' },
    { label: t('settings'), href: '/admin/settings' },
    { label: t('audit'), href: '/admin/audit' },
  ]

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[rgba(5,7,12,0.76)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 rounded-[4px] border border-[var(--line)] bg-[var(--bg-2)] px-4 py-2.5 text-[rgba(241,246,252,0.3)] md:flex">
            <Image
              src="/brand/Clickit_final_logo.svg"
              alt="Clickit Story Admin"
              width={90}
              height={24}
              className="h-6 w-auto"
            />
          </div>
        </div>

        <nav className="flex items-center gap-2 rounded-[4px] border border-[var(--line)] bg-[var(--bg-2)] p-1.5">
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
                  'rounded-[4px] px-4 py-2 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-white text-black'
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
          className="hidden rounded-[4px] border border-[var(--line)] bg-[var(--bg-2)] px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
        >
          {tNav('profile')}
        </Link>
      </div>
    </header>
  )
}
