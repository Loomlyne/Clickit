'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { motion } from 'motion/react'
import { CINEMA_EASE } from '@/lib/cinema'

export function LandingHeroAnimations({ logo }: { logo: React.ReactNode }) {
  const t = useTranslations('home')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const isArabic = locale === 'ar'
  return (
    <>
      <motion.p
        className="mb-4 text-[11px] font-medium uppercase tracking-[0.28em] text-white/48"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: CINEMA_EASE, delay: 0.1 }}
      >
        {isArabic ? 'Spacelight Studios تُقدّم' : 'Spacelight Studios Presents'}
      </motion.p>

      {/*
        Logo renders immediately as a Server Component child — no motion
        wrapper. This is intentional: the logo is the LCP element and wrapping
        it in motion.div with opacity 0→1 pushed LCP from ~900ms to ~2000ms
        on desktop. The surrounding text still fades in for polish.
      */}
      {logo}

      <motion.p
        className="font-display mt-5 font-semibold leading-tight text-white/80"
        style={{ fontSize: 'clamp(1.5rem, 4vw, 3rem)' }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: CINEMA_EASE, delay: 0.4 }}
      >
        {t('heroHeadline')}
      </motion.p>

      <motion.p
        className="mt-3 max-w-xl text-sm leading-7 text-white/52 md:text-base"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        {t('heroSubheadline')}
      </motion.p>

      <motion.div
        className="mt-7 flex flex-wrap items-center gap-3"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: CINEMA_EASE, delay: 0.55 }}
      >
        <Link
          href="/watch"
          className="inline-flex items-center rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-[0_16px_40px_rgba(96,115,255,0.28)] transition-colors hover:bg-[#7082ff]"
        >
          {tCommon('browseShows')}
        </Link>
        <Link
          href="/auth"
          className="inline-flex items-center rounded-full border border-white/14 bg-white/[0.04] px-7 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/[0.08]"
        >
          {tCommon('signIn')}
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
        <span className="text-[11px] uppercase tracking-[0.22em]">{isArabic ? 'مرّر لاستكشاف المزيد' : 'Scroll to explore'}</span>
      </motion.div>
    </>
  )
}
