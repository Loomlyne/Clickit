'use client'

import { ShowCard } from '@/components/shows/show-card'
import { Badge } from '@/components/ui/badge'
import { type Show } from '@/lib/mock-data'

interface ComingSoonShowCardProps {
  show: Show
}

export function ComingSoonShowCard({ show }: ComingSoonShowCardProps) {
  return (
    <div className="relative">
      {/* Existing ShowCard rendered at ~80% opacity per UI-SPEC */}
      <div className="opacity-80">
        <ShowCard show={show} />
      </div>
      {/* Coming Soon badge overlay -- top-right corner, below the brand ribbon (4px h-1 bar) */}
      <div className="absolute top-5 right-3 z-10">
        <Badge className="bg-brand-orange text-black text-xs font-semibold">
          Coming Soon
        </Badge>
      </div>
    </div>
  )
}
