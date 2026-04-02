'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { type Reel, type Show, MOCK_SHOWS, brandColorBgMap, isReelFresh } from '@/lib/mock-data'

interface ReelCardProps {
  reel: Reel
}

export function ReelCard({ reel }: ReelCardProps) {
  const show = MOCK_SHOWS.find((s) => s.id === reel.showId)
  if (!show) return null

  return (
    <Link href={`/series/${show.slug}`} className="block">
      <div className="group relative cursor-pointer overflow-hidden rounded-lg aspect-[9/16]">
        <div className={`h-full w-full ${brandColorBgMap[show.brandColor]}`}>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-black text-white/10">{show.title.split(' ')[0]}</span>
          </div>
        </div>
        {isReelFresh(reel) && (
          <Badge className="absolute top-2 right-2 bg-brand-red text-white text-xs">24h</Badge>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          <p className="truncate text-sm font-medium text-white">{reel.title}</p>
          <p className="text-xs text-white/60">{Math.floor(reel.duration)}s</p>
        </div>
      </div>
    </Link>
  )
}
