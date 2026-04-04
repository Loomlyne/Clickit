'use client'

import { motion } from 'motion/react'
import Link from 'next/link'

import { CinematicBackdrop } from '@/components/primitives/cinematic-backdrop'
import { GlowBadge } from '@/components/primitives/glow-badge'
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
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent pointer-events-none" />

      {/* Bottom gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent pointer-events-none" />

      {/* Content — left-aligned, bottom-third */}
      <div className="absolute bottom-0 left-0 pb-20 md:pb-24 px-6 md:px-12 max-w-2xl">

        {/* Genre label */}
        <motion.p
          className="text-white/50 text-xs tracking-[0.3em] uppercase mb-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: CINEMA_EASE, delay: 0.1 }}
        >
          {show.genre}
        </motion.p>

        {/* Show title — Playfair Display via font-display class */}
        <motion.h1
          className="font-display font-bold text-white leading-none mb-4"
          style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        >
          {show.title}
        </motion.h1>

        {/* Tagline */}
        <motion.p
          className="text-white/65 text-sm md:text-base leading-relaxed mb-2 max-w-lg italic"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: CINEMA_EASE, delay: 0.3 }}
        >
          {show.tagline}
        </motion.p>

        {/* Description */}
        <motion.p
          className="text-white/55 text-sm leading-relaxed line-clamp-2 mb-6 max-w-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          {show.description}
        </motion.p>

        {/* Metadata badges */}
        <motion.div
          className="flex items-center gap-3 mb-6 flex-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.45 }}
        >
          <GlowBadge
            label={show.status === 'streaming' ? 'Now Streaming' : 'Coming Soon'}
            color={show.status === 'streaming' ? '#50A258' : '#EA8C2E'}
          />
          <span className="text-white/40 text-sm">{show.seasonCount} Season{show.seasonCount !== 1 ? 's' : ''}</span>
          {show.imdbRating && (
            <span className="text-white/40 text-sm">&#9733; {show.imdbRating}</span>
          )}
        </motion.div>

        {/* CTA buttons */}
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: CINEMA_EASE, delay: 0.55 }}
        >
          {firstEpisodeId && show.status === 'streaming' ? (
            <Link
              href={`/watch/${firstEpisodeId}`}
              className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90"
            >
              &#9654; Watch S1 E1
            </Link>
          ) : (
            <span className="inline-flex items-center rounded-full bg-white/10 px-7 py-3 text-sm font-medium text-white/50 cursor-not-allowed">
              Coming Soon
            </span>
          )}
          <Link
            href={`/series/${show.slug}`}
            className="inline-flex items-center rounded-full border border-white/25 bg-white/5 px-7 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            More Info
          </Link>
        </motion.div>
      </div>
    </motion.div>
  )
}
