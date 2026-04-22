'use client'

import { useLocale } from 'next-intl'
import { PortraitShowCard } from '@/components/shows/portrait-show-card'
import { GlowBadge } from '@/components/primitives/glow-badge'
import type { ViewShow } from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'

interface ComingSoonShowCardProps {
  show: ViewShow
}

export function ComingSoonShowCard({ show }: ComingSoonShowCardProps) {
  const brandColorHex = BRAND_COLOR_HEX[show.brandColor]
  const locale = useLocale()
  const isArabic = locale === 'ar'

  return (
    <div className="relative opacity-85">
      <PortraitShowCard show={show} />
      {/* Override click — coming soon shows aren't watchable */}
      <div className="absolute inset-0 cursor-default" onClick={(e) => e.preventDefault()} />
      {/* Coming soon badge */}
      <div className="absolute top-3 right-3 z-10">
        <GlowBadge
          label={isArabic ? 'قريباً' : 'Coming Soon'}
          color={brandColorHex}
          pulse={true}
        />
      </div>
    </div>
  )
}
