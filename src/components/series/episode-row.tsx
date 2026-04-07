'use client'

import Link from 'next/link'
import { Play, Clock, EyeOff } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ShowArt } from '@/components/primitives/show-art'
import type { ViewEpisode, ViewShow } from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'

interface EpisodeRowProps {
  episode: ViewEpisode
  showBrandColor: ViewShow['brandColor']
  currentEpisodeId?: string
  resumePercent?: number
  isCompleted?: boolean
}

export function EpisodeRow({
  episode,
  showBrandColor,
  currentEpisodeId,
  resumePercent,
  isCompleted,
}: EpisodeRowProps) {
  const isPublished = episode.status === 'published'
  const isComingSoon = episode.status === 'coming-soon'
  const isDraft = episode.status === 'draft'
  const isDimmed = isComingSoon || isDraft
  const isCurrentEpisode = currentEpisodeId === episode.id
  const brandColorHex = BRAND_COLOR_HEX[showBrandColor] ?? '#2C3569'
  const thumbnailUrl = episode.youtubeId
    ? `https://img.youtube.com/vi/${episode.youtubeId}/hqdefault.jpg`
    : undefined

  const rowContent = (
    <>
      {/* Thumbnail area — wider: 160px mobile, 180px md+ */}
      <div
        className={cn(
          'relative aspect-video w-[160px] md:w-[180px] flex-shrink-0 rounded-md overflow-hidden',
          isDimmed && 'opacity-45'
        )}
      >
        <ShowArt
          brandColor={brandColorHex}
          title={episode.title}
          className="h-full w-full"
          imageUrl={thumbnailUrl}
        >
          {/* Episode number watermark-style label */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-2xl font-black text-white/40"
              style={{ textShadow: `0 0 20px ${brandColorHex}60` }}
            >
              E{episode.episodeNumber}
            </span>
          </div>
        </ShowArt>

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

        {/* Draft overlay: eye-off icon */}
        {isDraft && (
          <div className="absolute inset-0 flex items-center justify-center">
            <EyeOff className="size-6 text-white/70" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Text content */}
      <div className="flex flex-col justify-center min-w-0 flex-1">
        {/* Row 1: episode number + title */}
        <div className="flex items-center gap-2">
          <span
            className="text-sm flex-shrink-0 font-semibold"
            style={{ color: isCurrentEpisode ? brandColorHex : undefined }}
          >
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

          {isDraft && (
            <Badge className="bg-surface-3 text-foreground text-xs">
              Draft
            </Badge>
          )}
        </div>

        {/* Resume progress indicator */}
        {isCompleted && (
          <div className="mt-2">
            <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] text-white/50">
              Completed
            </span>
          </div>
        )}
        {!isCompleted && resumePercent != null && resumePercent > 0 && (
          <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden max-w-[200px]">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${resumePercent}%`, backgroundColor: brandColorHex }}
            />
          </div>
        )}
      </div>
    </>
  )

  if (isPublished && isCurrentEpisode) {
    return (
      <div
        aria-current="true"
        className="group flex cursor-default items-start gap-4 rounded-[20px] border border-white/10 bg-white/[0.04] p-4"
        style={{
          borderLeft: `3px solid ${brandColorHex}`,
          boxShadow: `inset 4px 0 12px ${brandColorHex}30`,
        }}
      >
        {rowContent}
      </div>
    )
  }

  if (isPublished) {
    return (
      <Link
        href={`/watch/${episode.id}`}
        className="group flex cursor-pointer items-start gap-4 rounded-[20px] border border-transparent p-4 transition-colors duration-200 hover:border-white/8 hover:bg-surface-2/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {rowContent}
      </Link>
    )
  }

  return (
    <div
      aria-disabled="true"
      className="flex cursor-default items-start gap-4 rounded-[20px] p-4"
    >
      {rowContent}
    </div>
  )
}
