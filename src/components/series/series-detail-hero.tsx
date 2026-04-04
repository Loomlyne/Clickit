'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, MotionConfig } from 'motion/react'
import { ThumbsUp, ChevronDown } from 'lucide-react'

import { CinematicBackdrop } from '@/components/primitives/cinematic-backdrop'
import { GlowBadge } from '@/components/primitives/glow-badge'
import { WatchlistToggleButton } from '@/components/watchlist/watchlist-toggle-button'
import type { ViewShow, ViewSeason } from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'
import { CINEMA_EASE } from '@/lib/cinema'

interface SeriesDetailHeroProps {
  show: ViewShow
  seasons: ViewSeason[]
  firstEpisodeLabel?: string // e.g. "S1 E1" for the CTA button
  firstEpisodeId?: string // episode ID for watch page link
  initialSaved?: boolean
  userId?: string | null
}

export function SeriesDetailHero({
  show,
  seasons,
  firstEpisodeLabel,
  firstEpisodeId,
  initialSaved,
  userId,
}: SeriesDetailHeroProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > window.innerHeight * 0.7)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const brandColorHex = BRAND_COLOR_HEX[show.brandColor] ?? '#2C3569'

  return (
    <MotionConfig reducedMotion="user">
      {/* Sticky mini-header — appears when scrolled past hero */}
      <AnimatePresence>
        {scrolled && (
          <motion.div
            initial={{ y: -64, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -64, opacity: 0 }}
            transition={{ duration: 0.3, ease: CINEMA_EASE }}
            className="fixed top-16 left-0 right-0 z-40 bg-black/90 backdrop-blur-xl border-b border-white/[0.06] px-6 md:px-12 py-3 flex items-center justify-between"
          >
            <span className="text-white font-semibold">{show.title}</span>
            {firstEpisodeId && (
              <Link
                href={`/watch/${firstEpisodeId}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-xs font-semibold text-black transition-colors hover:bg-white/90"
              >
                &#9654; Watch Now
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main 100vh hero */}
      <div className="relative min-h-screen overflow-hidden -mt-16">
        <CinematicBackdrop
          brandColor={brandColorHex}
          intensity="high"
          watermarkText={show.title.split(' ')[0]}
        />

        {/* Ken Burns subtle zoom */}
        <motion.div
          className="absolute inset-0"
          animate={{ scale: 1.04 }}
          transition={{ duration: 10, ease: 'linear', repeat: Infinity, repeatType: 'reverse' }}
        />

        {/* Gradients */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />

        {/* Content — bottom-third, left-aligned */}
        <div className="absolute bottom-0 left-0 px-6 md:px-12 pb-16 md:pb-20 max-w-3xl z-10">
          {/* Back link */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: CINEMA_EASE, delay: 0.15 }}
          >
            <Link
              href="/"
              className="inline-flex items-center text-white/50 hover:text-white text-sm mb-6 transition-colors"
            >
              ← Home
            </Link>
          </motion.div>

          {/* Status badge */}
          <motion.div
            className="mb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: CINEMA_EASE, delay: 0.25 }}
          >
            <GlowBadge
              label={show.status === 'streaming' ? 'Now Streaming' : 'Coming Soon'}
              color={show.status === 'streaming' ? '#50A258' : '#EA8C2E'}
            />
          </motion.div>

          {/* Genre label */}
          <motion.p
            className="text-white/50 text-xs tracking-[0.3em] uppercase mb-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: CINEMA_EASE, delay: 0.35 }}
          >
            {show.genre}
          </motion.p>

          {/* Show title — display font */}
          <motion.h1
            className="font-display font-bold text-white leading-none mb-5 drop-shadow-2xl"
            style={{ fontSize: 'clamp(3rem, 7vw, 6rem)' }}
            initial={{ opacity: 0, x: -24, y: 8 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.85, ease: CINEMA_EASE, delay: 0.4 }}
          >
            {show.title}
          </motion.h1>

          {/* Description */}
          <motion.p
            className="text-white/70 text-base md:text-lg leading-relaxed mb-6 max-w-xl line-clamp-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: CINEMA_EASE, delay: 0.55 }}
          >
            {show.description}
          </motion.p>

          {/* Metadata row */}
          <motion.div
            className="flex items-center gap-4 mb-7 text-sm text-white/50 flex-wrap"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: CINEMA_EASE, delay: 0.65 }}
          >
            <span>{show.genre}</span>
            <span>·</span>
            <span>
              {seasons.length} Season{seasons.length !== 1 ? 's' : ''}
            </span>
            <span>·</span>
            <span>{show.episodeCount} Episodes</span>
            {show.imdbRating && (
              <>
                <span>·</span>
                <span>★ {show.imdbRating} IMDb</span>
              </>
            )}
          </motion.div>

          {/* CTA buttons — hero pill style */}
          <motion.div
            className="flex items-center gap-3 flex-wrap"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: CINEMA_EASE, delay: 0.75 }}
          >
            {firstEpisodeId && show.status === 'streaming' ? (
              <Link
                href={`/watch/${firstEpisodeId}`}
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90"
              >
                &#9654; {firstEpisodeLabel ? `Watch ${firstEpisodeLabel}` : 'Watch Now'}
              </Link>
            ) : (
              <span className="inline-flex items-center rounded-full bg-white/10 px-7 py-3 text-sm font-medium text-white/50 cursor-not-allowed">
                Coming Soon
              </span>
            )}
            {userId !== undefined && (
              <WatchlistToggleButton
                showId={show.id}
                variant="hero"
                initialSaved={initialSaved}
                userId={userId ?? null}
              />
            )}
            <button
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/5 text-white/70 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Like"
            >
              <ThumbsUp className="w-5 h-5" />
            </button>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="text-white/30 flex flex-col items-center gap-1"
          >
            <ChevronDown className="w-5 h-5" />
          </motion.div>
        </div>
      </div>
    </MotionConfig>
  )
}
