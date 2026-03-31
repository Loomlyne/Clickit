'use client'

import { motion } from 'motion/react'
import { Play } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { type Show, brandColorBgMap } from '@/lib/mock-data'

interface ShowCardProps {
  show: Show
}

export function ShowCard({ show }: ShowCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="group relative cursor-pointer overflow-hidden rounded-lg"
      tabIndex={0}
    >
      {/* Brand ribbon - 4px solid color bar at top edge */}
      <div className={cn('h-1', brandColorBgMap[show.brandColor])} />

      {/* Artwork area - 16:9 aspect ratio */}
      <div className="relative aspect-video">
        {/* Placeholder artwork with brand color background */}
        <div
          className={cn(
            'flex h-full w-full items-center justify-center',
            brandColorBgMap[show.brandColor]
          )}
        >
          <span className="text-lg font-bold text-white">{show.title}</span>
        </div>

        {/* Show logo placeholder - bottom-left corner */}
        <span className="absolute bottom-8 left-8 max-w-[40%] text-lg font-bold text-white drop-shadow-lg">
          {show.title}
        </span>

        {/* Hover overlay with Watch button */}
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(10,10,15,0.65)] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          <Button variant="default">
            <Play className="size-4" />
            Watch
          </Button>
        </div>
      </div>

      {/* Card text area */}
      <div className="bg-card p-4">
        <h3 className="truncate font-bold text-primary">{show.title}</h3>
        <div className="mt-2 flex gap-2">
          <Badge variant="secondary">{show.genre}</Badge>
          <Badge variant="secondary" className="text-muted-foreground">
            {show.episodeCount} Episodes
          </Badge>
        </div>
      </div>
    </motion.div>
  )
}
