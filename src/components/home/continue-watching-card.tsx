'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Play } from 'lucide-react'
import { ShowArt } from '@/components/primitives/show-art'
import type { ContinueWatchingItem } from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'

interface ContinueWatchingCardProps {
  item: ContinueWatchingItem
}

export function ContinueWatchingCard({ item }: ContinueWatchingCardProps) {
  const brandHex = BRAND_COLOR_HEX[item.showBrandColor] ?? '#2C3569'
  const thumbnailUrl = item.youtubeVideoId
    ? `https://img.youtube.com/vi/${item.youtubeVideoId}/hqdefault.jpg`
    : null

  return (
    <Link href={`/watch/${item.episodeId}`} className="group block basis-[320px] flex-shrink-0">
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={item.episodeTitle}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="320px"
          />
        ) : (
          <ShowArt brandColor={brandHex} title={item.episodeTitle} aspectRatio="16/9">
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-3xl font-black text-white/30"
                style={{ textShadow: `0 0 24px ${brandHex}60` }}
              >
                E{item.episodeNumber}
              </span>
            </div>
          </ShowArt>
        )}

        {/* Hover play icon — glass-morph circle */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="flex size-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
            <Play className="size-5 fill-white text-white" />
          </div>
        </div>

        {/* Progress bar — thin, at very bottom of thumbnail, no gap */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${item.progressPercent}%`,
              backgroundColor: brandHex,
            }}
          />
        </div>
      </div>

      {/* Metadata — tighter */}
      <div className="mt-2 flex flex-col gap-0.5">
        <span className="text-xs text-white/50">
          {item.showTitle} &middot; S{item.seasonNumber} E{item.episodeNumber}
        </span>
        <span className="truncate text-sm font-semibold text-white">
          {item.episodeTitle}
        </span>
      </div>
    </Link>
  )
}
