'use client'

import { AnimatePresence, motion } from 'motion/react'
import { usePathname } from '@/i18n/navigation'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'

/** Fullscreen episode player: skip route fade so navigation feels instant. */
function isEpisodeWatchPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean)
  // next-intl usePathname() is locale-stripped → hub `/watch`, player `/watch/[id]`.
  if (
    segments.length >= 2 &&
    segments[0] === 'watch' &&
    segments[1] !== undefined &&
    segments[1] !== ''
  ) {
    return true
  }
  // Locale-prefixed fallback if pathname ever includes the first segment as locale.
  return segments.length >= 3 && segments[1] === 'watch'
}

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const prefersReducedMotion = usePrefersReducedMotion()
  const skipMotion = prefersReducedMotion || isEpisodeWatchPath(pathname)
  const lastLoggedRef = useRef<string | null>(null)

  // #region agent log
  useEffect(() => {
    const key = `${pathname}|${skipMotion}|${prefersReducedMotion}`
    if (lastLoggedRef.current === key) return
    lastLoggedRef.current = key
    const segments = pathname.split('/').filter(Boolean)
    const legacyStripped =
      segments.length >= 3 && segments[1] === 'watch'
    const intlStyleEpisode =
      segments.length >= 2 &&
      segments[0] === 'watch' &&
      Boolean(segments[1])
    const payload = {
      sessionId: 'c080c4',
      hypothesisId: 'H1',
      location: 'page-transition.tsx:PageTransition',
      message: 'pathname branch for route transition',
      data: {
        pathname,
        segments,
        prefersReducedMotion,
        skipMotion,
        legacyLocalePrefixedEpisodeMatch: legacyStripped,
        intlStrippedEpisodeMatch: intlStyleEpisode,
      },
      timestamp: Date.now(),
      runId: 'post-fix-verify',
    }
    fetch(
      'http://127.0.0.1:7686/ingest/c24e427b-02db-4b23-8a39-a8cf836a1ca3',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': 'c080c4',
        },
        body: JSON.stringify(payload),
      }
    ).catch(() => {})
    const origin =
      typeof window !== 'undefined' ? window.location.origin : ''
    fetch(`${origin}/api/debug-session-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {})
  }, [pathname, skipMotion, prefersReducedMotion])
  // #endregion

  if (skipMotion) {
    return <>{children}</>
  }

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
