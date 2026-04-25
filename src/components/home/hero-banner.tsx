// Hero banner — matches handoff .hero (78vh, vertical dots on right)
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AnimatePresence,
  MotionConfig,
  useReducedMotion,
} from 'motion/react'

import type { ViewShow } from '@/lib/queries'
import { HeroSlide } from '@/components/home/hero-slide'
import { HeroDots } from '@/components/home/rotation-indicator'

const INTERVAL = 2000

interface HeroBannerProps {
  shows: Array<{ show: ViewShow; firstEpisodeId?: string }>
  isMobile?: boolean
}

export function HeroBanner({ shows, isMobile }: HeroBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const shouldReduceMotion = useReducedMotion()

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
      className="relative mb-3 overflow-hidden"
      style={{ height: '78vh', minHeight: 580 }}
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
            isMobile={isMobile}
            reducedMotion={shouldReduceMotion ?? false}
          />
        </AnimatePresence>

        {/* Vertical dots — right side, matching handoff .hero-dots */}
        <HeroDots
          activeIndex={activeIndex}
          total={shows.length}
          intervalMs={INTERVAL}
          isPaused={isPaused}
          onSelect={setActiveIndex}
        />
      </MotionConfig>

      <div className="sr-only" aria-live="polite">
        Now showing: {shows[activeIndex].show.title}
      </div>
    </div>
  )
}
