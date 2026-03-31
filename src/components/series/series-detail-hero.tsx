'use client'

import Link from 'next/link'
import { motion, MotionConfig } from 'motion/react'
import { ArrowLeft } from 'lucide-react'

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
  firstEpisodeId?: string // episode ID for watch page link
}

const CINEMA_EASE = [0.16, 1, 0.3, 1] as const

export function SeriesDetailHero({
  show,
  firstEpisodeLabel,
  firstEpisodeId,
}: SeriesDetailHeroProps) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="-mt-16 relative min-h-[80vh] w-full overflow-hidden">
        {/* Background layer — Ken Burns slow zoom like home hero */}
        <motion.div
          className={`absolute inset-0 ${brandColorBgMap[show.brandColor]}`}
          initial={{ scale: 1 }}
          animate={{ scale: 1.08 }}
          transition={{ duration: 12, ease: 'linear', repeat: Infinity, repeatType: 'reverse' }}
        >
          <div className="absolute inset-0 flex items-center justify-center select-none pointer-events-none">
            <span
              className="text-[20vw] font-black tracking-tighter leading-none text-white/10"
              style={{ fontStretch: 'condensed' }}
            >
              {show.title.split(' ')[0]}
            </span>
          </div>
        </motion.div>

        {/* Ambient color glow — same radial-gradient as hero-slide.tsx */}
        <motion.div
          className="absolute inset-0 z-[1]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5, delay: 0.2 }}
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

        {/* Back navigation */}
        <motion.div
          className="absolute top-20 left-0 z-10 px-6 md:px-12"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: CINEMA_EASE, delay: 0.2 }}
        >
          <Link
            href="/series"
            className="inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            All Shows
          </Link>
        </motion.div>

        {/* Content layer — staggered reveal, same position as home hero */}
        <div className="absolute bottom-[128px] left-0 z-10 px-6 md:px-12 max-w-2xl">
          {/* Status badge + Genre label */}
          <motion.div
            className="mb-3 flex items-center gap-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: CINEMA_EASE, delay: 0.3 }}
          >
            <Badge
              className={
                show.status === 'streaming'
                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              }
            >
              {show.status === 'streaming' ? 'Now Streaming' : 'Coming Soon'}
            </Badge>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              {show.genre}
            </span>
          </motion.div>

          {/* Show title — slides in from left */}
          <motion.h1
            className="text-4xl font-black leading-tight tracking-tight text-white drop-shadow-2xl md:text-5xl lg:text-6xl"
            initial={{ opacity: 0, x: -24, y: 8 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.85, ease: CINEMA_EASE, delay: 0.45 }}
          >
            {show.title}
          </motion.h1>

          {/* Description — full synopsis */}
          <motion.p
            className="mt-4 text-sm leading-relaxed text-white/70 md:text-base"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: CINEMA_EASE, delay: 0.6 }}
          >
            {show.description}
          </motion.p>

          {/* Metadata chips */}
          <motion.div
            className="mt-4 flex gap-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: CINEMA_EASE, delay: 0.7 }}
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
            className="mt-6"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: CINEMA_EASE, delay: 0.8 }}
          >
            {firstEpisodeLabel && firstEpisodeId ? (
              <Button
                variant="default"
                size="lg"
                className="px-10 py-5 text-base font-semibold shadow-lg shadow-black/40"
                asChild
              >
                <Link href={`/watch/${firstEpisodeId}`}>Watch {firstEpisodeLabel}</Link>
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
