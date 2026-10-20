'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import { AuthSection } from './auth-section'
import { MobileNav } from './mobile-nav'
import { liveNavHref, liveNavIsExternal } from './nav-links'
import { pickLocalized, type Locale } from '@/lib/locale'
import {
  NAV_SCROLLED_Y,
  isProgrammaticScroll,
  nextNavHidden,
  subscribeNavScroll,
} from '@/lib/nav-scroll'

interface NavbarProps {
  initialUser?: { id: string; email: string } | null
  liveStreamUrl?: string | null
  liveStreamLabel?: string | null
  liveStreamLabelAr?: string | null
  logoUrl?: string | null
  variant?: 'default' | 'minimal'
}

export function Navbar({
  initialUser,
  liveStreamUrl,
  liveStreamLabel,
  liveStreamLabelAr,
  logoUrl,
  variant = 'default',
}: NavbarProps) {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations('nav')
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const lastScrollY = useRef(0)
  const isMinimal = variant === 'minimal'
  const isLanding =
    !isMinimal &&
    (pathname === '/portfolio' || pathname === '' || pathname.startsWith('/auth'))

  // Direction-aware show/hide on native scroll (rules in nextNavHidden).
  // Landing pages keep the nav pinned — hiding it reveals body bg behind the
  // hero. One passive listener, at most one update per frame.
  useEffect(() => {
    const unsubscribe = subscribeNavScroll(window, (y) => {
      const lastY = lastScrollY.current
      const programmatic = isProgrammaticScroll()
      lastScrollY.current = y
      setScrolled(y > NAV_SCROLLED_Y)
      setHidden((hidden) =>
        nextNavHidden({
          y,
          lastY,
          hidden,
          isLanding,
          viewportHeight: window.innerHeight,
          programmatic,
        })
      )
    })
    // Sync once on mount (restored or mid-page loads fire no scroll event);
    // only the position, so a mid-page reload does not start hidden.
    // Browser-only read after hydration (SSR must render unscrolled), so it cannot be derived in render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScrolled(window.scrollY > NAV_SCROLLED_Y)
    lastScrollY.current = window.scrollY
    return unsubscribe
  }, [isLanding])

  const navLinkClass = (active: boolean) =>
    cn(
      'text-[13.5px] py-1.5 px-0.5 relative uppercase tracking-[0.08em] transition-colors duration-150 hover:text-[var(--text)]',
      active
        ? 'text-[var(--text)] after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:bg-[var(--primary)]'
        : 'text-[var(--text-dim)]'
    )

  const customLiveLabel = pickLocalized(
    locale as Locale,
    liveStreamLabel ?? '',
    liveStreamLabelAr
  ).trim()
  const liveLabel = customLiveLabel || t('nowLive')

  return (
    <header
      className={cn(
        'sticky top-0 z-[60] flex items-center gap-3 border-b px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 md:gap-7 md:px-10 md:pt-[calc(env(safe-area-inset-top)+18px)] md:pb-[18px]',
        'transition-[transform,background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform',
        hidden ? '-translate-y-full' : 'translate-y-0',
        isMinimal &&
          'border-[var(--line)] bg-[var(--scrim-nav)] backdrop-blur-[18px]',
        !isMinimal &&
          isLanding &&
          !scrolled &&
          'border-transparent bg-transparent',
        !isMinimal &&
          isLanding &&
          scrolled &&
          'border-[var(--line)] bg-[var(--scrim-nav)]',
        !isMinimal &&
          !isLanding &&
          'border-[var(--line)] bg-[image:var(--gradient-nav-fade)]',
        !isMinimal && !isLanding && scrolled && 'bg-[var(--scrim-nav)]'
      )}
      style={{
        WebkitBackdropFilter:
          isMinimal || !(isLanding && !scrolled) ? 'blur(18px)' : undefined,
      }}
    >
      <Link
        href={isMinimal ? '/coming-soon' : '/watch'}
        aria-label={t('home')}
        className="flex min-h-11 items-center"
      >
        <Image
          src={logoUrl ?? '/brand/cit-story.png'}
          alt="Clickit"
          width={214}
          height={145}
          className={cn(
            'w-auto object-contain',
            isMinimal ? 'h-7' : 'h-8'
          )}
          priority
        />
      </Link>

      {isMinimal ? (
        <div className="ms-auto flex items-center">
          <AuthSection
            initialUser={initialUser}
            layout="minimal"
            signOutRedirect="/coming-soon"
            hideProfileLink
          />
        </div>
      ) : (
        <>
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
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-live-dot opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-live-dot shadow-live-dot" />
              </span>
              {liveLabel}
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
      {!isLanding && (
        <nav className="hidden items-center gap-[22px] md:flex">
          {(() => {
            const liveHref = liveNavHref(liveStreamUrl)
            const external = liveNavIsExternal(liveHref)
            const pillClass = cn(
              'inline-flex items-center gap-2 text-[13px] font-semibold tracking-tight text-white transition-opacity duration-200 hover:opacity-80'
            )
            const inner = (
              <>
                <span className="relative flex size-2 shrink-0" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-live-dot opacity-75 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2 rounded-full bg-live-dot shadow-live-dot" />
                </span>
                {liveLabel}
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
        </nav>
      )}

      {/* Right side: auth (desktop) */}
      <div className="relative z-[1] ms-auto hidden items-center gap-3.5 md:flex">
        <div className="inline-flex items-center rounded-full border border-white/12 bg-black/60 p-1">
          <Link
            href={pathname || '/watch'}
            locale="en"
            aria-label={t('switchToEnglish')}
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
            aria-label={t('switchToArabic')}
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
        <div className="inline-flex items-center rounded-full border border-white/12 bg-black/60 p-1">
          <Link
            href={pathname || '/watch'}
            locale="en"
            aria-label={t('switchToEnglish')}
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
            aria-label={t('switchToArabic')}
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
        </>
      )}
    </header>
  )
}
