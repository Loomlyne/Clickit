'use client'

import { motion } from 'motion/react'

import { Button } from '@/components/ui/button'
import {
  type Show,
  brandColorBgMap,
  brandColorHexMap,
} from '@/lib/mock-data'

interface HeroSlideProps {
  show: Show
  isActive: boolean
}

export function HeroSlide({ show, isActive }: HeroSlideProps) {
  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: isActive ? 1 : 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: 'easeInOut' }}
    >
      {/* Artwork background — solid brand color + centered title (placeholder per D-19) */}
      <div
        className={`absolute inset-0 ${brandColorBgMap[show.brandColor]}`}
      >
        <div className="absolute inset-0 flex items-center justify-center text-6xl font-bold text-white/20 select-none">
          {show.title}
        </div>
      </div>

      {/* Ambient color glow (per D-03, DESG-05) */}
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background: `radial-gradient(ellipse at 30% 50%, ${brandColorHexMap[show.brandColor]}40 0%, transparent 70%)`,
        }}
      />

      {/* Gradient overlay — left-to-right + bottom-to-top for text legibility and seamless fade */}
      <div
        className="absolute inset-0 z-[2]"
        style={{
          background: `linear-gradient(to right, rgba(10,10,15,0.85) 0%, rgba(10,10,15,0.6) 40%, rgba(10,10,15,0.2) 70%, rgba(10,10,15,0) 100%), linear-gradient(to top, rgba(10,10,15,1) 0%, rgba(10,10,15,0.4) 30%, rgba(10,10,15,0) 60%)`,
        }}
      />

      {/* Content area — bottom-left positioned text and CTA */}
      <div className="absolute bottom-[120px] left-0 z-10 px-6 md:px-12 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h1 className="max-w-[600px] text-3xl font-bold text-primary-foreground md:text-4xl lg:text-5xl">
            {show.title}
          </h1>
          <div className="h-2" />
          <p className="max-w-[500px] text-sm text-text-secondary md:text-base line-clamp-2">
            {show.tagline}
          </p>
          <div className="h-6" />
          <Button variant="default" size="lg" className="px-8 py-4 text-base">
            Watch Now
          </Button>
        </motion.div>
      </div>
    </motion.div>
  )
}
