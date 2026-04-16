'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { CINEMA_EASE } from '@/lib/cinema'

export function LandingHeroAnimations({ children }: { children: React.ReactNode }) {
  return (
    <>
      <motion.p
        className="mb-4 text-[11px] font-medium uppercase tracking-[0.28em] text-white/48"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: CINEMA_EASE, delay: 0.1 }}
      >
        Spacelight Studios Presents
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: CINEMA_EASE, delay: 0.25 }}
      >
        {children}
      </motion.div>

      <motion.p
        className="font-display mt-5 font-semibold leading-tight text-white/80"
        style={{ fontSize: 'clamp(1.5rem, 4vw, 3rem)' }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: CINEMA_EASE, delay: 0.4 }}
      >
        Every Story Clicks.
      </motion.p>

      <motion.p
        className="mt-3 max-w-xl text-sm leading-7 text-white/52 md:text-base"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        Stream award-winning Arabic and English content from Abu Dhabi — travel, health, music, comedy, cooking, kids, and more.
      </motion.p>

      <motion.div
        className="mt-7 flex flex-wrap items-center gap-3"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: CINEMA_EASE, delay: 0.55 }}
      >
        <Link
          href="/browse"
          className="inline-flex items-center rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-[0_16px_40px_rgba(96,115,255,0.28)] transition-colors hover:bg-[#7082ff]"
        >
          Browse Shows
        </Link>
        <Link
          href="/auth"
          className="inline-flex items-center rounded-full border border-white/14 bg-white/[0.04] px-7 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/[0.08]"
        >
          Sign In
        </Link>
      </motion.div>

      <motion.div
        className="mt-10 flex items-center gap-2 text-white/28"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.9 }}
      >
        <motion.span
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="text-lg"
          aria-hidden="true"
        >
          ↓
        </motion.span>
        <span className="text-[11px] uppercase tracking-[0.22em]">Scroll to explore</span>
      </motion.div>
    </>
  )
}
