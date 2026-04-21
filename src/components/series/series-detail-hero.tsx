'use client'

import { useState, useEffect } from 'react'
import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { motion, AnimatePresence, MotionConfig } from 'motion/react'
import { ChevronDown } from 'lucide-react'

import { GlowBadge } from '@/components/primitives/glow-badge'
import { WatchlistToggleButton } from '@/components/watchlist/watchlist-toggle-button'
import { LikeButton } from '@/components/likes/like-button'
import type { ViewShow, ViewSeason } from '@/lib/queries'
import { CINEMA_EASE } from '@/lib/cinema'

interface SeriesDetailHeroProps {
  show: ViewShow
  seasons: ViewSeason[]
  firstEpisodeLabel?: string // e.g. "S1 E1" for the CTA button
  firstEpisodeId?: string // episode ID for watch page link
  initialSaved?: boolean
  initialLiked?: boolean
  userId?: string | null
}

export function SeriesDetailHero({
  show,
  seasons,
  firstEpisodeLabel,
  firstEpisodeId,
  initialSaved,
  initialLiked,
  userId,
}: SeriesDetailHeroProps) {
  const [scrolled, setScrolled] = useState(false)
  const mobileBackdropUrl = show.posterUrl ?? show.heroImageUrl
  const desktopBackdropUrl = show.heroImageUrl ?? show.posterUrl

  useEffect(() => {
    let ticking = false
    const handler = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrolled(window.scrollY > window.innerHeight * 0.7)
          ticking = false
        })
        ticking = true
      }
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {scrolled && (
          <motion.div
            initial={{ y: -64, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -64, opacity: 0 }}
            transition={{ duration: 0.3, ease: CINEMA_EASE }}
            className="fixed left-4 right-4 top-24 z-40 mx-auto flex max-w-7xl items-center justify-between rounded-[20px] border border-white/10 bg-[rgba(10,13,19,0.88)] px-5 py-3 backdrop-blur-xl"
          >
            <span className="text-white font-semibold">{show.title}</span>
            {firstEpisodeId && (
              <Link
                href={`/watch/${firstEpisodeId}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-[#7082ff]"
              >
                &#9654; Watch Now
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative -mt-24 md:-mt-28 min-h-dvh overflow-hidden">
        <div className="absolute inset-0 bg-black" />
        {mobileBackdropUrl && (
          <Image
            src={mobileBackdropUrl}
            alt=""
            fill
            priority
            aria-hidden
            sizes="100vw"
            className="object-cover object-center opacity-80 md:hidden"
          />
        )}
        {desktopBackdropUrl && (
          <Image
            src={desktopBackdropUrl}
            alt=""
            fill
            priority
            aria-hidden
            sizes="100vw"
            className="hidden object-cover object-center opacity-80 md:block"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />

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

          <motion.h1
            className="font-display mb-5 font-semibold leading-none text-white drop-shadow-2xl"
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
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
                <Link
                  href={`/watch/${firstEpisodeId}`}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[#7082ff]"
                >
                  &#9654; {firstEpisodeLabel ? `Watch ${firstEpisodeLabel}` : 'Watch Now'}
                </Link>
              </motion.div>
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
            <LikeButton
              showId={show.id}
              initialLiked={initialLiked}
              userId={userId ?? null}
            />
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
