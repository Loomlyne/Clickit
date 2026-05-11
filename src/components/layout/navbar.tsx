'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Link, usePathname } from '@/i18n/navigation'
import { useLenis } from 'lenis/react'
import { cn } from '@/lib/utils'
import { AuthSection } from './auth-section'
import { MobileNav } from './mobile-nav'
import { NOW_LIVE, liveNavHref, liveNavIsExternal } from './nav-links'

interface NavbarProps {
  initialUser?: { id: string; email: string } | null
  liveStreamUrl?: string | null
}

export function Navbar({ initialUser, liveStreamUrl }: NavbarProps) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const lastScrollY = useRef(0)
  const isLanding =
    pathname === '/portfolio' || pathname === '' || pathname.startsWith('/auth')

  // Direction-aware show/hide via Lenis. Hide on scroll down, show on scroll up.
  useLenis(({ scroll }) => {
    const y = scroll
    const delta = y - lastScrollY.current
    setScrolled(y > 24)
    if (y < 80) {
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
      'text-[13.5px] py-1.5 px-0.5 relative transition-colors duration-150 hover:text-[var(--text)]',
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
        aria-label="Clickit Story home"
        className="flex min-h-11 items-center"
      >
        <Image
          src="/brand/Clickit_final_logo.CITpng.svg"
          alt="Clickit"
          width={214}
          height={145}
          className="h-8 w-auto"
          priority
        />
      </Link>

      {/* Mobile: keep "Now Live" near the logo */}
      {!isLanding &&
        (() => {
          const liveHref = liveNavHref(liveStreamUrl)
          const external = liveNavIsExternal(liveHref)
          const pillClass = cn(
            'md:hidden inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold tracking-tight text-white shadow-sm transition-[transform,box-shadow,background-color] duration-200 hover:brightness-110 active:scale-[0.98]',
            'bg-[linear-gradient(135deg,#dc2626_0%,#b91c1c_100%)] ring-1 ring-white/15'
          )
          const inner = (
            <>
              <span className="relative flex size-2 shrink-0" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/90 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
              </span>
              {NOW_LIVE.label}
            </>
          )
          return external ? (
            <a href={liveHref} target="_blank" rel="noopener noreferrer" className={pillClass}>
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
            <Link href="/watch" className={navLinkClass(pathname === '/watch')}>
              Watch
            </Link>
            {(() => {
              const liveHref = liveNavHref(liveStreamUrl)
              const external = liveNavIsExternal(liveHref)
              const pillClass = cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold tracking-tight text-white shadow-sm transition-[transform,box-shadow,background-color] duration-200 hover:brightness-110 active:scale-[0.98]',
                'bg-[linear-gradient(135deg,#dc2626_0%,#b91c1c_100%)] ring-1 ring-white/15'
              )
              const inner = (
                <>
                  <span className="relative flex size-2 shrink-0" aria-hidden>
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/90 opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
                  </span>
                  {NOW_LIVE.label}
                </>
              )
              return external ? (
                <a href={liveHref} target="_blank" rel="noopener noreferrer" className={pillClass}>
                  {inner}
                </a>
              ) : (
                <Link href={liveHref} className={pillClass}>
                  {inner}
                </Link>
              )
            })()}
            <Link
              href="/support"
              className={navLinkClass(pathname === '/support')}
            >
              Support
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
                  className="px-0.5 py-1.5 text-[13.5px] text-[var(--text-dim)] transition-colors duration-150 hover:text-[var(--text)]"
                >
                  Shows
                </a>
                <a
                  href={`${prefix}#faq`}
                  className="px-0.5 py-1.5 text-[13.5px] text-[var(--text-dim)] transition-colors duration-150 hover:text-[var(--text)]"
                >
                  FAQ
                </a>
              </>
            )
          })()}
      </nav>

      {/* Right side: auth (desktop) */}
      <div className="ms-auto hidden items-center gap-3.5 md:flex">
        <AuthSection initialUser={initialUser} isLanding={isLanding} />
      </div>

      {/* Mobile hamburger — only visible on <md: */}
      <div className="ms-auto md:hidden">
        <MobileNav initialUser={initialUser} liveStreamUrl={liveStreamUrl} />
      </div>
    </header>
  )
}
