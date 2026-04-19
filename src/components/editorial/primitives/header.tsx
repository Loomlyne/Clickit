'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type HeaderProps = {
  /** If true, renders the landing-page variant of the header (overlay, Sign-in + Start-free CTA). */
  isLanding?: boolean
  /** Currently-active route name for nav link active state. */
  active?: string
  /** Avatar initial (usually first letter of display name / email). */
  avatarInitial?: string
}

/**
 * Editorial header — sticky, blurred, three-column layout (logo · nav · right side).
 * Ported from Clickit- handoff/project/src/components.jsx Header().
 *
 * Lives inside the editorial-only tree; uses CSS from editorial.css scoped
 * under html[data-design="editorial"].
 */
export function EditorialHeader({ isLanding = false, active, avatarInitial = 'K' }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navLinks = [
    { href: '/browse', label: 'Browse', id: 'browse' },
    { href: '/coming-soon', label: 'Coming Soon', id: 'coming-soon' },
    { href: '/support', label: 'Support', id: 'support' },
  ]

  return (
    <header className={`app-header${scrolled ? ' scrolled' : ''}${isLanding ? ' landing' : ''}`}>
      <Link href={isLanding ? '/' : '/browse'} className="logo">
        <span className="dot" />
        CLICKIT
      </Link>
      <nav className="nav">
        {!isLanding &&
          navLinks.map((l) => (
            <Link key={l.id} href={l.href} className={active === l.id ? 'active' : ''}>
              {l.label}
            </Link>
          ))}
        {isLanding && (
          <>
            <a href="#features">Why Clickit</a>
            <a href="#shows">Shows</a>
            <a href="#faq">FAQ</a>
          </>
        )}
      </nav>
      <div className="header-right">
        {isLanding ? (
          <>
            <Link href="/auth" className="btn btn-outline btn-sm">
              Sign in
            </Link>
            <Link href="/browse" className="btn btn-primary btn-sm">
              Start free
            </Link>
          </>
        ) : (
          <Link href="/profile" className="avatar" aria-label="Profile">
            {avatarInitial}
          </Link>
        )}
      </div>
    </header>
  )
}
