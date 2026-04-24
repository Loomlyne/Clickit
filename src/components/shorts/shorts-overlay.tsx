'use client'

import { useState, useEffect, useRef } from 'react'
import type { ViewShow } from '@/lib/queries'

interface ShortsOverlayProps {
  shows: ViewShow[]
  startIndex?: number
  onClose: () => void
}

export function ShortsOverlay({ shows, startIndex = 0, onClose }: ShortsOverlayProps) {
  const [idx, setIdx] = useState(startIndex)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [liked, setLiked] = useState<Set<string>>(new Set())
  const touchStart = useRef<number | null>(null)

  const current = shows[idx]
  const hasPrev = idx > 0
  const hasNext = idx < shows.length - 1

  // Auto-advance progress (mocked 20s short)
  useEffect(() => {
    setProgress(0)
    if (paused) return
    let raf: number
    const start = performance.now()
    const tick = (t: number) => {
      const elapsed = (t - start) / 1000
      const p = Math.min(elapsed / 20, 1)
      setProgress(p)
      if (p >= 1) {
        if (hasNext) setIdx((i) => i + 1)
      } else {
        raf = requestAnimationFrame(tick)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [idx, paused, hasNext])

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if ((e.key === 'ArrowDown' || e.key === 'ArrowRight') && hasNext) setIdx((i) => i + 1)
      else if ((e.key === 'ArrowUp' || e.key === 'ArrowLeft') && hasPrev) setIdx((i) => i - 1)
      else if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p) }
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
        style={{ backgroundImage: `url(${current.posterUrl || ''})` }}
      />
      <div className="absolute inset-0 bg-black/80" />

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="mono text-[10px] px-2 py-0.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-sm">SHORTS</span>
          <span className="mono text-[var(--text-dim)]">{idx + 1} / {shows.length}</span>
        </div>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line-2)] text-[var(--text)] transition-colors hover:bg-white/10"
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>

      {/* Prev peek */}
      {hasPrev && (
        <button
          className="absolute top-20 left-1/2 -translate-x-1/2 hidden md:flex items-center gap-2 opacity-40 hover:opacity-70 transition-opacity"
          onClick={() => setIdx((i) => i - 1)}
          aria-label="Previous short"
        >
          <span className="mono text-[10px]">↑ Prev · {shows[idx - 1].title}</span>
        </button>
      )}

      {/* Main card */}
      <div
        className="relative w-full max-w-[380px] overflow-hidden rounded-[14px] shadow-[0_40px_120px_rgba(0,0,0,0.6)]"
        style={{ aspectRatio: '9/16' }}
        onClick={() => setPaused((p) => !p)}
      >
        {/* Segmented progress bar */}
        <div className="absolute top-2 inset-x-2 z-10 flex gap-1">
          {shows.map((_, i) => (
            <div key={i} className="flex-1 h-[3px] rounded-full bg-white/20 overflow-hidden">
              <span
                className="block h-full bg-white/90 rounded-full"
                style={{ width: i < idx ? '100%' : i === idx ? `${progress * 100}%` : '0%' }}
              />
            </div>
          ))}
        </div>

        {/* Video (poster image) */}
        {current.posterUrl ? (
          <img src={current.posterUrl} alt={current.title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-[var(--bg-2)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {/* Pause indicator */}
        {paused && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/40 text-white">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3" /></svg>
            </div>
          </div>
        )}

        {/* Bottom info */}
        <div className="absolute bottom-4 left-4 right-16 z-10">
          <div className="flex items-center gap-2.5 mb-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-medium text-white"
              style={{ background: current.brandColor ? `var(--color-brand-${current.brandColor}-safe)` : 'var(--bg-3)' }}
            >
              {current.title.charAt(0)}
            </div>
            <span className="mono text-[11px] text-white/80">@{current.title.toLowerCase().replace(/[^a-z]/g, '').slice(0, 14)}</span>
            <button className="mono text-[10px] px-2 py-0.5 border border-white/30 rounded text-white/80 hover:bg-white/10">
              Follow
            </button>
          </div>
          <div className="font-[family-name:var(--font-display)] text-[16px] leading-tight mb-1 text-white">{current.title}</div>
          <div className="text-[13px] text-white/60">{current.tagline}</div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="mono text-[10px] text-white/50">{current.genre}</span>
            <span className="inline-block h-1 w-1 rounded-full bg-white/30" />
            <span className="mono text-[10px] text-white/50">{Math.floor(200 + idx * 137) % 900}K views</span>
          </div>
        </div>

        {/* Right action rail */}
        <div className="absolute bottom-20 right-3 z-10 flex flex-col items-center gap-5">
          <button className={`flex flex-col items-center gap-1 ${isLiked ? 'text-red-500' : 'text-white/80'}`} onClick={(e) => { e.stopPropagation(); toggleLike() }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
            <span className="mono text-[9px]">{isLiked ? 'Liked' : `${Math.floor(5 + idx * 13)}K`}</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-white/80" onClick={(e) => e.stopPropagation()}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            <span className="mono text-[9px]">List</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-white/80" onClick={(e) => e.stopPropagation()}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            <span className="mono text-[9px]">{Math.floor(1 + idx * 3)}K</span>
          </button>
        </div>
      </div>

      {/* Next peek */}
      {hasNext && (
        <button
          className="absolute bottom-20 left-1/2 -translate-x-1/2 hidden md:flex items-center gap-2 opacity-40 hover:opacity-70 transition-opacity"
          onClick={() => setIdx((i) => i + 1)}
          aria-label="Next short"
        >
          <span className="mono text-[10px]">↓ Next · {shows[idx + 1].title}</span>
        </button>
      )}

      {/* Swipe hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 mono text-[10px] text-white/30">
        Swipe · Arrow keys · Esc to close
      </div>
    </div>
  )
}
