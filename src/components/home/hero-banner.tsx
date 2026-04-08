'use client'

import { useState, useEffect } from 'react'
import {
  AnimatePresence,
  MotionConfig,
  useReducedMotion,
} from 'motion/react'

import type { ViewShow } from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'
import { HeroSlide } from '@/components/home/hero-slide'
import { RotationIndicator } from '@/components/home/rotation-indicator'

interface HeroBannerProps {
  shows: Array<{ show: ViewShow; firstEpisodeId?: string }>
}

export function HeroBanner({ shows }: HeroBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)

  const shouldReduceMotion = useReducedMotion()

  // Auto-rotation timer (6000ms interval per D-02)
  useEffect(() => {
    if (isPaused || shouldReduceMotion) {
      setProgress(0)
      return
    }

    const INTERVAL = 500
    const TICK = 50
    let elapsed = 0

    const timer = setInterval(() => {
      elapsed += TICK
      setProgress(elapsed / INTERVAL)
      if (elapsed >= INTERVAL) {
        setActiveIndex((prev) => (prev + 1) % shows.length)
        elapsed = 0
        setProgress(0)
      }
    }, TICK)

    return () => clearInterval(timer)
  }, [isPaused, shouldReduceMotion, shows.length])

  return (
    <div
      className="-mt-24 md:-mt-28 relative h-dvh w-full overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={(e) => {
        // Only unpause if focus leaves the hero entirely
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsPaused(false)
        }
      }}
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
          progress={progress}
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
