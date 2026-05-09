// New Episodes Rail — native flex scroll, matches handoff Rail pattern
import { useLocale } from 'next-intl'
import { ArrowRight } from 'lucide-react'

import { DragScroll } from '@/components/primitives/drag-scroll'
import { EpisodeCard } from '@/components/shows/episode-card'
import { PlaceholderCard } from '@/components/shows/placeholder-card'
import type { NewEpisodeItem } from '@/lib/queries'

interface NewEpisodesRailProps {
  episodes: NewEpisodeItem[]
  minCards?: number
}

export function NewEpisodesRail({
  episodes,
  minCards = 6,
}: NewEpisodesRailProps) {
  const locale = useLocale()
  const isArabic = locale === 'ar'
  const placeholderCount = Math.max(0, minCards - episodes.length)

  return (
    <section className="rail px-10 pt-8 pb-3">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="mono mb-1.5">
            {isArabic ? 'اختيار كلِك إت' : 'Fresh from the studio'}
          </div>
          <h2 className="font-display m-0 text-[26px]">
            {isArabic ? 'حلقات جديدة' : 'New Episodes'}
          </h2>
        </div>
        <a
          className="mono inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5"
          href="#"
        >
          {isArabic ? 'عرض الكل' : 'View all'} <ArrowRight className="size-3" />
        </a>
      </div>

      <DragScroll className="scrollbar-hide flex gap-[var(--rail-gap)] overflow-x-auto py-1.5 pb-5">
        {episodes.map((ep) => (
          <EpisodeCard key={ep.id} episode={ep} />
        ))}
        {Array.from({ length: placeholderCount }).map((_, i) => (
          <PlaceholderCard key={`placeholder-${i}`} />
        ))}
      </DragScroll>
    </section>
  )
}
