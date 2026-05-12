'use client'

import { AnimatePresence, motion } from 'motion/react'
import { usePathname } from '@/i18n/navigation'
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
  return segments.length >= 3 && segments[1] === 'watch'
}

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const prefersReducedMotion = usePrefersReducedMotion()
  const skipMotion = prefersReducedMotion || isEpisodeWatchPath(pathname)

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
