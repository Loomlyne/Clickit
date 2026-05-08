'use client'

import { useState, useEffect } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { motion, AnimatePresence, MotionConfig } from 'motion/react'
import { ChevronDown } from 'lucide-react'

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
  const t = useTranslations('show')
  const locale = useLocale()
  const isArabic = locale === 'ar'
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
            className="fixed top-24 right-4 left-4 z-40 mx-auto flex max-w-7xl items-center justify-between rounded-full border border-[var(--line)] bg-[var(--bg-1)] px-5 py-3"
          >
            <span className="font-semibold text-white">{show.title}</span>
            {firstEpisodeId && (
              <Link
                href={`/watch/${firstEpisodeId}`}
                className="bg-primary text-primary-foreground inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-semibold transition-colors hover:bg-white"
              >
                &#9654; {t('watchNow')}
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative h-[72vh] min-h-[460px] overflow-hidden md:min-h-[520px]">
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

        {/* Handoff scrim: bottom fade + left vignette */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `
              linear-gradient(180deg, transparent 0%, rgba(10,10,10,0.4) 40%, var(--bg-0) 98%),
              linear-gradient(90deg, rgba(10,10,10,0.8) 0%, transparent 60%)
            `,
          }}
        />

        {/* Content, bottom-third, left-aligned */}
        <div className="absolute start-4 end-4 bottom-10 z-10 max-w-[720px] sm:start-10 sm:end-10 sm:bottom-[60px]">
          <motion.h1
            className="font-display mb-5 leading-none font-semibold text-white drop-shadow-2xl"
            style={{ fontSize: 'clamp(3rem, 7vw, 6rem)' }}
            initial={{ opacity: 0, x: -24, y: 8 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.85, ease: CINEMA_EASE, delay: 0.4 }}
          >
            {show.title}
          </motion.h1>

          {/* Description */}
          <motion.p
            className="mb-6 line-clamp-3 max-w-xl text-base leading-relaxed text-white/70 md:text-lg"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: CINEMA_EASE, delay: 0.55 }}
          >
            {show.description}
          </motion.p>

          {/* Metadata row */}
          <motion.div
            className="mb-7 flex flex-wrap items-center gap-4 text-sm text-white/50"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: CINEMA_EASE, delay: 0.65 }}
          >
            <span>{show.genre}</span>
            <span>·</span>
            <span>
              {seasons.length}{' '}
              {isArabic
                ? seasons.length === 1
                  ? 'موسم'
                  : 'مواسم'
                : seasons.length === 1
                  ? 'Season'
                  : 'Seasons'}
            </span>
            <span>·</span>
            <span>
              {show.episodeCount} {isArabic ? 'حلقة' : 'Episodes'}
            </span>
            {show.imdbRating && (
              <>
                <span>·</span>
                <span>★ {show.imdbRating} IMDb</span>
              </>
            )}
          </motion.div>

          {/* CTA buttons — hero pill style */}
          <motion.div
            className="flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: CINEMA_EASE, delay: 0.75 }}
          >
            {firstEpisodeId && show.status === 'streaming' ? (
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <Link
                  href={`/watch/${firstEpisodeId}`}
                  className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold transition-colors hover:bg-white"
                >
                  &#9654;{' '}
                  {firstEpisodeLabel
                    ? isArabic
                      ? `شاهد ${firstEpisodeLabel}`
                      : `Watch ${firstEpisodeLabel}`
                    : t('watchNow')}
                </Link>
              </motion.div>
            ) : (
              <span className="inline-flex cursor-not-allowed items-center rounded-full bg-white/10 px-7 py-3 text-sm font-medium text-white/50">
                {isArabic ? 'قريباً' : 'Coming Soon'}
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
        <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2">
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="flex flex-col items-center gap-1 text-white/30"
          >
            <ChevronDown className="h-5 w-5" />
          </motion.div>
        </div>
      </div>
    </MotionConfig>
  )
}
