'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { CINEMA_EASE } from '@/lib/cinema'

export function LandingHeroAnimations({ children }: { children: React.ReactNode }) {
  return (
    <>
      <motion.p
        className="mb-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: CINEMA_EASE, delay: 0.1 }}
      >
        Spacelight Studios Presents
      </motion.p>

      <motion.div
        className="mb-12"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: CINEMA_EASE, delay: 0.25 }}
      >
        {children}
      </motion.div>

      <motion.h1
        className="font-display mb-6 font-medium leading-[1.1] tracking-tighter text-white"
        style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', textWrap: 'balance' }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: CINEMA_EASE, delay: 0.4 }}
      >
        Every Story Clicks.
      </motion.h1>

      <motion.p
        className="mx-auto mb-12 max-w-2xl text-base font-light leading-relaxed text-white/40 md:text-lg"
        style={{ textWrap: 'balance' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        Stream award-winning Arabic and English content from Abu Dhabi — travel, health, music, comedy, cooking, kids, and more.
      </motion.p>

      <motion.div
        className="flex flex-col items-center gap-4 sm:flex-row"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: CINEMA_EASE, delay: 0.55 }}
      >
        <Link
          href="/browse"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-sm font-medium text-primary-foreground transition-all hover:bg-[#4E50AC] hover:-translate-y-0.5"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
          </svg>
          Browse Shows
        </Link>
        <Link
          href="/auth"
          className="inline-flex items-center rounded-full border border-white/10 bg-[#0F1115] px-8 py-4 text-sm font-medium text-white transition-all hover:border-white/30 hover:-translate-y-0.5"
        >
          Sign In
        </Link>
      </motion.div>

      <motion.div
        className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ duration: 0.5, delay: 0.9 }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
          Scroll to explore
        </span>
        <motion.span
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="text-base text-white"
          aria-hidden="true"
        >
          ↓
        </motion.span>
      </motion.div>
    </>
  )
}
