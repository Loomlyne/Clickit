'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import { AuthSection } from './auth-section'

interface NavbarProps {
  initialUser?: { id: string; email: string } | null
}

export function Navbar({ initialUser }: NavbarProps) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const isLanding = pathname === '/' || pathname === ''

  useEffect(() => {
    let ticking = false
    const handler = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrolled(window.scrollY > 24)
          ticking = false
        })
        ticking = true
      }
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
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
        'sticky top-0 z-50 flex items-center gap-7 px-10 py-[18px] border-b transition-all duration-200 backdrop-blur-[18px]',
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

      {/* Nav links */}
      <nav className="flex items-center gap-[22px]">
        {!isLanding && (
          <>
            <Link href="/browse" className={navLinkClass(pathname === '/browse')}>Browse</Link>
            <Link href="/coming-soon" className={navLinkClass(pathname === '/coming-soon')}>Coming Soon</Link>
            <Link href="/support" className={navLinkClass(pathname === '/support')}>Support</Link>
          </>
        )}
        {isLanding && (
          <>
            <a href="#features" className="text-[13.5px] text-[var(--text-dim)] py-1.5 px-0.5 transition-colors duration-150 hover:text-[var(--text)]">Why Clickit</a>
            <a href="#shows" className="text-[13.5px] text-[var(--text-dim)] py-1.5 px-0.5 transition-colors duration-150 hover:text-[var(--text)]">Shows</a>
            <a href="#faq" className="text-[13.5px] text-[var(--text-dim)] py-1.5 px-0.5 transition-colors duration-150 hover:text-[var(--text)]">FAQ</a>
          </>
        )}
      </nav>

      {/* Right side: auth */}
      <div className="ms-auto flex items-center gap-3.5">
        <AuthSection initialUser={initialUser} isLanding={isLanding} />
      </div>
    </header>
  )
}
