'use client'

import { motion, MotionConfig } from 'motion/react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  type Show,
  brandColorBgMap,
  brandColorHexMap,
} from '@/lib/mock-data'

interface SeriesDetailHeroProps {
  show: Show
  firstEpisodeLabel?: string // e.g. "S1 E1" for the CTA button
}

const CINEMA_EASE = [0.16, 1, 0.3, 1] as const

export function SeriesDetailHero({
  show,
  firstEpisodeLabel,
}: SeriesDetailHeroProps) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="-mt-16 relative min-h-[80vh] w-full overflow-hidden">
        {/* Background layer — brand color fill with ghost text */}
        <div
          className={`absolute inset-0 ${brandColorBgMap[show.brandColor]}`}
        >
          <div className="absolute inset-0 flex items-center justify-center select-none pointer-events-none">
            <span
              className="text-[20vw] font-black tracking-tighter leading-none text-white/10"
              style={{ fontStretch: 'condensed' }}
            >
              {show.title.split(' ')[0]}
            </span>
          </div>
        </div>

        {/* Ambient color glow — same radial-gradient as hero-slide.tsx */}
        <div
          className="absolute inset-0 z-[1]"
          style={{
            background: `radial-gradient(ellipse 80% 80% at 60% 40%, ${brandColorHexMap[show.brandColor]}55 0%, ${brandColorHexMap[show.brandColor]}22 40%, transparent 70%)`,
          }}
        />

        {/* Deep cinematic gradient — exact match to hero-slide.tsx */}
        <div
          className="absolute inset-0 z-[2]"
          style={{
            background: [
              'linear-gradient(to right, rgba(8,8,12,0.96) 0%, rgba(8,8,12,0.72) 35%, rgba(8,8,12,0.25) 65%, rgba(8,8,12,0) 100%)',
              'linear-gradient(to top, rgba(8,8,12,1) 0%, rgba(8,8,12,0.85) 18%, rgba(8,8,12,0.3) 40%, rgba(8,8,12,0) 65%)',
              'linear-gradient(to bottom, rgba(8,8,12,0.4) 0%, transparent 15%)',
            ].join(', '),
          }}
        />

        {/* Content layer — staggered reveal */}
        <div className="absolute bottom-0 left-0 z-10 pb-12 px-6 md:px-12">
          {/* Genre label */}
          <motion.p
            className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/50"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: CINEMA_EASE, delay: 0.3 }}
          >
            {show.genre}
          </motion.p>

          {/* Show title — slides in from left */}
          <motion.h1
            className="max-w-[640px] text-4xl font-black leading-tight tracking-tight text-white drop-shadow-2xl md:text-5xl lg:text-6xl"
            initial={{ opacity: 0, x: -24, y: 8 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.85, ease: CINEMA_EASE, delay: 0.45 }}
          >
            {show.title}
          </motion.h1>

          {/* Tagline */}
          <motion.p
            className="mt-3 max-w-[480px] text-sm leading-relaxed text-white/65 md:text-base line-clamp-1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: CINEMA_EASE, delay: 0.65 }}
          >
            {show.tagline}
          </motion.p>

          {/* Metadata chips */}
          <motion.div
            className="mt-3 flex gap-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: CINEMA_EASE, delay: 0.75 }}
          >
            <Badge variant="secondary">{show.genre}</Badge>
            <Badge variant="secondary" className="text-muted-foreground text-xs">
              {show.seasonCount} Season{show.seasonCount > 1 ? 's' : ''}
            </Badge>
            <Badge variant="secondary" className="text-muted-foreground text-xs">
              {show.episodeCount} Episodes
            </Badge>
          </motion.div>

          {/* CTA button */}
          <motion.div
            className="mt-5"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: CINEMA_EASE, delay: 0.85 }}
          >
            {firstEpisodeLabel ? (
              <Button
                variant="default"
                size="lg"
                className="px-10 py-5 text-base font-semibold shadow-lg shadow-black/40"
                asChild
              >
                <a href="#">Watch {firstEpisodeLabel}</a>
              </Button>
            ) : (
              <Button
                variant="default"
                size="lg"
                className="px-10 py-5 text-base font-semibold shadow-lg shadow-black/40"
                disabled
              >
                Coming Soon
              </Button>
            )}
          </motion.div>
        </div>
      </div>
    </MotionConfig>
  )
}
