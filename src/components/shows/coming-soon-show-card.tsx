'use client'

import { PortraitShowCard } from '@/components/shows/portrait-show-card'
import { GlowBadge } from '@/components/primitives/glow-badge'
import { type Show, brandColorHexMap } from '@/lib/mock-data'

interface ComingSoonShowCardProps {
  show: Show
}

export function ComingSoonShowCard({ show }: ComingSoonShowCardProps) {
  const brandColorHex = brandColorHexMap[show.brandColor]

  return (
    <div className="relative opacity-85">
      <PortraitShowCard show={show} />
      {/* Override click — coming soon shows aren't watchable */}
      <div className="absolute inset-0 cursor-default" onClick={(e) => e.preventDefault()} />
      {/* Coming soon badge */}
      <div className="absolute top-3 right-3 z-10">
        <GlowBadge
          label="Coming Soon"
          color={brandColorHex}
          pulse={true}
        />
      </div>
    </div>
  )
}
