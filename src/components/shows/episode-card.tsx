'use client'

import Link from 'next/link'
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
        className="overflow-hidden border border-[#1A1C23] bg-[#0F1115]"
        style={{ willChange: 'transform' }}
      >
        <ShowArt
          brandColor={brandColorHex}
          title={episode.title}
          aspectRatio="16/9"
          className="rounded-none"
          imageUrl={thumbnailUrl}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#06070a] via-[#06070a]/32 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div className="flex h-14 w-14 items-center justify-center border border-white/16 bg-[rgba(8,11,18,0.76)] backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
              <Play className="size-5 fill-white text-white translate-x-0.5" />
            </div>
          </div>
        </ShowArt>
        <div className="space-y-1.5 px-4 py-4">
          <h3 className="truncate text-[17px] font-semibold tracking-[-0.02em] text-white">
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
