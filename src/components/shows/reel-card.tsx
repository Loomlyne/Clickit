'use client'

import { Link } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'
import type { ViewShow } from '@/lib/queries'
import { BRAND_COLOR_BG } from '@/lib/brand-colors'

export interface Reel {
  id: string
  showId: string
  title: string
  thumbnailUrl?: string
  duration: number
  postedAt: string
}

export function isReelFresh(reel: Reel): boolean {
  const posted = new Date(reel.postedAt)
  const now = new Date()
  const diffMs = now.getTime() - posted.getTime()
  return diffMs < 24 * 60 * 60 * 1000
}

interface ReelCardProps {
  reel: Reel
  showSlug: string
  showTitle: string
  showBrandColor: ViewShow['brandColor']
}

export function ReelCard({
  reel,
  showSlug,
  showTitle,
  showBrandColor,
}: ReelCardProps) {
  return (
    <Link href={`/series/${showSlug}`} className="block">
      <div className="group relative aspect-[9/16] cursor-pointer overflow-hidden rounded-lg">
        <div className={`h-full w-full ${BRAND_COLOR_BG[showBrandColor]}`}>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-black text-white/10">
              {showTitle.split(' ')[0]}
            </span>
          </div>
        </div>
        {isReelFresh(reel) && (
          <Badge className="bg-brand-red absolute top-2 right-2 text-xs text-white">
            24h
          </Badge>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          <p className="truncate text-sm font-medium text-white">
            {reel.title}
          </p>
          <p className="text-xs text-white/60">{Math.floor(reel.duration)}s</p>
        </div>
      </div>
    </Link>
  )
}
