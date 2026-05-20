'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { useLenis } from 'lenis/react'
import { cn } from '@/lib/utils'
import { AuthSection } from './auth-section'
import { MobileNav } from './mobile-nav'
import { liveNavHref, liveNavIsExternal } from './nav-links'

interface NavbarProps {
  initialUser?: { id: string; email: string } | null
  liveStreamUrl?: string | null
  logoUrl?: string | null
}

export function Navbar({ initialUser, liveStreamUrl, logoUrl }: NavbarProps) {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations('nav')
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const lastScrollY = useRef(0)
  const isLanding =
    pathname === '/portfolio' || pathname === '' || pathname.startsWith('/auth')

  // Direction-aware show/hide via Lenis. Hide on scroll down, show on scroll up.
  // Landing pages keep the nav pinned — hiding it reveals body bg behind the hero.
  useLenis(({ scroll }) => {
    const y = scroll
    const delta = y - lastScrollY.current
    setScrolled(y > 24)
    if (isLanding) {
      setHidden(false)
    } else if (y < 80) {
      setHidden(false)
    } else if (delta > 4) {
      setHidden(true)
    } else if (delta < -4) {
      setHidden(false)
    }
    lastScrollY.current = y
  })

  // Sync once on mount (Lenis only fires on real scroll events)
  useEffect(() => {
    setScrolled(window.scrollY > 24)
    lastScrollY.current = window.scrollY
  }, [])

  const navLinkClass = (active: boolean) =>
    cn(
      'text-[13.5px] py-1.5 px-0.5 relative uppercase tracking-[0.08em] transition-colors duration-150 hover:text-[var(--text)]',
      active
        ? 'text-[var(--text)] after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:bg-[var(--primary)]'
        : 'text-[var(--text-dim)]'
    )

  return (
    <header
      className={cn(
        'sticky top-0 z-50 flex items-center gap-3 border-b px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 backdrop-blur-[18px] md:gap-7 md:px-10 md:pt-[calc(env(safe-area-inset-top)+18px)] md:pb-[18px]',
        'transition-[transform,background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform',
        hidden ? '-translate-y-full' : 'translate-y-0',
        isLanding &&
          !scrolled &&
          'border-transparent bg-gradient-to-b from-[rgba(10,10,10,0.8)] to-transparent',
        isLanding &&
          scrolled &&
          'border-[var(--line)] bg-[rgba(10,10,10,0.96)]',
        !isLanding &&
          'border-[var(--line)] bg-[linear-gradient(180deg,rgba(10,10,10,0.95),rgba(10,10,10,0.65))]',
        !isLanding && scrolled && 'bg-[rgba(10,10,10,0.96)]'
      )}
      style={{ WebkitBackdropFilter: 'blur(18px)' }}
    >
      <Link
        href="/watch"
        aria-label={t('home')}
        className="flex min-h-11 items-center"
      >
        <Image
          src={logoUrl ?? '/brand/cit-story.png'}
          alt="Clickit"
          width={214}
          height={145}
          className="h-8 w-auto object-contain"
          unoptimized={!!logoUrl}
          priority
        />
      </Link>

      {/* Mobile: keep "Now Live" near the logo */}
      {!isLanding &&
        (() => {
          const liveHref = liveNavHref(liveStreamUrl)
          const external = liveNavIsExternal(liveHref)
          const pillClass = cn(
            'md:hidden inline-flex items-center gap-2 text-[13px] font-semibold tracking-tight text-white transition-opacity duration-200 hover:opacity-80'
          )
          const inner = (
            <>
              <span className="relative flex size-2 shrink-0" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)]" />
              </span>
              {t('nowLive')}
            </>
          )
          return external ? (
            <a
              href={liveHref}
              target="_blank"
              rel="noopener noreferrer"
              className={pillClass}
            >
              {inner}
            </a>
          ) : (
            <Link href={liveHref} className={pillClass}>
              {inner}
            </Link>
          )
        })()}

      {/* Nav links — hidden on mobile, MobileNav handles those */}
      <nav className="hidden items-center gap-[22px] md:flex">
        {!isLanding && (
          <>
            {(() => {
              const liveHref = liveNavHref(liveStreamUrl)
              const external = liveNavIsExternal(liveHref)
              const pillClass = cn(
                'inline-flex items-center gap-2 text-[13px] font-semibold tracking-tight text-white transition-opacity duration-200 hover:opacity-80'
              )
              const inner = (
                <>
                  <span className="relative flex size-2 shrink-0" aria-hidden>
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)]" />
                  </span>
                  {t('nowLive')}
                </>
              )
              return external ? (
                <a
                  href={liveHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={pillClass}
                >
                  {inner}
                </a>
              ) : (
                <Link href={liveHref} className={pillClass}>
                  {inner}
                </Link>
              )
            })()}
            <Link href="/watch" prefetch className={navLinkClass(pathname === '/watch')}>
              {t('watch')}
            </Link>
            <Link
              href="/support"
              prefetch
              className={navLinkClass(pathname === '/support')}
            >
              {t('support')}
            </Link>
          </>
        )}
        {isLanding &&
          (() => {
            const isPortfolio = pathname === '/portfolio' || pathname === ''
            const prefix = isPortfolio ? '' : '/portfolio'
            return (
              <>
                <a
                  href={`${prefix}#shows`}
                  className="px-0.5 py-1.5 text-[13.5px] tracking-[0.08em] text-[var(--text-dim)] uppercase transition-colors duration-150 hover:text-[var(--text)]"
                >
                  {t('shows')}
                </a>
                <a
                  href={`${prefix}#faq`}
                  className="px-0.5 py-1.5 text-[13.5px] tracking-[0.08em] text-[var(--text-dim)] uppercase transition-colors duration-150 hover:text-[var(--text)]"
                >
                  {t('faq')}
                </a>
              </>
            )
          })()}
      </nav>

      {/* Right side: auth (desktop) */}
      <div className="ms-auto hidden items-center gap-3.5 md:flex">
        <div className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.03] p-1">
          <Link
            href={pathname || '/watch'}
            locale="en"
            aria-label="Switch to English"
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] leading-none font-semibold tracking-[0.08em] transition-colors duration-150',
              locale === 'en'
                ? 'bg-white text-black'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            )}
          >
            EN
          </Link>
          <span className="px-1 text-[10px] text-[var(--text-dim)]">/</span>
          <Link
            href={pathname || '/watch'}
            locale="ar"
            aria-label="Switch to Arabic"
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] leading-none font-semibold tracking-[0.08em] transition-colors duration-150',
              locale === 'ar'
                ? 'bg-white text-black'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            )}
          >
            AR
          </Link>
        </div>
        <AuthSection initialUser={initialUser} isLanding={isLanding} />
      </div>

      {/* Mobile: locale switch + hamburger */}
      <div className="ms-auto flex items-center gap-2 md:hidden">
        <div className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.03] p-1">
          <Link
            href={pathname || '/watch'}
            locale="en"
            aria-label="Switch to English"
            className={cn(
              'rounded-full px-2 py-1 text-[10px] leading-none font-semibold tracking-[0.08em] transition-colors duration-150',
              locale === 'en'
                ? 'bg-white text-black'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            )}
          >
            EN
          </Link>
          <span className="px-1 text-[10px] text-[var(--text-dim)]">/</span>
          <Link
            href={pathname || '/watch'}
            locale="ar"
            aria-label="Switch to Arabic"
            className={cn(
              'rounded-full px-2 py-1 text-[10px] leading-none font-semibold tracking-[0.08em] transition-colors duration-150',
              locale === 'ar'
                ? 'bg-white text-black'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            )}
          >
            AR
          </Link>
        </div>
        <MobileNav initialUser={initialUser} liveStreamUrl={liveStreamUrl} logoUrl={logoUrl} />
      </div>
    </header>
  )
}
