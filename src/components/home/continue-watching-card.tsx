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
    <Link href={`/watch/${item.episodeId}`} className="group block basis-[340px] flex-shrink-0">
      <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="relative aspect-video w-full overflow-hidden">
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt={item.episodeTitle}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="340px"
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

          <div className="absolute inset-0 bg-gradient-to-t from-[#06070a] via-[#06070a]/25 to-transparent" />

          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div className="flex size-12 items-center justify-center rounded-full border border-white/16 bg-[rgba(8,11,18,0.76)] backdrop-blur-md">
              <Play className="size-5 fill-white text-white" />
            </div>
          </div>

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
        <div className="space-y-2 px-4 py-4">
          <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/36">
            Continue watching
          </span>
          <div className="space-y-1">
            <p className="truncate text-sm text-white/52">
              {item.showTitle} · S{item.seasonNumber} E{item.episodeNumber}
            </p>
            <p className="truncate text-[17px] font-semibold tracking-[-0.02em] text-white">
              {item.episodeTitle}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}
