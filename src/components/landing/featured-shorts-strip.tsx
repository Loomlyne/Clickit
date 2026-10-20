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
            className="group relative cursor-pointer overflow-hidden rounded-[var(--uis-r-media)] bg-[var(--bg-2)]"
            style={{ aspectRatio: '9/16' }}
          >
            <Image
              src={thumb(s)}
              alt={s.title}
              fill
              sizes="(max-width: 767px) 50vw, 25vw"
              className="object-cover transition-transform duration-400 ease-[var(--ease)] group-hover:scale-105"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent from-40% to-black/85" />

            {/* Short badge */}
            <div className="absolute top-2.5 left-2.5 rounded-full bg-[var(--uis-primary-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--primary)]">
              Short
            </div>

            {/* Genre */}
            {s.genre && (
              <div className="mono absolute bottom-12 left-2.5 text-[11px] text-[var(--text-dim)]">
                {s.genre}
              </div>
            )}

            {/* Title + channel */}
            <div className="absolute right-2.5 bottom-3 left-2.5">
              <div className="mb-0.5 line-clamp-2 font-[family-name:var(--font-display)] text-[14px] leading-tight md:text-[16px]">
                {s.title}
              </div>
              {s.channelName && (
                <div className="mono text-[11px] text-[var(--text-dim)]">
                  {s.channelName}
                </div>
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
