// Rail — matches handoff .rail with native flex scroll
import { useLocale } from 'next-intl'
import { ArrowRight } from 'lucide-react'

import { ShowCard } from '@/components/shows/show-card'
import { PlaceholderCard } from '@/components/shows/placeholder-card'
import type { ViewShow } from '@/lib/queries'

interface ContentRailProps {
  title: string
  eyebrow?: string
  shows: ViewShow[]
  minCards?: number
}

export function ContentRail({
  title,
  eyebrow,
  shows,
  minCards = 6,
}: ContentRailProps) {
  const locale = useLocale()
  const isArabic = locale === 'ar'
  const placeholderCount = Math.max(0, minCards - shows.length)

  return (
    <section className="rail px-10 pb-3 pt-8">
      {/* Rail header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          {eyebrow && <div className="mono mb-1.5">{eyebrow}</div>}
          <h2 className="font-display m-0 text-[26px]">{title}</h2>
        </div>
        <a className="mono inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5" href="#">
          {isArabic ? 'عرض الكل' : 'View all'} <ArrowRight className="size-3" />
        </a>
      </div>

      {/* Native scroll track */}
      <div className="flex gap-[var(--rail-gap)] overflow-x-auto scroll-snap-x-mandatory py-1.5 pb-5 scrollbar-hide">
        {shows.map((show) => (
          <ShowCard key={show.id} show={show} />
        ))}
        {Array.from({ length: placeholderCount }).map((_, i) => (
          <PlaceholderCard key={`placeholder-${i}`} />
        ))}
      </div>
    </section>
  )
}
