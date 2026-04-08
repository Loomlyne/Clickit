'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { AuthSection } from './auth-section'

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
      className="fixed inset-x-0 top-0 z-50 px-4 pt-4 transition-all duration-300 md:px-6 md:pt-5"
    >
      <div
        className={cn(
          'mx-auto flex h-[72px] w-full max-w-5xl items-center justify-between rounded-[28px] border p-2.5 transition-all duration-300',
          'bg-[linear-gradient(180deg,rgba(15,18,27,0.86),rgba(9,12,18,0.78))] shadow-[0_24px_80px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl',
          scrolled
            ? 'border-white/14 bg-[linear-gradient(180deg,rgba(12,15,22,0.94),rgba(7,10,15,0.9))]'
            : 'border-white/10'
        )}
        style={{ WebkitBackdropFilter: 'blur(28px)' }}
      >
        <Link
          href="/"
          aria-label="Clickit Story home"
          className="flex items-center px-3 md:px-4"
        >
          <Image
            src="/brand/Clickit_final_logo.svg"
            alt="Clickit Story"
            width={124}
            height={32}
            priority
            className="h-8 w-auto"
          />
        </Link>

        <AuthSection initialUser={initialUser} />
      </div>
    </nav>
  )
}
