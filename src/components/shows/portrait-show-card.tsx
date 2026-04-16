'use client'

import Link from 'next/link'

import { ShowArt } from '@/components/primitives/show-art'
import { WatchlistToggleButton } from '@/components/watchlist/watchlist-toggle-button'
import type { ViewShow } from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'

interface PortraitShowCardProps {
  show: ViewShow
  initialSaved?: boolean
  userId?: string | null
}

export function PortraitShowCard({ show, initialSaved, userId }: PortraitShowCardProps) {
  const brandColorHex = BRAND_COLOR_HEX[show.brandColor]

  return (
    <div className="group">
      <div className="overflow-hidden border border-[#1A1C23] bg-[#0F1115]">
        {userId !== undefined && (
          <WatchlistToggleButton
            showId={show.id}
            variant="card"
            initialSaved={initialSaved}
            userId={userId ?? null}
          />
        )}

        <Link href={`/series/${show.slug}`} className="block">
          <ShowArt brandColor={brandColorHex} title={show.title} aspectRatio="2/3" imageUrl={show.posterUrl} className="rounded-none">
            <div className="absolute inset-0 bg-gradient-to-t from-[#06070a] via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-16">
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.22em] text-white/42">{show.genre}</p>
              <p className="mt-1 truncate text-base font-semibold tracking-[-0.02em] text-white">{show.title}</p>
            </div>
          </ShowArt>
        </Link>
        <div className="space-y-2 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-white/60">
              {show.seasonCount} Season{show.seasonCount !== 1 ? 's' : ''}
            </span>
            {show.platformRating && (
              <span className="border border-[#1A1C23] bg-[#0F1115] px-2.5 py-1 text-[11px] text-white/50">
                CIT {show.platformRating}
              </span>
            )}
          </div>
          <p className="line-clamp-2 text-sm leading-6 text-white/52">{show.tagline || show.description}</p>
        </div>
        <div
          className="h-[2px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: brandColorHex, boxShadow: `0 0 20px ${brandColorHex}50` }}
        />
      </div>
    </div>
  )
}
