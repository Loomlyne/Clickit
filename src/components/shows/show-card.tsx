'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { Play } from 'lucide-react'

import { ShowArt } from '@/components/primitives/show-art'
import { type Show, brandColorHexMap } from '@/lib/mock-data'

interface ShowCardProps {
  show: Show
}

export function ShowCard({ show }: ShowCardProps) {
  const rating = show.platformRating ?? show.imdbRating ?? null
  const brandColorHex = brandColorHexMap[show.brandColor]

  return (
    <Link href={`/series/${show.slug}`} className="group block cursor-pointer">
      <motion.div
        whileHover={{ scale: 1.04 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-lg"
        style={{ willChange: 'transform' }}
      >
        <ShowArt brandColor={brandColorHex} title={show.title} aspectRatio="16/9">

          {/* Glass play button — fades in on hover */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm ring-1 ring-white/25 transition-transform duration-300 group-hover:scale-110">
              <Play className="size-5 fill-white text-white translate-x-0.5" />
            </div>
          </div>

          {/* Info overlay — slides up + fades in on hover */}
          <div
            className="absolute inset-x-0 bottom-0 translate-y-2 px-3 pb-3 pt-10 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)' }}
          >
            <p className="text-sm font-semibold text-white truncate">{show.title}</p>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-white/55">
              <span>{show.genre}</span>
              <span>·</span>
              <span>{show.seasonCount} Season{show.seasonCount !== 1 ? 's' : ''}</span>
              {rating !== null && <><span>·</span><span>★ {rating}</span></>}
            </div>
          </div>
        </ShowArt>

        {/* Brand color glow strip — appears on hover */}
        <div
          className="absolute inset-x-0 bottom-0 h-0.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: brandColorHex, boxShadow: `0 0 20px 2px ${brandColorHex}70` }}
        />
      </motion.div>
    </Link>
  )
}
