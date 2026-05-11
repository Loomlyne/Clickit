'use client'

import { useEffect, useMemo, useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Menu, User } from 'lucide-react'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type AdminNavItem = { label: string; href: string }

type AdminNavGroup = { id: string; label: string; items: AdminNavItem[] }

function isItemActive(item: AdminNavItem, pathname: string) {
  if (item.href === '/admin') {
    return pathname === '/admin' || pathname.startsWith('/admin/shows')
  }
  return pathname === item.href || pathname.startsWith(item.href + '/')
}

export function AdminHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('admin.dashboard')
  const tNav = useTranslations('nav')
  const prefetched = useRef(new Set<string>())

  const navGroups = useMemo<AdminNavGroup[]>(
    () => [
      {
        id: 'content',
        label: t('navContent'),
        items: [
          { label: t('shows'), href: '/admin' },
          { label: t('categories'), href: '/admin/categories' },
          { label: t('shorts'), href: '/admin/shorts' },
        ],
      },
      {
        id: 'engagement',
        label: t('navEngagement'),
        items: [
          { label: t('reviews'), href: '/admin/reviews' },
          { label: t('inbox'), href: '/admin/inbox' },
        ],
      },
      {
        id: 'operations',
        label: t('navOperations'),
        items: [
          { label: t('archive'), href: '/admin/archive' },
          { label: t('settings'), href: '/admin/settings' },
          { label: t('audit'), href: '/admin/audit' },
        ],
      },
    ],
    [t]
  )

  const allHrefs = useMemo(
    () => [...navGroups.flatMap((g) => g.items.map((i) => i.href)), '/profile'],
    [navGroups]
  )

  function prefetchRoute(href: string) {
    if (prefetched.current.has(href)) return
    prefetched.current.add(href)
    router.prefetch(href)
  }

  useEffect(() => {
    const warmRoutes = () => {
      for (const route of allHrefs) {
        if (route !== pathname) prefetchRoute(route)
      }
    }

    if (typeof window === 'undefined') return

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(warmRoutes, { timeout: 1200 })
      return () => window.cancelIdleCallback(idleId)
    }

    const timeoutId = setTimeout(warmRoutes, 250)
    return () => clearTimeout(timeoutId)
  }, [pathname, allHrefs, router])

  function renderNavLink(item: AdminNavItem, compact?: boolean) {
    const active = isItemActive(item, pathname)
    return (
      <Link
        key={item.href}
        href={item.href}
        onMouseEnter={() => prefetchRoute(item.href)}
        onTouchStart={() => prefetchRoute(item.href)}
        prefetch
        className={cn(
          'shrink-0 rounded-full font-medium transition-all',
          compact
            ? 'px-2.5 py-1.5 text-[11px] leading-tight sm:px-3 sm:py-2 sm:text-xs lg:px-3.5 lg:text-[13px]'
            : 'px-3 py-2 text-sm',
          active
            ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm'
            : 'text-muted-foreground hover:bg-white/[0.06] hover:text-foreground'
        )}
      >
        {item.label}
      </Link>
    )
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[rgba(10,10,10,0.88)] backdrop-blur-[18px] supports-[backdrop-filter]:bg-[rgba(10,10,10,0.72)]">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 md:gap-4 md:px-6 md:py-3.5 lg:px-8 lg:py-4">
        <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/watch"
            aria-label="Go to watch"
            className="flex min-h-10 min-w-0 items-center sm:min-h-11"
          >
            <Image
              src="/brand/Clickit_final_logo.svg"
              alt="Clickit"
              width={136}
              height={56}
              className="h-6 w-auto sm:h-7"
              priority
            />
          </Link>
        </div>

        {/* Tablet / desktop: grouped clusters, wrap + scroll fallback for narrow widths */}
        <nav
          aria-label="Admin"
          className="hidden min-h-[44px] min-w-0 flex-1 md:flex md:items-center md:justify-center"
        >
          <div className="flex max-w-full flex-wrap items-center justify-center gap-2 overflow-x-auto overscroll-x-contain py-0.5 [scrollbar-width:thin] lg:flex-nowrap lg:gap-3 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15">
            {navGroups.map((group) => (
              <div
                key={group.id}
                className="inline-flex min-w-0 flex-wrap items-center gap-0.5 rounded-xl border border-white/8 bg-white/[0.03] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                {group.items.map((item) => renderNavLink(item, true))}
              </div>
            ))}
          </div>
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03] text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground md:hidden"
              aria-label={t('navMenu')}
            >
              <Menu className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={10}
              className="max-h-[min(28rem,calc(100dvh-5rem))] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto"
            >
              {navGroups.map((group, gi) => (
                <div key={group.id}>
                  {gi > 0 ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {group.label}
                  </DropdownMenuLabel>
                  {group.items.map((tab) => {
                    const active = isItemActive(tab, pathname)
                    return (
                      <DropdownMenuItem
                        key={tab.href}
                        asChild
                        className={cn(
                          'min-h-10',
                          active &&
                            'bg-[var(--primary)] text-[var(--primary-foreground)] focus:bg-[var(--primary)] focus:text-[var(--primary-foreground)]'
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
                </div>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="min-h-10">
                <Link
                  href="/profile"
                  onMouseEnter={() => prefetchRoute('/profile')}
                  onTouchStart={() => prefetchRoute('/profile')}
                  prefetch
                  className="flex items-center gap-2"
                >
                  <User className="size-4 opacity-70" />
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
            className="hidden min-h-10 items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 text-sm text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground md:inline-flex lg:px-4"
          >
            <User className="size-4 shrink-0 opacity-70" aria-hidden />
            <span className="max-w-[8rem] truncate lg:max-w-[10rem]">{tNav('profile')}</span>
          </Link>
        </div>
      </div>
    </header>
  )
}
