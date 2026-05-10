'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import type { ViewShort } from '@/lib/queries'
import { ShortsOverlay } from '@/components/shorts/shorts-overlay'

export function FeaturedShortsGrid({ shorts }: { shorts: ViewShort[] }) {
  const [overlayIdx, setOverlayIdx] = useState<number | null>(null)
  const prefetched = useRef<Set<string>>(new Set())

  if (shorts.length === 0) return null

  const prefetchShort = (videoId: string) => {
    if (!videoId || prefetched.current.has(videoId)) return
    prefetched.current.add(videoId)
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.as = 'document'
    link.href = `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&controls=1&modestbranding=1&rel=0&playsinline=1`
    document.head.appendChild(link)
  }

  const thumb = (s: ViewShort) =>
    s.thumbnailUrl || `https://i.ytimg.com/vi/${s.youtubeVideoId}/hq720.jpg`

  return (
    <>
      <link rel="preconnect" href="https://www.youtube.com" />
      <link rel="preconnect" href="https://i.ytimg.com" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
        {shorts.map((s, i) => (
          <div
            key={s.id}
            onClick={() => setOverlayIdx(i)}
            onMouseEnter={() => prefetchShort(s.youtubeVideoId)}
            onTouchStart={() => prefetchShort(s.youtubeVideoId)}
            className="group relative cursor-pointer overflow-hidden rounded-[20px] bg-[var(--bg-2)]"
            style={{ aspectRatio: '9/16' }}
          >
            <Image
              src={thumb(s)}
              alt={s.title}
              fill
              sizes="(max-width: 767px) 50vw, 25vw"
              className="object-cover transition-transform duration-400 ease-[var(--ease)] group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent from-40% to-black/85" />

            {/* SHORT badge */}
            <div
              className="absolute left-2.5 top-2.5 rounded-sm px-1.5 py-0.5 text-[9px] font-semibold tracking-widest"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              SHORT
            </div>

            {/* Genre */}
            {s.genre && (
              <div className="absolute left-2.5 bottom-12 mono text-[10px] text-white/50">
                {s.genre}
              </div>
            )}

            {/* Title + channel */}
            <div className="absolute bottom-3 left-2.5 right-2.5">
              <div className="font-[family-name:var(--font-display)] text-[15px] leading-tight line-clamp-2 mb-0.5">
                {s.title}
              </div>
              {s.channelName && (
                <div className="mono text-[10px] text-white/50">{s.channelName}</div>
              )}
            </div>
          </div>
        ))}
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
