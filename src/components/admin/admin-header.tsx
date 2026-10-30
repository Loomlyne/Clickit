'use client'

import { useEffect, useMemo, useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import {
  Archive,
  Clapperboard,
  Inbox,
  LayoutGrid,
  Menu,
  MessageSquare,
  Palette,
  ScrollText,
  Settings,
  ShieldCheck,
  Tags,
  User,
  type LucideIcon,
} from 'lucide-react'
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

type AdminNavItem = { label: string; href: string; icon: LucideIcon }

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
  const tDs = useTranslations('admin.designSystem')
  const tNav = useTranslations('nav')
  const tAdmin = useTranslations('admin.common')
  const tAdmins = useTranslations('admin.admins')
  const prefetched = useRef(new Set<string>())

  const navGroups = useMemo<AdminNavGroup[]>(
    () => [
      {
        id: 'content',
        label: t('navContent'),
        items: [
          { label: t('shows'), href: '/admin', icon: LayoutGrid },
          { label: t('categories'), href: '/admin/categories', icon: Tags },
          { label: t('shorts'), href: '/admin/shorts', icon: Clapperboard },
        ],
      },
      {
        id: 'engagement',
        label: t('navEngagement'),
        items: [
          { label: t('reviews'), href: '/admin/reviews', icon: MessageSquare },
          { label: t('inbox'), href: '/admin/inbox', icon: Inbox },
        ],
      },
      {
        id: 'operations',
        label: t('navOperations'),
        items: [
          { label: t('archive'), href: '/admin/archive', icon: Archive },
          { label: t('settings'), href: '/admin/settings', icon: Settings },
          { label: tAdmins('nav'), href: '/admin/admins', icon: ShieldCheck },
          { label: t('audit'), href: '/admin/audit', icon: ScrollText },
          {
            label: tDs('navLabel'),
            href: '/admin/design-system',
            icon: Palette,
          },
        ],
      },
    ],
    [t, tDs, tAdmins]
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

  const sidebarLink = (item: AdminNavItem) => {
    const active = isItemActive(item, pathname)
    const Icon = item.icon
    return (
      <Link
        key={item.href}
        href={item.href}
        onMouseEnter={() => prefetchRoute(item.href)}
        onTouchStart={() => prefetchRoute(item.href)}
        prefetch
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex min-h-11 items-center gap-3 rounded-full px-3 text-[14px] font-medium transition-colors',
          active
            ? 'bg-[var(--uis-primary-soft)] text-[var(--primary)]'
            : 'text-[var(--text-dim)] hover:bg-[var(--bg-2)] hover:text-[var(--text)]'
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        {item.label}
      </Link>
    )
  }

  return (
    <>
      {/* Desktop: fixed sidebar (ui.config.json nav.back = sidebar) */}
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-60 flex-col border-e border-[var(--line)] bg-[var(--sidebar)] lg:flex">
        <div className="flex h-16 shrink-0 items-center px-5">
          <Link
            href="/watch"
            aria-label={tNav('watch')}
            className="flex min-h-11 items-center"
          >
            <Image
              src="/brand/cit-story.png"
              alt="Clickit"
              width={136}
              height={56}
              className="h-7 w-auto"
              priority
            />
          </Link>
        </div>
        <nav
          aria-label={tAdmin('adminNavAria')}
          className="flex-1 space-y-5 overflow-y-auto px-3 py-2"
        >
          {navGroups.map((group) => (
            <div key={group.id}>
              <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-[0.12em] text-[var(--text-mute)] uppercase">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>{sidebarLink(item)}</li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <Link
          href="/profile"
          onMouseEnter={() => prefetchRoute('/profile')}
          onTouchStart={() => prefetchRoute('/profile')}
          prefetch
          className="rounded-card m-3 flex min-h-11 items-center gap-3 border border-[var(--line)] bg-[var(--bg-1)] px-3 py-2 text-[13px] font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg-2)]"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">
            <User className="size-4" aria-hidden />
          </span>
          {tNav('profile')}
        </Link>
      </aside>

      {/* Phone / tablet: top bar with the same groups in a menu */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--line)] bg-[var(--bg-0)]/90 px-4 backdrop-blur lg:hidden">
        <Link
          href="/watch"
          aria-label={tNav('watch')}
          className="flex min-h-11 items-center"
        >
          <Image
            src="/brand/cit-story.png"
            alt="Clickit"
            width={136}
            height={56}
            className="h-6 w-auto"
            priority
          />
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex size-11 items-center justify-center rounded-full border border-[var(--line)] text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-2)]"
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
                <DropdownMenuLabel className="text-[11px] font-semibold tracking-[0.12em] text-[var(--text-mute)] uppercase">
                  {group.label}
                </DropdownMenuLabel>
                {group.items.map((tab) => {
                  const active = isItemActive(tab, pathname)
                  return (
                    <DropdownMenuItem
                      key={tab.href}
                      asChild
                      className={cn(
                        'min-h-11',
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
            <DropdownMenuItem asChild className="min-h-11">
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
      </header>
    </>
  )
}
