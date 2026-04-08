'use client'

import { useState, useEffect, useRef } from 'react'
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
  const elapsedRef = useRef(0)

  // Auto-rotation timer — 1000ms per slide, persists elapsed across hover pause
  useEffect(() => {
    if (isPaused || shouldReduceMotion) return

    const INTERVAL = 1000
    const TICK = 50

    const timer = setInterval(() => {
      elapsedRef.current += TICK
      setProgress(elapsedRef.current / INTERVAL)
      if (elapsedRef.current >= INTERVAL) {
        setActiveIndex((prev) => (prev + 1) % shows.length)
        elapsedRef.current = 0
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
