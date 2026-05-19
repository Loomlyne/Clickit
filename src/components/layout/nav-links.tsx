'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

export const NAV_LINK_HREFS = [
  { key: 'watch', href: '/watch' },
  { key: 'support', href: '/support' },
] as const

/** Deep-link to the live rail on the watch page (anchor id on ContentRail). */
export const NOW_LIVE_HREF = '/watch#now-streaming' as const

export function liveNavHref(configuredUrl: string | null | undefined) {
  const trimmed = configuredUrl?.trim()
  return trimmed ? trimmed : NOW_LIVE_HREF
}

export function liveNavIsExternal(href: string) {
  return href.startsWith('http://') || href.startsWith('https://')
}

export function NavLinks() {
  const pathname = usePathname()
  const t = useTranslations('nav')

  return (
    <nav aria-label={t('navLabel')}>
      <div className="flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.02] p-1.5">
        {NAV_LINK_HREFS.map(({ key, href }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'rounded-full px-3 py-2 text-sm font-medium tracking-[0.08em] whitespace-nowrap uppercase transition-colors',
                isActive
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/56 hover:text-white'
              )}
            >
              {t(key)}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
