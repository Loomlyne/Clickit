'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { motion } from 'motion/react'
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
  const t = useTranslations('episode')
  // isLive (not raw status) drives interactivity: a coming-soon episode whose
  // scheduled time has passed becomes clickable without a redeploy.
  const isLive = episode.isLive
  const isComingSoon = episode.status === 'coming-soon' && !isLive
  const isDraft = episode.status === 'draft'
  const isDimmed = !isLive
  const isCurrentEpisode = currentEpisodeId === episode.id
  const brandColorHex = BRAND_COLOR_HEX[showBrandColor] ?? BRAND_COLOR_HEX['brand-blue']
  const thumbnailUrl = episode.youtubeId
    ? `https://img.youtube.com/vi/${episode.youtubeId}/hqdefault.jpg`
    : undefined

  const rowContent = (
    <>
      {/* Thumbnail area — wider: 160px mobile, 180px md+ */}
      <div
        className={cn(
          'relative aspect-video w-[120px] flex-shrink-0 overflow-hidden rounded-media sm:w-[160px] md:w-[180px]',
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
        {isLive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60">
              <Play
                className="size-5 fill-white text-white"
                aria-hidden="true"
              />
            </div>
          </div>
        )}

        {/* Coming Soon overlay: clock icon */}
        {isComingSoon && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Clock
              className="size-6 text-[var(--text-dim)]"
              aria-hidden="true"
            />
          </div>
        )}

        {/* Draft overlay: eye-off icon */}
        {isDraft && (
          <div className="absolute inset-0 flex items-center justify-center">
            <EyeOff
              className="size-6 text-[var(--text-dim)]"
              aria-hidden="true"
            />
          </div>
        )}
      </div>

      {/* Text content */}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {/* Row 1: episode number + title */}
        <div className="flex items-center gap-3">
          <span
            className="font-display flex-shrink-0 text-[28px] leading-none text-[var(--text-dim)]"
            style={{ color: isCurrentEpisode ? 'var(--primary)' : undefined }}
          >
            {episode.episodeNumber}
          </span>
          <span className="font-display text-foreground truncate text-base font-medium">
            {episode.title}
          </span>
        </div>

        {/* Row 2: description */}
        <p
          className="text-muted-foreground mt-1 line-clamp-1 text-sm"
          title={episode.description}
        >
          {episode.description}
        </p>

        {/* Row 3: duration + status badge */}
        <div className="mt-2 flex items-center gap-2">
          <Badge variant="secondary" className="text-muted-foreground text-xs">
            {episode.duration
              ? t('minutesAbbr', { duration: episode.duration })
              : t('minutesEmpty')}
          </Badge>

          {isComingSoon && (
            <Badge className="bg-brand-orange text-xs text-black">
              {t('comingSoonBadge')}
            </Badge>
          )}

          {isDraft && (
            <Badge className="bg-surface-3 text-foreground text-xs">
              {t('draftBadge')}
            </Badge>
          )}
        </div>

        {/* Resume progress indicator */}
        {isCompleted && (
          <div className="mt-2">
            <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] text-[var(--text-mute)]">
              {t('completedBadge')}
            </span>
          </div>
        )}
        {!isCompleted && resumePercent != null && resumePercent > 0 && (
          <div className="mt-2 h-1 max-w-[200px] overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${resumePercent}%`,
                backgroundColor: brandColorHex,
              }}
            />
          </div>
        )}
      </div>
    </>
  )

  if (isLive && isCurrentEpisode) {
    return (
      <div
        id={`episode-${episode.id}`}
        aria-current="true"
        className="group flex cursor-default items-start gap-4 rounded-card border border-[var(--uis-line-strong)] bg-[var(--bg-2)] p-4"
      >
        {rowContent}
      </div>
    )
  }

  if (isLive) {
    return (
      <motion.div whileTap={{ scale: 0.985 }} transition={{ duration: 0.15 }}>
        <Link
          id={`episode-${episode.id}`}
          href={`/watch/${episode.id}`}
          className="group focus-visible:ring-ring flex cursor-pointer items-start gap-4 rounded-card border border-transparent p-4 transition-colors duration-200 hover:border-[var(--line)] hover:bg-[var(--bg-1)] focus-visible:ring-2 focus-visible:outline-none"
        >
          {rowContent}
        </Link>
      </motion.div>
    )
  }

  return (
    <div
      aria-disabled="true"
      className="flex cursor-default items-start gap-4 rounded-card p-4"
    >
      {rowContent}
    </div>
  )
}
