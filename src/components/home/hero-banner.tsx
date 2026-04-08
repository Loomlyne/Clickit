'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AnimatePresence,
  MotionConfig,
  useReducedMotion,
} from 'motion/react'

import type { ViewShow } from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'
import { HeroSlide } from '@/components/home/hero-slide'
import { RotationIndicator } from '@/components/home/rotation-indicator'

const INTERVAL = 2500

interface HeroBannerProps {
  shows: Array<{ show: ViewShow; firstEpisodeId?: string }>
}

export function HeroBanner({ shows }: HeroBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const shouldReduceMotion = useReducedMotion()

  // Single interval just advances the slide — progress bar is pure CSS
  useEffect(() => {
    if (isPaused || shouldReduceMotion) return

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % shows.length)
    }, INTERVAL)

    return () => clearInterval(timer)
  }, [isPaused, shouldReduceMotion, shows.length])

  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsPaused(false)
    }
  }, [])

  return (
    <div
      className="-mt-24 md:-mt-28 relative h-dvh w-full overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={handleBlur}
    >
      <MotionConfig reducedMotion="user">
        <AnimatePresence mode="sync">
          <HeroSlide
            key={shows[activeIndex].show.id}
            show={shows[activeIndex].show}
            firstEpisodeId={shows[activeIndex].firstEpisodeId}
            isActive={true}
          />
        </AnimatePresence>

        <RotationIndicator
          activeIndex={activeIndex}
          total={shows.length}
          intervalMs={INTERVAL}
          isPaused={isPaused}
          activeColor={BRAND_COLOR_HEX[shows[activeIndex].show.brandColor]}
        />
      </MotionConfig>

      {/* Screen reader announcement for slide changes */}
      <div className="sr-only" aria-live="polite">
        Now showing: {shows[activeIndex].show.title}
      </div>
    </div>
  )
}
