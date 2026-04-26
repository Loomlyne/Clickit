'use client'

import { useState, useEffect, useRef } from 'react'
import type { ViewShort } from '@/lib/queries'

interface ShortsOverlayProps {
  shorts: ViewShort[]
  startIndex?: number
  onClose: () => void
}

export function ShortsOverlay({ shorts, startIndex = 0, onClose }: ShortsOverlayProps) {
  const [idx, setIdx] = useState(startIndex)
  const [liked, setLiked] = useState<Set<string>>(new Set())
  const touchStart = useRef<number | null>(null)

  const current = shorts[idx]
  const hasPrev = idx > 0
  const hasNext = idx < shorts.length - 1

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if ((e.key === 'ArrowDown' || e.key === 'ArrowRight') && hasNext) setIdx((i) => i + 1)
      else if ((e.key === 'ArrowUp' || e.key === 'ArrowLeft') && hasPrev) setIdx((i) => i - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasNext, hasPrev, onClose])

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Touch swipe
  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientY }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current == null) return
    const dy = e.changedTouches[0].clientY - touchStart.current
    if (Math.abs(dy) > 60) {
      if (dy < 0 && hasNext) setIdx((i) => i + 1)
      if (dy > 0 && hasPrev) setIdx((i) => i - 1)
    }
    touchStart.current = null
  }

  const toggleLike = () => {
    setLiked((s) => {
      const n = new Set(s)
      if (n.has(current.id)) n.delete(current.id); else n.add(current.id)
      return n
    })
  }

  const isLiked = liked.has(current.id)

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
            src={`https://www.youtube.com/embed/${shorts[idx - 1].youtubeVideoId}?autoplay=0&controls=0&mute=1&playsinline=1`}
            tabIndex={-1}
            title=""
          />
        )}
        {hasNext && (
          <iframe
            key={`prewarm-next-${shorts[idx + 1].youtubeVideoId}`}
            src={`https://www.youtube.com/embed/${shorts[idx + 1].youtubeVideoId}?autoplay=0&controls=0&mute=1&playsinline=1`}
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

      {/* Prev arrow — desktop only */}
      {hasPrev && (
        <button
          className="absolute left-6 lg:left-10 top-1/2 -translate-y-1/2 z-20 hidden md:flex h-12 w-12 items-center justify-center rounded-full border border-[var(--line-2)] bg-black/40 text-white/80 backdrop-blur-md transition-all duration-200 hover:bg-white/10 hover:text-white hover:scale-110 hover:border-white/40"
          onClick={() => setIdx((i) => i - 1)}
          aria-label="Previous short"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
      )}

      {/* Main card — YouTube Short embed */}
      <div
        className="relative w-full max-w-[380px] overflow-hidden rounded-[14px] shadow-[0_40px_120px_rgba(0,0,0,0.6)]"
        style={{ aspectRatio: '9/16' }}
      >
        <iframe
          key={current.youtubeVideoId}
          src={`https://www.youtube.com/embed/${current.youtubeVideoId}?autoplay=1&loop=1&playlist=${current.youtubeVideoId}&controls=0&modestbranding=1&rel=0&playsinline=1`}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; encrypted-media"
          allowFullScreen
          title={current.title}
        />

        {/* Bottom info overlay */}
        <div className="absolute bottom-4 left-4 right-16 z-10 pointer-events-none">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-3)] text-[11px] font-medium text-white">
              {current.title.charAt(0)}
            </div>
            <span className="mono text-[11px] text-white/80">
              {current.channelName || current.title.toLowerCase().replace(/[^a-z]/g, '').slice(0, 14)}
            </span>
          </div>
          <div className="font-[family-name:var(--font-display)] text-[16px] leading-tight mb-1 text-white drop-shadow-lg">{current.title}</div>
          {current.genre && (
            <div className="flex items-center gap-2 mt-1.5">
              <span className="mono text-[10px] text-white/50">{current.genre}</span>
            </div>
          )}
        </div>

        {/* Right action rail */}
        <div className="absolute bottom-20 right-3 z-10 flex flex-col items-center gap-5">
          <button className={`flex flex-col items-center gap-1 ${isLiked ? 'text-red-500' : 'text-white/80'}`} onClick={toggleLike}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
            <span className="mono text-[9px]">{isLiked ? 'Liked' : 'Like'}</span>
          </button>
        </div>
      </div>

      {/* Next arrow — desktop only */}
      {hasNext && (
        <button
          className="absolute right-6 lg:right-10 top-1/2 -translate-y-1/2 z-20 hidden md:flex h-12 w-12 items-center justify-center rounded-full border border-[var(--line-2)] bg-black/40 text-white/80 backdrop-blur-md transition-all duration-200 hover:bg-white/10 hover:text-white hover:scale-110 hover:border-white/40"
          onClick={() => setIdx((i) => i + 1)}
          aria-label="Next short"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      )}

      {/* Hint — adapts to viewport */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 mono text-[10px] text-white/30">
        <span className="md:hidden">Swipe · Tap to close</span>
        <span className="hidden md:inline">Arrows · ← → keys · Esc to close</span>
      </div>
    </div>
  )
}
