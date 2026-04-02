'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { Star } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { PlayOverlay } from '@/components/ui/play-overlay'
import { type Show, brandColorBgMap } from '@/lib/mock-data'

interface ShowCardProps {
  show: Show
}

export function ShowCard({ show }: ShowCardProps) {
  const rating = show.platformRating ?? show.imdbRating ?? 4.5

  return (
    <Link href={`/series/${show.slug}`} className="group block">
      <div className="overflow-hidden rounded-lg">
        <motion.div
          whileHover={{ scale: 1.03 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className={cn('relative aspect-video cursor-pointer', brandColorBgMap[show.brandColor])}
        >
          {/* Watermark */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-white/20">
              {show.title.split(' ')[0]}
            </span>
          </div>

          {/* Bottom gradient overlay */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
            <p className="truncate text-sm font-medium text-white">{show.title}</p>
            <p className="truncate text-xs text-white/60">{show.genre}</p>
          </div>

          <PlayOverlay />
        </motion.div>

        {/* Footer bar */}
        <div className="flex items-center gap-2 bg-card p-3">
          <div className="flex items-center gap-1">
            <Star className="size-3.5 fill-brand-yellow text-brand-yellow" />
            <span className="text-xs text-muted-foreground">{rating}</span>
          </div>
          <Badge variant="secondary" className="text-xs text-muted-foreground">
            {show.episodeCount} Episodes
          </Badge>
        </div>
      </div>
    </Link>
  )
}
