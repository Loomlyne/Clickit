'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Link, usePathname } from '@/i18n/navigation'
import { useLenis } from 'lenis/react'
import { cn } from '@/lib/utils'
import { AuthSection } from './auth-section'
import { MobileNav } from './mobile-nav'

interface NavbarProps {
  initialUser?: { id: string; email: string } | null
}

export function Navbar({ initialUser }: NavbarProps) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const lastScrollY = useRef(0)
  const isLanding = pathname === '/' || pathname === '' || pathname.startsWith('/auth')

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
        'sticky top-0 z-50 flex items-center gap-3 px-4 py-3 md:gap-7 md:px-10 md:py-[18px] border-b backdrop-blur-[18px]',
        'transition-[transform,background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform',
        hidden ? '-translate-y-full' : 'translate-y-0',
        isLanding && !scrolled && 'bg-gradient-to-b from-[rgba(10,10,10,0.8)] to-transparent border-transparent',
        isLanding && scrolled && 'bg-[rgba(10,10,10,0.96)] border-[var(--line)]',
        !isLanding && 'bg-[linear-gradient(180deg,rgba(10,10,10,0.95),rgba(10,10,10,0.65))] border-[var(--line)]',
        !isLanding && scrolled && 'bg-[rgba(10,10,10,0.96)]',
      )}
      style={{ WebkitBackdropFilter: 'blur(18px)' }}
    >
      <Link href="/" aria-label="Clickit Story home">
        <Image
          src="/brand/Clickit_final_logo.svg"
          alt="Clickit Story"
          width={124}
          height={32}
          className="h-7 w-auto"
          priority
        />
      </Link>

      {/* Nav links — hidden on mobile, MobileNav handles those */}
      <nav className="hidden md:flex items-center gap-[22px]">
        {!isLanding && (
          <>
            <Link href="/browse" className={navLinkClass(pathname === '/browse')}>Browse</Link>
            <Link href="/coming-soon" className={navLinkClass(pathname === '/coming-soon')}>Coming Soon</Link>
            <Link href="/support" className={navLinkClass(pathname === '/support')}>Support</Link>
          </>
        )}
        {isLanding && (() => {
          const isHome = pathname === '/' || pathname === ''
          const prefix = isHome ? '' : '/'
          return (
            <>
              <a href={`${prefix}#features`} className="text-[13.5px] text-[var(--text-dim)] py-1.5 px-0.5 transition-colors duration-150 hover:text-[var(--text)]">Why Clickit</a>
              <a href={`${prefix}#shows`} className="text-[13.5px] text-[var(--text-dim)] py-1.5 px-0.5 transition-colors duration-150 hover:text-[var(--text)]">Shows</a>
              <a href={`${prefix}#faq`} className="text-[13.5px] text-[var(--text-dim)] py-1.5 px-0.5 transition-colors duration-150 hover:text-[var(--text)]">FAQ</a>
            </>
          )
        })()}
      </nav>

      {/* Right side: auth (desktop) */}
      <div className="ms-auto hidden md:flex items-center gap-3.5">
        <AuthSection initialUser={initialUser} isLanding={isLanding} />
      </div>

      {/* Mobile hamburger — only visible on <md: */}
      <div className="ms-auto md:hidden">
        <MobileNav initialUser={initialUser} />
      </div>
    </header>
  )
}
