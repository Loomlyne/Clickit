'use client'

import Link from 'next/link'
import { ShowArt } from '@/components/primitives/show-art'
import type { ContinueWatchingItem } from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'

interface ContinueWatchingCardProps {
  item: ContinueWatchingItem
}

export function ContinueWatchingCard({ item }: ContinueWatchingCardProps) {
  const brandHex = BRAND_COLOR_HEX[item.showBrandColor] ?? '#2C3569'

  return (
    <Link href={`/watch/${item.episodeId}`} className="group block basis-[320px] flex-shrink-0">
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl">
        <ShowArt brandColor={brandHex} title={item.episodeTitle} aspectRatio="16/9">
          {/* Episode number watermark */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-3xl font-black text-white/30"
              style={{ textShadow: `0 0 24px ${brandHex}60` }}
            >
              E{item.episodeNumber}
            </span>
          </div>
        </ShowArt>

        {/* Progress percent badge - bottom left */}
        <span className="absolute bottom-2 left-2 text-[11px] text-white/60">
          {item.progressPercent}%
        </span>

        {/* Resume CTA pill - bottom right, on hover */}
        <span className="absolute bottom-2 right-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          Resume
        </span>
      </div>

      {/* Metadata */}
      <div className="mt-3 flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-white/50">
          {item.showTitle}
        </span>
        <span className="text-sm font-semibold text-white">
          S{item.seasonNumber} E{item.episodeNumber}
        </span>
        <span className="truncate text-sm text-white/70">
          {item.episodeTitle}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${item.progressPercent}%`,
            backgroundColor: brandHex,
          }}
        />
      </div>
    </Link>
  )
}
