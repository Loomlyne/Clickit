// Shorts rail — Quick Bites section on browse page
'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import type { ViewShort } from '@/lib/queries'
import { DragScroll } from '@/components/primitives/drag-scroll'
import { ShortsOverlay } from '@/components/shorts/shorts-overlay'

interface ShortsRailProps {
  shorts: ViewShort[]
}

export function ShortsRail({ shorts }: ShortsRailProps) {
  const t = useTranslations('watch')
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
    short.thumbnailUrl ||
    `https://i.ytimg.com/vi/${short.youtubeVideoId}/hq720.jpg`

  return (
    <>
      {/* Warm YouTube CDNs as soon as the rail mounts — React 19 hoists to <head> */}
      <link rel="preconnect" href="https://www.youtube.com" />
      <link rel="preconnect" href="https://i.ytimg.com" />
      <link rel="preconnect" href="https://s.ytimg.com" />
      <link rel="dns-prefetch" href="https://googlevideo.com" />
      <section className="rail px-10 pt-8 pb-3">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display m-0 text-[26px] font-bold tracking-[0.04em] uppercase">
              {t('shortClickHeading')}
            </h2>
          </div>
        </div>

        <DragScroll className="scrollbar-hide -mx-1 flex gap-5 overflow-x-auto px-1 pt-1 pb-3">
          {shorts.map((s, i) => (
            <button
              type="button"
              key={s.id}
              onClick={() => setOverlayIdx(i)}
              onMouseEnter={() => prefetchShort(s.youtubeVideoId)}
              onTouchStart={() => prefetchShort(s.youtubeVideoId)}
              className="group focus-visible:ring-ring relative block shrink-0 cursor-pointer overflow-hidden rounded-media bg-[var(--bg-2)] text-start focus-visible:ring-2 focus-visible:outline-none"
              style={{ width: 180, aspectRatio: '9/16' }}
            >
              {getThumbnailUrl(s) ? (
                <Image
                  src={getThumbnailUrl(s)}
                  alt=""
                  fill
                  sizes="180px"
                  className="object-cover"
                />
              ) : (
                <span className="block h-full w-full bg-[var(--bg-2)]" />
              )}
              <span className="absolute inset-0 bg-gradient-to-b from-transparent from-[50%] to-[rgba(0,0,0,0.9)]" />
              {/* SHORT badge */}
              <span className="absolute start-2.5 top-2.5 rounded-full bg-[var(--uis-primary-soft)] px-2.5 py-[3px] text-[11px] tracking-[0.08em] text-[var(--primary)]">
                {t('shortBadge')}
              </span>
              {/* Bottom info */}
              <span className="absolute inset-x-3 bottom-3 block">
                <span className="font-display mb-1 block text-[16px] leading-[1.15]">
                  {s.title}
                </span>
                <span className="mono block">
                  {s.channelName || s.genre || t('shortFallback')}
                  {s.durationSeconds ? ` · ${s.durationSeconds}s` : ''}
                </span>
              </span>
            </button>
          ))}
        </DragScroll>
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
