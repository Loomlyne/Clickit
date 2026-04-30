'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Menu } from 'lucide-react'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
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
  const router = useRouter()
  const t = useTranslations('admin.dashboard')
  const tNav = useTranslations('nav')
  const prefetched = useRef(new Set<string>())

  const tabs = [
    { label: t('shows'), href: '/admin' },
    { label: 'Categories', href: '/admin/categories' },
    { label: 'Shorts', href: '/admin/shorts' },
    { label: 'Reviews', href: '/admin/reviews' },
    { label: 'Inbox', href: '/admin/inbox' },
    { label: t('archive'), href: '/admin/archive' },
    { label: t('settings'), href: '/admin/settings' },
    { label: t('audit'), href: '/admin/audit' },
  ]

  function prefetchRoute(href: string) {
    if (prefetched.current.has(href)) return
    prefetched.current.add(href)
    router.prefetch(href)
  }

  useEffect(() => {
    const routes = [...tabs.map((tab) => tab.href), '/profile']

    const warmRoutes = () => {
      for (const route of routes) {
        if (route !== pathname) {
          prefetchRoute(route)
        }
      }
    }

    if (typeof window === 'undefined') return

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(warmRoutes, { timeout: 1200 })
      return () => window.cancelIdleCallback(idleId)
    }

    const timeoutId = window.setTimeout(warmRoutes, 250)
    return () => window.clearTimeout(timeoutId)
  }, [pathname, tabs, router])

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[rgba(10,10,10,0.88)] backdrop-blur-[18px]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:gap-4 md:px-8 md:py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/browse"
            aria-label="Go to browse"
            className="flex min-h-11 items-center"
          >
            <Image
              src="/brand/Clickit_final_logo.svg"
              alt="Clickit"
              width={136}
              height={56}
              className="h-7 w-auto"
              priority
            />
          </Link>
        </div>

        <nav className="hidden items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] p-1.5 md:flex">
          {tabs.map((tab) => {
            const isActive =
              tab.href === '/admin'
                ? pathname === '/admin' || pathname.startsWith('/admin/shows')
                : pathname === tab.href || pathname.startsWith(tab.href + '/')

            return (
              <Link
                key={tab.href}
                href={tab.href}
                onMouseEnter={() => prefetchRoute(tab.href)}
                onTouchStart={() => prefetchRoute(tab.href)}
                prefetch
                className={cn(
                  'rounded-[8px] px-4 py-2 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
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
            className="inline-flex size-11 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03] text-muted-foreground transition-colors hover:text-foreground md:hidden"
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
                    isActive && 'bg-[var(--primary)] text-[var(--primary-foreground)] focus:bg-[var(--primary)] focus:text-[var(--primary-foreground)]'
                  )}
                >
                  <Link
                    href={tab.href}
                    onMouseEnter={() => prefetchRoute(tab.href)}
                    onTouchStart={() => prefetchRoute(tab.href)}
                    prefetch
                  >
                    {tab.label}
                  </Link>
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="min-h-11">
              <Link
                href="/profile"
                onMouseEnter={() => prefetchRoute('/profile')}
                onTouchStart={() => prefetchRoute('/profile')}
                prefetch
              >
                {tNav('profile')}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Link
          href="/profile"
          onMouseEnter={() => prefetchRoute('/profile')}
          onTouchStart={() => prefetchRoute('/profile')}
          prefetch
          className="hidden rounded-lg border border-white/8 bg-white/[0.03] px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
        >
          {tNav('profile')}
        </Link>
      </div>
    </header>
  )
}
