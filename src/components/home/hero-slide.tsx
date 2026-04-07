'use client'

import { motion } from 'motion/react'
import Link from 'next/link'

import { CinematicBackdrop } from '@/components/primitives/cinematic-backdrop'
import { GlowBadge } from '@/components/primitives/glow-badge'
import { Badge } from '@/components/ui/badge'
import type { ViewShow } from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'
import { CINEMA_EASE } from '@/lib/cinema'

interface HeroSlideProps {
  show: ViewShow
  isActive: boolean
  firstEpisodeId?: string
}

export function HeroSlide({ show, isActive, firstEpisodeId }: HeroSlideProps) {
  const brandColorHex = BRAND_COLOR_HEX[show.brandColor]

  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: isActive ? 1 : 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2, ease: 'easeInOut' }}
    >
      {/* Cinematic backdrop with brand color bloom */}
      <CinematicBackdrop
        brandColor={brandColorHex}
        intensity="high"
        watermarkText={show.title.split(' ')[0]}
        className="absolute inset-0"
        imageUrl={show.heroImageUrl}
      />

      {/* Ken Burns zoom */}
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1 }}
        animate={isActive ? { scale: 1.06 } : { scale: 1 }}
        transition={{ duration: 8, ease: 'linear' }}
      />

      {/* Left vignette gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent pointer-events-none" />

      {/* Bottom gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent pointer-events-none" />

      <div className="absolute bottom-0 left-0 w-full px-6 pb-10 md:px-12 md:pb-12">
        <div className="max-w-[42rem]">
          <motion.p
            className="mb-3 text-[11px] font-medium uppercase tracking-[0.28em] text-white/40"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: CINEMA_EASE, delay: 0.1 }}
          >
            Featured now
          </motion.p>

          <motion.h1
            className="font-display mb-4 font-semibold leading-[0.94] text-white"
            style={{ fontSize: 'clamp(2.75rem, 6vw, 5.4rem)' }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          >
            {show.title}
          </motion.h1>

          {show.tagline && (
            <motion.p
              className="mb-2 max-w-xl text-base leading-7 text-white/72 md:text-lg"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: CINEMA_EASE, delay: 0.3 }}
            >
              {show.tagline}
            </motion.p>
          )}

          <motion.p
            className="mb-6 max-w-2xl text-sm leading-6 text-white/56 md:text-[15px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            {show.description}
          </motion.p>

          <motion.div
            className="mb-6 flex flex-wrap items-center gap-2.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.45 }}
          >
            <GlowBadge
              label={show.status === 'streaming' ? 'Now Streaming' : 'Coming Soon'}
              color={show.status === 'streaming' ? '#77d586' : '#ffb46e'}
            />
            <Badge variant="secondary">{show.genre}</Badge>
            <Badge variant="secondary">
              {show.seasonCount} Season{show.seasonCount !== 1 ? 's' : ''}
            </Badge>
            {show.imdbRating && <Badge variant="secondary">IMDb {show.imdbRating}</Badge>}
          </motion.div>

          <motion.div
            className="flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: CINEMA_EASE, delay: 0.55 }}
          >
            {firstEpisodeId && show.status === 'streaming' ? (
              <Link
                href={`/watch/${firstEpisodeId}`}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_16px_40px_rgba(96,115,255,0.28)] transition-colors hover:bg-[#7082ff]"
              >
                &#9654; Watch first episode
              </Link>
            ) : (
              <span className="inline-flex cursor-not-allowed items-center rounded-full border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-medium text-white/50">
                Coming Soon
              </span>
            )}
            <Link
              href={`/series/${show.slug}`}
              className="inline-flex items-center rounded-full border border-white/14 bg-white/[0.04] px-6 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/[0.08]"
            >
              View details
            </Link>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
