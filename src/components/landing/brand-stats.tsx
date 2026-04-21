'use client'

import { useLocale } from 'next-intl'
import { motion } from 'motion/react'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'

const STATS_EN = [
  { label: 'Library', value: '15', suffix: '+', description: 'Exclusive Originals', color: '#9F54A0' },
  { label: 'Audio', value: '2', suffix: '', description: 'Immersive Languages', color: '#50A258' },
  { label: 'Origin', value: 'UAE', suffix: '', description: 'Abu Dhabi · Spacelight', color: '#EA8C2E' },
  { label: 'Access', value: 'Free', suffix: '', description: 'No subscription required', color: '#DB3F34' },
]

const STATS_AR = [
  { label: 'المكتبة', value: '15', suffix: '+', description: 'إنتاجات أصلية حصرية', color: '#9F54A0' },
  { label: 'الصوتيات', value: '2', suffix: '', description: 'لغتان غامرتان', color: '#50A258' },
  { label: 'المنشأ', value: 'الإمارات', suffix: '', description: 'أبوظبي · Spacelight', color: '#EA8C2E' },
  { label: 'الوصول', value: 'مجاني', suffix: '', description: 'لا اشتراك مطلوب', color: '#DB3F34' },
]

export function BrandStats() {
  const locale = useLocale()
  const isArabic = locale === 'ar'
  const STATS = isArabic ? STATS_AR : STATS_EN
  return (
    <ScrollReveal>
      <div className="px-6 md:px-12">
        {/* Centered horizontal rule with label */}
        <div className="mb-16 flex items-center gap-6">
          <div className="h-px flex-1 bg-white/[0.07]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/25">
            {isArabic ? 'بالأرقام' : 'By the numbers'}
          </span>
          <div className="h-px flex-1 bg-white/[0.07]" />
        </div>

        {/* Stats strip — no card, editorial feel */}
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {STATS.map(({ label, value, suffix, description, color }, i) => (
            <motion.div
              key={label}
              className="group relative flex flex-col items-center justify-center px-4 py-10 text-center"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: i * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {/* Left border divider (except first on each row) */}
              {i % 2 !== 0 && (
                <div className="absolute inset-y-4 left-0 w-px bg-white/[0.07] lg:inset-y-6" />
              )}
              {i >= 2 && (
                <div className="absolute inset-x-6 top-0 h-px bg-white/[0.07] lg:hidden" />
              )}
              {i > 0 && (
                <div className="absolute inset-y-6 left-0 hidden w-px bg-white/[0.07] lg:block" />
              )}

              {/* Color accent bar */}
              <div
                className="mb-5 h-0.5 w-10 rounded-full transition-all duration-300 group-hover:w-14"
                style={{ background: color }}
              />

              {/* Number */}
              <div className="flex items-baseline gap-1">
                <span
                  className="font-display font-black leading-none text-white"
                  style={{
                    fontSize: value.length > 4 ? 'clamp(2.25rem, 4vw, 3rem)' : 'clamp(3.5rem, 6vw, 5.5rem)',
                    letterSpacing: '-0.05em',
                  }}
                >
                  {value}
                </span>
                {suffix && (
                  <span
                    className="text-4xl font-black leading-none"
                    style={{ color, letterSpacing: '-0.04em' }}
                  >
                    {suffix}
                  </span>
                )}
              </div>

              {/* Description */}
              <span className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/36">
                {description}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </ScrollReveal>
  )
}
