// Hero banner — matches handoff .hero (78vh, vertical dots on right)
'use client'

import { useState, useEffect, useMemo } from 'react'

import type { ViewShow } from '@/lib/queries'
import { HeroSlide } from '@/components/home/hero-slide'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'

const INTERVAL = 3000
const SLIDE_DURATION = 600
const SLIDE_EASE = 'cubic-bezier(0.77, 0, 0.175, 1)'

interface HeroBannerProps {
  shows: Array<{
    show: ViewShow
    firstEpisodeId?: string
    hasWatched?: boolean
  }>
  isMobile?: boolean
}

export function HeroBanner({ shows, isMobile }: HeroBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const shouldReduceMotion = usePrefersReducedMotion()

  const n = shows.length
  // Clone first slide at end — seamless infinite forward loop
  const extShows = useMemo(() => [...shows, shows[0]], [shows])

  useEffect(() => {
    if (isPaused || shouldReduceMotion) return
    const timer = setInterval(() => {
      setActiveIndex((prev) => prev + 1)
    }, INTERVAL)
    return () => clearInterval(timer)
  }, [isPaused, shouldReduceMotion])

  // After landing on the clone (index n), jump back to real index 0 with no transition
  useEffect(() => {
    if (activeIndex < n) return
    const id = setTimeout(() => {
      setIsResetting(true)
      setActiveIndex(0)
    }, SLIDE_DURATION + 20)
    return () => clearTimeout(id)
  }, [activeIndex, n])

  // Re-enable transition two frames after the instant reset so no visual jump fires
  useEffect(() => {
    if (!isResetting) return
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setIsResetting(false))
    )
    return () => cancelAnimationFrame(raf)
  }, [isResetting])

  return (
    <div className="relative mb-3 h-[78vh] min-h-[480px] overflow-hidden md:min-h-[580px]">
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translateX(-${activeIndex * 100}%)`,
          transition:
            isResetting || shouldReduceMotion
              ? 'none'
              : `transform 0.6s ${SLIDE_EASE}`,
        }}
      >
        {extShows.map(({ show, firstEpisodeId, hasWatched }, i) => (
          <div
            key={`${show.id}-${i}`}
            style={{
              position: 'absolute',
              top: 0,
              left: `${i * 100}%`,
              width: '100%',
              height: '100%',
            }}
          >
            <HeroSlide
              show={show}
              firstEpisodeId={firstEpisodeId}
              hasWatched={hasWatched}
              isActive={i === activeIndex}
              priority={i === 0}
              isMobile={isMobile}
              reducedMotion={shouldReduceMotion}
              onContentHoverChange={setIsPaused}
            />
          </div>
        ))}
      </div>

      <div className="sr-only" aria-live="polite">
        Now showing: {shows[activeIndex % n].show.title}
      </div>
    </div>
  )
}
