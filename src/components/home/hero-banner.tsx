// Hero banner — matches handoff .hero (78vh, vertical dots on right)
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useReducedMotion } from 'motion/react'

import type { ViewShow } from '@/lib/queries'
import { HeroSlide } from '@/components/home/hero-slide'

const INTERVAL = 2500
const SLIDE_EASE = 'cubic-bezier(0.77, 0, 0.175, 1)'

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

  const n = shows.length

  return (
    <div
      className="relative mb-3 overflow-hidden h-[78vh] min-h-[480px] md:min-h-[580px]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={handleBlur}
    >
      {/* Track — all slides side-by-side, pure translateX on advance */}
      <div
        style={{
          display: 'flex',
          width: `${n * 100}%`,
          height: '100%',
          transform: `translateX(-${(activeIndex / n) * 100}%)`,
          transition: shouldReduceMotion ? 'none' : `transform 0.6s ${SLIDE_EASE}`,
        }}
      >
        {shows.map(({ show, firstEpisodeId }) => (
          <div
            key={show.id}
            style={{ position: 'relative', width: `${100 / n}%`, flexShrink: 0, height: '100%' }}
          >
            <HeroSlide
              show={show}
              firstEpisodeId={firstEpisodeId}
              isActive={true}
              isMobile={isMobile}
              reducedMotion={shouldReduceMotion ?? false}
            />
          </div>
        ))}
      </div>

      <div className="sr-only" aria-live="polite">
        Now showing: {shows[activeIndex].show.title}
      </div>
    </div>
  )
}
