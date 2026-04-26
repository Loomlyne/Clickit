'use client'

import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Menu } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[rgba(5,7,12,0.76)] backdrop-blur-[18px]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:gap-4 md:px-8 md:py-4">
        <div className="flex items-center gap-3">
          <Link href="/browse" aria-label="Go to browse">
            <Image
              src="/brand/Clickit_final_logo.svg"
              alt="Clickit Story Admin"
              width={90}
              height={24}
              className="h-5 w-auto md:h-6"
            />
          </Link>
        </div>

        <nav className="hidden items-center gap-2 rounded-[4px] border border-[var(--line)] bg-[var(--bg-2)] p-1.5 md:flex">
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

        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex size-11 items-center justify-center rounded-[4px] border border-[var(--line)] bg-[var(--bg-2)] text-muted-foreground transition-colors hover:text-foreground md:hidden"
            aria-label="Open admin navigation"
          >
            <Menu className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={10}
            className="w-[min(18rem,calc(100vw-2rem))]"
          >
            {tabs.map((tab) => {
              const isActive =
                tab.href === '/admin'
                  ? pathname === '/admin' || pathname.startsWith('/admin/shows')
                  : pathname === tab.href || pathname.startsWith(tab.href + '/')

              return (
                <DropdownMenuItem
                  key={tab.href}
                  asChild
                  className={cn(
                    'min-h-11',
                    isActive && 'bg-white text-black focus:bg-white focus:text-black'
                  )}
                >
                  <Link href={tab.href}>{tab.label}</Link>
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="min-h-11">
              <Link href="/profile">{tNav('profile')}</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
