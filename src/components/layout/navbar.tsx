'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { AuthSection } from './auth-section'
import { NavLinks } from './nav-links'

interface NavbarProps {
  initialUser?: { id: string; email: string } | null
}

export function Navbar({ initialUser }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        'fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-6 md:px-12 transition-all duration-300',
        scrolled
          ? 'bg-[rgba(0,0,0,0.85)] backdrop-blur-xl border-b border-white/[0.06]'
          : 'bg-transparent'
      )}
      style={scrolled ? { WebkitBackdropFilter: 'blur(24px)' } : undefined}
    >
      <Link href="/" aria-label="Clickit Story home">
        <Image
          src="/brand/Clickit_final_logo.svg"
          alt="Clickit Story"
          width={120}
          height={32}
          priority
          className="h-8 w-auto"
        />
      </Link>
      <NavLinks />
      <div className="flex items-center gap-4">
        <AuthSection initialUser={initialUser} />
      </div>
    </nav>
  )
}
