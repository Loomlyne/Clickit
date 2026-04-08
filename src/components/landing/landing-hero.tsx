'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'motion/react'
import { CinematicBackdrop } from '@/components/primitives/cinematic-backdrop'
import { CINEMA_EASE } from '@/lib/cinema'

const BRAND_COLORS = ['#2C3569', '#9F54A0', '#50A258', '#DB3F34', '#EA8C2E', '#F8C623']

export function LandingHero() {
  return (
    <section className="relative -mt-24 h-dvh overflow-hidden md:-mt-28">
      {/* Cinematic backdrop: deep indigo bloom */}
      <CinematicBackdrop
        brandColor="#6073FF"
        intensity="high"
        watermarkText="CIT"
      />

      {/* Secondary ambient layers */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 10% 20%, rgba(96,115,255,0.18) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 90% 80%, rgba(159,84,160,0.12) 0%, transparent 70%)',
        }}
      />

      {/* Bottom vignette */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#06070A] via-black/30 to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 w-full px-6 pb-16 md:px-12 md:pb-20">
        <div className="max-w-[52rem]">
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
            <Image
              src="/brand/Clickit_final_logo.svg"
              alt="Clickit Story"
              width={320}
              height={80}
              className="h-14 w-auto md:h-20"
              priority
            />
          </motion.div>

          <motion.p
            className="font-display mt-5 font-semibold leading-tight text-white/80"
            style={{ fontSize: 'clamp(1.5rem, 4vw, 3rem)' }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: CINEMA_EASE, delay: 0.4 }}
          >
            15 Original Programs. One Platform.
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
        </div>
      </div>

      {/* Decorative 6-color brand bar at the very bottom */}
      <div className="absolute inset-x-0 bottom-0 flex h-0.5 opacity-40" aria-hidden="true">
        {BRAND_COLORS.map((color) => (
          <div key={color} className="flex-1" style={{ background: color }} />
        ))}
      </div>
    </section>
  )
}
