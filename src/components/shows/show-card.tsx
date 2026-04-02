'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { Star } from 'lucide-react'

import { ShowArt } from '@/components/primitives/show-art'
import { PlayOverlay } from '@/components/ui/play-overlay'
import { type Show, brandColorHexMap } from '@/lib/mock-data'

interface ShowCardProps {
  show: Show
}

export function ShowCard({ show }: ShowCardProps) {
  const rating = show.platformRating ?? show.imdbRating ?? 4.5
  const brandColorHex = brandColorHexMap[show.brandColor]

  return (
    <Link href={`/series/${show.slug}`} className="group block cursor-pointer">
      <motion.div
        whileHover={{ scale: 1.04 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-lg"
      >
        <ShowArt
          brandColor={brandColorHex}
          title={show.title}
          aspectRatio="16/9"
        >
          <PlayOverlay />

          {/* Bottom info overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
            <p className="text-white text-sm font-semibold truncate drop-shadow-lg">{show.title}</p>
            <p className="text-white/60 text-xs truncate mt-0.5">{show.genre}</p>
          </div>
        </ShowArt>

        {/* Brand color bottom glow — appears on hover */}
        <div
          className="absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: brandColorHex, boxShadow: `0 0 20px ${brandColorHex}` }}
        />
      </motion.div>

      {/* Card footer below the art */}
      <div className="bg-[var(--color-surface-2)] px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
          <Star className="size-3 fill-current" />
          {rating}
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">{show.episodeCount} ep</span>
      </div>
    </Link>
  )
}
