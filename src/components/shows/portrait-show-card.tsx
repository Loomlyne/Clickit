'use client'

import Link from 'next/link'
import { motion } from 'motion/react'

import { ShowArt } from '@/components/primitives/show-art'
import { PlayOverlay } from '@/components/ui/play-overlay'
import { type Show, brandColorHexMap } from '@/lib/mock-data'

interface PortraitShowCardProps {
  show: Show
}

export function PortraitShowCard({ show }: PortraitShowCardProps) {
  const brandColorHex = brandColorHexMap[show.brandColor]

  return (
    <Link href={`/series/${show.slug}`} className="group block cursor-pointer">
      <motion.div
        whileHover={{ scale: 1.03 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-xl"
      >
        <ShowArt
          brandColor={brandColorHex}
          title={show.title}
          aspectRatio="2/3"
        >
          <PlayOverlay />

          {/* Bottom gradient info area */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/60 to-transparent p-4">
            {/* Genre badge */}
            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/80 mb-2">
              {show.genre}
            </span>
            <p className="text-white font-bold text-base leading-tight truncate">{show.title}</p>
            <p className="text-white/50 text-xs mt-1">{show.episodeCount} episodes</p>
          </div>
        </ShowArt>

        {/* Brand color bottom glow on hover */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: brandColorHex, boxShadow: `0 -4px 20px ${brandColorHex}80` }}
        />
      </motion.div>
    </Link>
  )
}
