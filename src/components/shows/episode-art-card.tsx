'use client'

import { Link } from '@/i18n/navigation'
import { motion } from 'motion/react'

import { ShowArt } from '@/components/primitives/show-art'
import { PlayOverlay } from '@/components/ui/play-overlay'
import type { ViewShow } from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'

interface EpisodeArtCardProps {
  episode: {
    id: string
    title: string
    episodeNumber: number
    seasonNumber: number
    duration?: number
    showTitle: string
    showSlug: string
    brandColor: ViewShow['brandColor']
    watchProgress?: number // 0-100, for progress bar
    youtubeId?: string | null
  }
}

export function EpisodeArtCard({ episode }: EpisodeArtCardProps) {
  const brandColorHex = BRAND_COLOR_HEX[episode.brandColor]
  const thumbnailUrl = episode.youtubeId
    ? `https://img.youtube.com/vi/${episode.youtubeId}/hqdefault.jpg`
    : undefined

  return (
    <Link href={`/watch/${episode.id}`} className="group block cursor-pointer flex-shrink-0 w-[320px]">
      <motion.div
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <ShowArt brandColor={brandColorHex} title={episode.showTitle} aspectRatio="16/9" imageUrl={thumbnailUrl}>
          <PlayOverlay />

          {/* Episode number watermark */}
          <div className="absolute top-2 left-2">
            <span className="text-xs font-bold text-white/50 uppercase tracking-widest">
              S{episode.seasonNumber} E{episode.episodeNumber}
            </span>
          </div>

          {/* Duration badge */}
          {episode.duration && (
            <div className="absolute top-2 right-2">
              <span className="text-xs bg-black/60 text-white/80 px-2 py-0.5 rounded">
                {Math.floor(episode.duration / 60)}m
              </span>
            </div>
          )}

          {/* Progress bar */}
          {episode.watchProgress !== undefined && episode.watchProgress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
              <div
                className="h-full transition-none"
                style={{ width: `${episode.watchProgress}%`, background: brandColorHex }}
              />
            </div>
          )}
        </ShowArt>

        {/* Info below */}
        <div className="bg-[var(--color-surface-2)] px-3 py-2">
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider truncate">{episode.showTitle}</p>
          <p className="text-white text-sm font-medium truncate mt-0.5">{episode.title}</p>
        </div>
      </motion.div>
    </Link>
  )
}
