'use client'

import { Link } from '@/i18n/navigation'
import { motion } from 'motion/react'
import { Play } from 'lucide-react'

import { ShowArt } from '@/components/primitives/show-art'
import type { NewEpisodeItem } from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'

interface EpisodeCardProps {
  episode: NewEpisodeItem
}

export function EpisodeCard({ episode }: EpisodeCardProps) {
  const brandColorHex = BRAND_COLOR_HEX[episode.showBrandColor]

  // Use YouTube thumbnail when available, fall back to show poster
  const thumbnailUrl = episode.youtubeId
    ? `https://img.youtube.com/vi/${episode.youtubeId}/hqdefault.jpg`
    : episode.showPosterUrl

  return (
    <Link href={`/watch/${episode.id}`} className="group block cursor-pointer">
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] shadow-[0_24px_80px_rgba(0,0,0,0.38)]"
        style={{ willChange: 'transform' }}
      >
        <ShowArt
          brandColor={brandColorHex}
          title={episode.title}
          aspectRatio="16/9"
          className="rounded-none"
          imageUrl={thumbnailUrl}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/32 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/16 bg-[rgba(8,11,18,0.76)] backdrop-blur-sm ring-1 ring-white/8 transition-transform duration-300 group-hover:scale-110">
              <Play className="size-5 fill-white text-white translate-x-0.5" />
            </div>
          </div>
        </ShowArt>
        <div className="space-y-1.5 px-4 py-4">
          <h3 className="font-display truncate text-[17px] font-semibold tracking-[-0.02em] text-white">
            {episode.title}
          </h3>
          <p className="line-clamp-1 text-sm leading-6 text-white/52">{episode.description}</p>
        </div>
        <div
          className="h-[2px] w-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: brandColorHex, boxShadow: `0 0 20px 2px ${brandColorHex}50` }}
        />
      </motion.div>
    </Link>
  )
}
