'use client'

import Link from 'next/link'
import { Play, Clock, Lock } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { type Episode, type Show, brandColorBgMap } from '@/lib/mock-data'

interface EpisodeRowProps {
  episode: Episode
  showBrandColor: Show['brandColor']
}

export function EpisodeRow({ episode, showBrandColor }: EpisodeRowProps) {
  const isPublished = episode.status === 'published'
  const isComingSoon = episode.status === 'coming-soon'
  const isLocked = episode.status === 'locked'
  const isDimmed = isComingSoon || isLocked

  const rowContent = (
    <>
      {/* Thumbnail area — 16:9, responsive widths */}
      <div
        className={cn(
          'relative aspect-video w-[120px] sm:w-[140px] lg:w-[200px] flex-shrink-0 rounded-md overflow-hidden',
          isDimmed && 'opacity-45'
        )}
      >
        {/* Brand color placeholder fill */}
        <div
          className={cn(
            'flex h-full w-full items-center justify-center',
            brandColorBgMap[showBrandColor]
          )}
        >
          <span className="text-2xl font-bold text-white/30">
            E{episode.episodeNumber}
          </span>
        </div>

        {/* Published hover: play overlay */}
        {isPublished && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60">
              <Play className="size-5 text-white fill-white" aria-hidden="true" />
            </div>
          </div>
        )}

        {/* Coming Soon overlay: clock icon */}
        {isComingSoon && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Clock className="size-6 text-white/70" aria-hidden="true" />
          </div>
        )}

        {/* Locked overlay: lock icon */}
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Lock className="size-6 text-white/70" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Text content */}
      <div className="flex flex-col justify-center min-w-0 flex-1">
        {/* Row 1: episode number + title */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-muted flex-shrink-0">
            E{episode.episodeNumber}
          </span>
          <span className="text-base font-bold text-foreground truncate">
            {episode.title}
          </span>
        </div>

        {/* Row 2: description */}
        <p
          className="mt-1 text-sm text-muted-foreground line-clamp-1"
          title={episode.description}
        >
          {episode.description}
        </p>

        {/* Row 3: duration + status badge */}
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="secondary" className="text-xs text-muted-foreground">
            {episode.duration ? `${episode.duration} min` : '-- min'}
          </Badge>

          {isComingSoon && (
            <Badge className="bg-brand-orange text-black text-xs">
              Coming Soon
            </Badge>
          )}

          {isLocked && (
            <Badge className="bg-surface-3 text-foreground text-xs">
              Locked
            </Badge>
          )}
        </div>
      </div>
    </>
  )

  if (isPublished) {
    return (
      <Link
        href="#"
        className="group flex items-start gap-4 rounded-lg p-3 transition-colors duration-200 hover:bg-surface-2/50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {rowContent}
      </Link>
    )
  }

  return (
    <div
      aria-disabled="true"
      className="flex items-start gap-4 rounded-lg p-3 cursor-default"
    >
      {rowContent}
    </div>
  )
}
