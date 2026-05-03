'use client'

import { useState, useRef } from 'react'
import type { ViewShort } from '@/lib/queries'
import { ShortsOverlay } from '@/components/shorts/shorts-overlay'

export function FeaturedShortsStrip({ shorts }: { shorts: ViewShort[] }) {
  const [overlayIdx, setOverlayIdx] = useState<number | null>(null)
  const prefetched = useRef<Set<string>>(new Set())

  if (shorts.length === 0) return null

  const prefetchShort = (videoId: string) => {
    if (!videoId || prefetched.current.has(videoId)) return
    prefetched.current.add(videoId)
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.as = 'document'
    link.href = `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&controls=0&modestbranding=1&rel=0&playsinline=1`
    document.head.appendChild(link)
  }

  const thumb = (s: ViewShort) =>
    s.thumbnailUrl || `https://i.ytimg.com/vi/${s.youtubeVideoId}/hq720.jpg`

  return (
    <>
      <link rel="preconnect" href="https://www.youtube.com" />
      <link rel="preconnect" href="https://i.ytimg.com" />

      <div className="mt-10 border-t border-[var(--line)] pt-8">
        <div className="mono mb-5 text-[var(--text-mute)]">Featured shorts</div>
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {shorts.map((s, i) => (
            <div
              key={s.id}
              onClick={() => setOverlayIdx(i)}
              onMouseEnter={() => prefetchShort(s.youtubeVideoId)}
              onTouchStart={() => prefetchShort(s.youtubeVideoId)}
              className="group relative shrink-0 cursor-pointer overflow-hidden rounded bg-[var(--bg-2)]"
              style={{ width: 120, aspectRatio: '9/16' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumb(s)}
                alt={s.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent from-50% to-black/80" />
              <div
                className="absolute left-2 top-2 rounded-sm px-1 py-0.5 text-[8px] font-semibold tracking-widest"
                style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                SHORT
              </div>
              <div className="absolute bottom-2 left-2 right-2">
                <div className="text-[11px] font-medium leading-tight line-clamp-2">{s.title}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {overlayIdx !== null && (
        <ShortsOverlay
          shorts={shorts}
          startIndex={overlayIdx}
          onClose={() => setOverlayIdx(null)}
        />
      )}
    </>
  )
}
