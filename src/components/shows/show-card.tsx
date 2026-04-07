'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { Play } from 'lucide-react'

import { ShowArt } from '@/components/primitives/show-art'
import type { ViewShow } from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'

interface ShowCardProps {
  show: ViewShow
}

export function ShowCard({ show }: ShowCardProps) {
  const rating = show.platformRating ?? show.imdbRating ?? null
  const brandColorHex = BRAND_COLOR_HEX[show.brandColor]

  return (
    <Link href={`/series/${show.slug}`} className="group block cursor-pointer">
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
        style={{ willChange: 'transform' }}
      >
        <ShowArt brandColor={brandColorHex} title={show.title} aspectRatio="16/9" className="rounded-none">
          <div className="absolute inset-0 bg-gradient-to-t from-[#06070a] via-[#06070a]/32 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/16 bg-[rgba(8,11,18,0.76)] backdrop-blur-sm ring-1 ring-white/8 transition-transform duration-300 group-hover:scale-110">
              <Play className="size-5 fill-white text-white translate-x-0.5" />
            </div>
          </div>
        </ShowArt>
        <div className="space-y-2 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.2em] text-white/34">
                {show.genre}
              </p>
              <h3 className="mt-1 truncate text-[17px] font-semibold tracking-[-0.02em] text-white">
                {show.title}
              </h3>
            </div>
            {rating !== null && (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/62">
                ★ {rating}
              </span>
            )}
          </div>
          <p className="line-clamp-2 text-sm leading-6 text-white/52">{show.description}</p>
        </div>
        <div
          className="h-[2px] w-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: brandColorHex, boxShadow: `0 0 20px 2px ${brandColorHex}50` }}
        />
      </motion.div>
    </Link>
  )
}
