'use client'

import { ReactLenis } from 'lenis/react'
import type { ReactNode } from 'react'

import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'

export function SmoothScroll({ children }: { children: ReactNode }) {
  const prefersReducedMotion = usePrefersReducedMotion()

  if (prefersReducedMotion) {
    return <>{children}</>
  }

  return (
    <ReactLenis
      root
      options={{
        // Snappier interpolation — higher lerp tracks the wheel more closely so
        // the page settles faster and feels less floaty/laggy. (duration/easing
        // are ignored while lerp is set, so they're dropped.)
        lerp: 0.2,
        smoothWheel: true,
        // Touch stays native (Lenis default: syncTouch off). Native momentum
        // scrolling is smoother AND cheaper on phones than JS-interpolated
        // smoothing — that's where the jank hurt most.
        wheelMultiplier: 1,
      }}
    >
      {children}
    </ReactLenis>
  )
}
