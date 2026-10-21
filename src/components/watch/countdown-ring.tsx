'use client'

import { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'

import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import { UPNEXT_SECONDS } from '@/lib/watch/ended-state'
import { cn } from '@/lib/utils'

const STROKE = 3

type CountdownRingProps = {
  secondsLeft: number
  /** 64 on the stage thumbnail, 44 in the narrow card and the bar. */
  size: 64 | 44
  /** Frozen (tab or player out of view): the arc holds, no animation. */
  paused?: boolean
  total?: number
  className?: string
}

/**
 * Up-next countdown ring (UI-SPEC section 4.2). Track and arc start at 12
 * o'clock and run clockwise; in RTL only the circle group is mirrored, never
 * the number. Not rendered at all under reduced motion.
 */
export function CountdownRing({
  secondsLeft,
  size,
  paused = false,
  total = UPNEXT_SECONDS,
  className,
}: CountdownRingProps) {
  const locale = useLocale()
  const reduced = usePrefersReducedMotion()

  // The first paint shows a full ring; one frame later the arc is told to
  // travel to where it must be one second from now, so it moves linearly over
  // each second and lands exactly when the number changes.
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setArmed(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (reduced) return null

  const center = size / 2
  const radius = (size - STROKE) / 2
  const circumference = 2 * Math.PI * radius
  const safeTotal = total > 0 ? total : UPNEXT_SECONDS
  const left = Math.min(Math.max(secondsLeft, 0), safeTotal)
  const remaining = paused || !armed ? left : Math.max(left - 1, 0)
  const offset = circumference * (1 - remaining / safeTotal)
  const number = new Intl.NumberFormat(locale).format(left)

  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex flex-none items-center justify-center',
        size === 64 ? 'size-16' : 'size-11',
        className
      )}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full">
        <g className="origin-center rtl:-scale-x-100">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-[var(--line-2)]"
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${center} ${center})`}
            className="stroke-[var(--primary)]"
            style={{
              transition:
                paused || !armed ? 'none' : 'stroke-dashoffset 1s linear',
            }}
          />
        </g>
      </svg>
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center leading-none font-bold text-[var(--text)] tabular-nums',
          size === 64 ? 'text-[24px]' : 'text-[14px]'
        )}
      >
        {number}
      </span>
    </span>
  )
}
