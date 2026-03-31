'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { Play } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { type Show, brandColorBgMap, brandColorTextMap } from '@/lib/mock-data'

interface ShowCardProps {
  show: Show
}

export function ShowCard({ show }: ShowCardProps) {
  return (
    <Link href={`/series/${show.slug}`} className="block">
    <motion.div
      whileHover={{ scale: 1.05 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="group relative cursor-pointer overflow-hidden rounded-lg"
    >
      {/* Brand ribbon - 4px solid color bar at top edge */}
      <div className={cn('h-1', brandColorBgMap[show.brandColor])} />

      {/* Artwork area - 16:9 aspect ratio */}
      <div className="relative aspect-video">
        {/* Artwork area with brand color background */}
        <div
          className={cn(
            'flex h-full w-full items-center justify-center',
            brandColorBgMap[show.brandColor]
          )}
        />

        {/* Hover overlay with play icon */}
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(10,10,15,0.65)] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          <span className="flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-black/40">
            <Play className="size-4" />
            Watch
          </span>
        </div>
      </div>

      {/* Card text area */}
      <div className="bg-card p-4">
        <h3 className={cn('truncate font-bold', brandColorTextMap[show.brandColor])}>{show.title}</h3>
        <div className="mt-2 flex gap-2">
          <Badge variant="secondary">{show.genre}</Badge>
          <Badge variant="secondary" className="text-muted-foreground">
            {show.episodeCount} Episodes
          </Badge>
        </div>
      </div>
    </motion.div>
    </Link>
  )
}
