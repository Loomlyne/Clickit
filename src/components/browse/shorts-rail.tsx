// Shorts rail — Quick Bites section on browse page
'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import type { ViewShort } from '@/lib/queries'
import { ShortsOverlay } from '@/components/shorts/shorts-overlay'

interface ShortsRailProps {
  shorts: ViewShort[]
}

export function ShortsRail({ shorts }: ShortsRailProps) {
  const [overlayIdx, setOverlayIdx] = useState<number | null>(null)
  // Track which video IDs we've already pre-warmed so hover doesn't spam.
  const prefetched = useRef<Set<string>>(new Set())

  if (shorts.length === 0) return null

  // Hover-intent prefetch: append a hidden <link rel="prefetch"> to <head>.
  // The browser fetches the embed HTML at low priority — when the user clicks,
  // the iframe boots from HTTP cache instead of cold network.
  const prefetchShort = (videoId: string) => {
    if (!videoId || prefetched.current.has(videoId)) return
    prefetched.current.add(videoId)
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.as = 'document'
    link.href = `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&controls=0&modestbranding=1&rel=0&playsinline=1`
    document.head.appendChild(link)
  }

  const getThumbnailUrl = (short: ViewShort) =>
    short.thumbnailUrl || `https://i.ytimg.com/vi/${short.youtubeVideoId}/hq720.jpg`

  return (
    <>
      {/* Warm YouTube CDNs as soon as the rail mounts — React 19 hoists to <head> */}
      <link rel="preconnect" href="https://www.youtube.com" />
      <link rel="preconnect" href="https://i.ytimg.com" />
      <link rel="preconnect" href="https://s.ytimg.com" />
      <link rel="dns-prefetch" href="https://googlevideo.com" />
      <section className="rail px-10 pb-3 pt-8">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="mono mb-1.5" style={{ color: 'var(--accent)' }}>Shorts · Connected to YouTube Shorts</div>
            <h2 className="font-display m-0 text-[26px]">Quick bites</h2>
          </div>
          <button className="mono inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 hover:text-[var(--text)]">
            View all <ArrowRight className="size-3" />
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
          {shorts.map((s, i) => (
            <div
              key={s.id}
              onClick={() => setOverlayIdx(i)}
              onMouseEnter={() => prefetchShort(s.youtubeVideoId)}
              onTouchStart={() => prefetchShort(s.youtubeVideoId)}
              className="group relative shrink-0 cursor-pointer overflow-hidden rounded-[16px] bg-[var(--bg-2)]"
              style={{ width: 180, aspectRatio: '9/16' }}
            >
              {getThumbnailUrl(s) ? (
                <Image
                  src={getThumbnailUrl(s)}
                  alt={s.title}
                  fill
                  sizes="180px"
                  className="object-cover"
                />
              ) : (
                <div className="h-full w-full bg-[var(--bg-2)]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent from-[50%] to-[rgba(0,0,0,0.9)]" />
              {/* SHORT badge */}
              <div
                className="absolute left-2.5 top-2.5 rounded-[4px] px-1.5 py-[3px]"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.14em',
                  background: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                SHORT
              </div>
              {/* Bottom info */}
              <div className="absolute bottom-3 left-3 right-3">
                <div className="font-display mb-1 text-[16px] leading-[1.15]">{s.title}</div>
                <div className="mono" style={{ fontSize: 9 }}>
                  {s.channelName || s.genre || 'Short'}
                  {s.durationSeconds ? ` · ${s.durationSeconds}s` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

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
