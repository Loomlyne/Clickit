'use client'

import { motion } from 'motion/react'
import Link from 'next/link'
import { Heart, ThumbsUp, Volume2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  type Show,
  brandColorBgMap,
  brandColorHexMap,
} from '@/lib/mock-data'
import { CINEMATIC_GRADIENT, CINEMA_EASE } from '@/lib/cinema'

interface HeroSlideProps {
  show: Show
  isActive: boolean
  firstEpisodeId?: string
}

export function HeroSlide({ show, isActive, firstEpisodeId }: HeroSlideProps) {
  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: isActive ? 1 : 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2, ease: 'easeInOut' }}
    >
      {/* Ken Burns — slow imperceptible zoom over 12s makes still backgrounds feel alive */}
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

      {/* Ambient color glow — larger and more saturated for dramatic atmosphere */}
      <motion.div
        className="absolute inset-0 z-[1]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 0.2 }}
        style={{
          background: `radial-gradient(ellipse 80% 80% at 60% 40%, ${brandColorHexMap[show.brandColor]}55 0%, ${brandColorHexMap[show.brandColor]}22 40%, transparent 70%)`,
        }}
      />

      {/* Deep cinematic gradient — strong left vignette + heavy bottom fade */}
      <div
        className="absolute inset-0 z-[2]"
        style={{ background: CINEMATIC_GRADIENT }}
      />

      {/* Content — staggered reveal: genre label → title → tagline → button */}
      <div className="absolute bottom-[128px] left-0 z-10 px-6 md:px-12">

        {/* Genre label */}
        <motion.p
          className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/50"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: CINEMA_EASE, delay: 0.3 }}
        >
          {show.genre}
        </motion.p>

        {/* Title — slides in from left */}
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
          className="mt-3 max-w-[480px] text-sm leading-relaxed text-white/65 md:text-base"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: CINEMA_EASE, delay: 0.65 }}
        >
          {show.tagline}
        </motion.p>

        {/* Description */}
        <motion.p
          className="mt-2 max-w-[480px] text-sm leading-relaxed text-white/55 line-clamp-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: CINEMA_EASE, delay: 0.75 }}
        >
          {show.description}
        </motion.p>

        {/* CTA button */}
        <motion.div
          className="mt-7"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: CINEMA_EASE, delay: 0.85 }}
        >
          <Button
            variant="default"
            size="lg"
            className="px-10 py-5 text-base font-semibold shadow-lg shadow-black/40"
            asChild
          >
            <Link href={firstEpisodeId ? `/watch/${firstEpisodeId}` : `/series/${show.slug}`}>
              {firstEpisodeId ? 'Watch Now' : 'View Show'}
            </Link>
          </Button>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          className="mt-4 flex items-center gap-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: CINEMA_EASE, delay: 0.95 }}
        >
          <Button variant="ghost" size="icon" className="text-white/50 hover:text-white" aria-label="Add to list">
            <Heart className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-white/50 hover:text-white" aria-label="Like">
            <ThumbsUp className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-white/50 hover:text-white" aria-label="Audio options">
            <Volume2 className="size-5" />
          </Button>
        </motion.div>
      </div>
    </motion.div>
  )
}
