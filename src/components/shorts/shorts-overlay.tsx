'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import type { ViewShort } from '@/lib/queries'

interface ShortsOverlayProps {
  shorts: ViewShort[]
  startIndex?: number
  onClose: () => void
}

export function ShortsOverlay({ shorts, startIndex = 0, onClose }: ShortsOverlayProps) {
  const [idx, setIdx] = useState(startIndex)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(true)
  const [progress, setProgress] = useState(0)
  const touchStart = useRef<number | null>(null)

  const current = shorts[idx]
  const hasPrev = idx > 0
  const hasNext = idx < shorts.length - 1
  const goPrev = () => setIdx((i) => i - 1)
  const goNext = () => setIdx((i) => i + 1)

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if ((e.key === 'ArrowDown' || e.key === 'ArrowRight') && hasNext) goNext()
      else if ((e.key === 'ArrowUp' || e.key === 'ArrowLeft') && hasPrev) goPrev()
      else if (e.key === ' ') {
        e.preventDefault()
        setPaused((value) => !value)
      } else if (e.key.toLowerCase() === 'm') {
        setMuted((value) => !value)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasNext, hasPrev, onClose])

  useEffect(() => {
    setProgress(0)
  }, [idx])

  useEffect(() => {
    if (paused) return
    const timer = window.setInterval(() => {
      setProgress((value) => {
        if (value >= 100) {
          if (hasNext) goNext()
          return 0
        }
        return value + 0.5
      })
    }, 100)
    return () => window.clearInterval(timer)
  }, [hasNext, paused])

  // Lock body scroll
  useEffect(() => {
    const { body, documentElement } = document
    const scrollY = window.scrollY
    const prevBodyOverflow = body.style.overflow
    const prevBodyPosition = body.style.position
    const prevBodyTop = body.style.top
    const prevBodyWidth = body.style.width
    const prevHtmlOverflow = documentElement.style.overflow
    const prevHtmlOverscroll = documentElement.style.overscrollBehavior
    const prevBodyOverscroll = body.style.overscrollBehavior

    documentElement.style.overflow = 'hidden'
    documentElement.style.overscrollBehavior = 'none'
    body.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'

    return () => {
      documentElement.style.overflow = prevHtmlOverflow
      documentElement.style.overscrollBehavior = prevHtmlOverscroll
      body.style.overflow = prevBodyOverflow
      body.style.overscrollBehavior = prevBodyOverscroll
      body.style.position = prevBodyPosition
      body.style.top = prevBodyTop
      body.style.width = prevBodyWidth
      window.scrollTo(0, scrollY)
    }
  }, [])

  // Touch swipe
  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientY }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current == null) return
    const dy = e.changedTouches[0].clientY - touchStart.current
    if (Math.abs(dy) > 60) {
      if (dy < 0 && hasNext) goNext()
      if (dy > 0 && hasPrev) goPrev()
    }
    touchStart.current = null
  }

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Ambient backdrop */}
      <div
        className="absolute inset-0 bg-cover bg-center blur-[60px] scale-110 opacity-30"
        style={{ backgroundImage: current.thumbnailUrl ? `url(${current.thumbnailUrl})` : undefined }}
      />
      <div className="absolute inset-0 bg-black/80" />

      {/* Pre-warm adjacent shorts so arrow/swipe navigation is instant.
          Hidden offscreen iframes load YouTube player JS + initial chunks
          for prev/next videos while the user watches the current one. */}
      <div aria-hidden className="pointer-events-none fixed top-0 left-0 h-px w-px overflow-hidden opacity-0">
        {hasPrev && (
          <iframe
            key={`prewarm-prev-${shorts[idx - 1].youtubeVideoId}`}
            src={`https://www.youtube.com/embed/${shorts[idx - 1].youtubeVideoId}?autoplay=0&controls=1&mute=1&playsinline=1`}
            tabIndex={-1}
            title=""
          />
        )}
        {hasNext && (
          <iframe
            key={`prewarm-next-${shorts[idx + 1].youtubeVideoId}`}
            src={`https://www.youtube.com/embed/${shorts[idx + 1].youtubeVideoId}?autoplay=0&controls=1&mute=1&playsinline=1`}
            tabIndex={-1}
            title=""
          />
        )}
      </div>

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-6 pb-4 pt-[max(env(safe-area-inset-top),16px)]">
        <div className="flex items-center gap-3">
          <span className="mono text-[10px] px-2 py-0.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-sm">SHORTS</span>
          <span className="mono text-[var(--text-dim)]">{idx + 1} / {shorts.length}</span>
        </div>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line-2)] text-[var(--text)] transition-colors hover:bg-white/10"
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>

      <div className="absolute left-4 right-4 top-[calc(max(env(safe-area-inset-top),16px)+52px)] z-10 flex gap-1 md:left-8 md:right-8">
        {shorts.map((s, i) => (
          <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/18">
            <div
              className="h-full bg-[var(--primary)] transition-[width] duration-100"
              style={{ width: `${i < idx ? 100 : i === idx ? progress : 0}%` }}
            />
          </div>
        ))}
      </div>

      {/* Prev arrow — desktop only */}
      {hasPrev && (
        <button
          className="absolute left-6 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--line-2)] bg-black/40 text-white/80 backdrop-blur-md transition-all duration-200 hover:scale-110 hover:border-white/40 hover:bg-white/10 hover:text-white lg:left-10 lg:flex"
          onClick={goPrev}
          aria-label="Previous short"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
      )}

      {/* Main card — YouTube Short embed */}
      <div className="flex w-full max-w-[380px] flex-col items-center gap-3 px-4 lg:px-0">
        <div
          className="relative w-full overflow-hidden rounded-[8px] shadow-[0_40px_120px_rgba(0,0,0,0.6)]"
          style={{ aspectRatio: '9/16' }}
        >
          <iframe
            key={current.youtubeVideoId}
            src={`https://www.youtube.com/embed/${current.youtubeVideoId}?autoplay=1&loop=1&playlist=${current.youtubeVideoId}&controls=1&modestbranding=1&rel=0&playsinline=1&mute=${muted ? 1 : 0}&iv_load_policy=3`}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            title={current.title}
          />

          {hasPrev && (
            <button
              type="button"
              className="absolute inset-y-0 left-0 z-20 w-1/3 bg-transparent"
              onClick={goPrev}
              aria-label="Previous short"
            >
              <span className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-black/35 text-white/75 opacity-0 backdrop-blur-md transition-opacity hover:opacity-100 lg:left-4">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </span>
            </button>
          )}

          {hasNext && (
            <button
              type="button"
              className="absolute inset-y-0 right-0 z-20 w-1/3 bg-transparent"
              onClick={goNext}
              aria-label="Next short"
            >
              <span className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-black/35 text-white/75 opacity-0 backdrop-blur-md transition-opacity hover:opacity-100 lg:right-4">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
              </span>
            </button>
          )}

          <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-8 bg-gradient-to-l from-black/55 to-transparent" />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 h-12 bg-gradient-to-t from-black/72 to-transparent" />

          {/* Bottom info overlay */}
          <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-10">
            <div className="mb-2 flex items-center gap-2.5">
              <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[var(--bg-3)] text-[11px] font-medium text-white">
                {current.thumbnailUrl ? (
                  <Image
                    src={current.thumbnailUrl}
                    alt=""
                    fill
                    sizes="32px"
                    className="object-cover opacity-80"
                  />
                ) : (
                  current.title.charAt(0)
                )}
              </div>
              <span className="mono text-[11px] text-white/80">
                {current.channelName || current.title.toLowerCase().replace(/[^a-z]/g, '').slice(0, 14)}
              </span>
              <button className="pointer-events-auto rounded-[8px] bg-white px-2 py-1 text-[10px] font-medium text-black">
                Follow
              </button>
            </div>
            <div className="mb-1 font-[family-name:var(--font-display)] text-[16px] leading-tight text-white drop-shadow-lg">{current.title}</div>
            {current.genre && (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="mono text-[10px] text-white/50">{current.genre}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Next arrow — desktop only */}
      {hasNext && (
        <button
          className="absolute right-6 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--line-2)] bg-black/40 text-white/80 backdrop-blur-md transition-all duration-200 hover:scale-110 hover:border-white/40 hover:bg-white/10 hover:text-white lg:right-10 lg:flex"
          onClick={goNext}
          aria-label="Next short"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      )}

      {/* Hint — adapts to viewport */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 mono text-[10px] text-white/30">
        <span className="lg:hidden">Swipe or use buttons</span>
        <span className="hidden lg:inline">Arrows · Space · M · Esc</span>
      </div>
    </div>
  )
}
