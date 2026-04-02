'use client'

import { useState, useEffect } from 'react'
import {
  AnimatePresence,
  MotionConfig,
  useReducedMotion,
} from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import type { Show } from '@/lib/mock-data'
import { brandColorHexMap } from '@/lib/mock-data'
import { HeroSlide } from '@/components/home/hero-slide'
import { RotationIndicator } from '@/components/home/rotation-indicator'

interface HeroBannerProps {
  shows: Array<{ show: Show; firstEpisodeId?: string }>
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

    const INTERVAL = 8000
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
      className="-mt-16 relative h-screen w-full overflow-hidden"
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
          activeColor={brandColorHexMap[shows[activeIndex].show.brandColor]}
        />
      </MotionConfig>

      <button
        onClick={() => setActiveIndex((i) => (i - 1 + shows.length) % shows.length)}
        className="absolute left-4 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
        aria-label="Previous show"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        onClick={() => setActiveIndex((i) => (i + 1) % shows.length)}
        className="absolute right-4 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
        aria-label="Next show"
      >
        <ChevronRight className="size-5" />
      </button>

      {/* Screen reader announcement for slide changes */}
      <div className="sr-only" aria-live="polite">
        Now showing: {shows[activeIndex].show.title}
      </div>
    </div>
  )
}
