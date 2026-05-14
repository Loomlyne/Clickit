// Rail — matches handoff .rail with native flex scroll
import { useTranslations } from 'next-intl'
import { ArrowRight } from 'lucide-react'
import { Link } from '@/i18n/navigation'

import { DragScroll } from '@/components/primitives/drag-scroll'
import { ShowCard } from '@/components/shows/show-card'
import { PlaceholderCard } from '@/components/shows/placeholder-card'
import type { ViewShow } from '@/lib/queries'

interface ContentRailProps {
  title: string
  shows: ViewShow[]
  minCards?: number
  seeAllHref?: string
  /** When set, wraps the rail in a section with this id (e.g. watch-page anchor). */
  sectionId?: string
}

export function ContentRail({
  title,
  shows,
  minCards = 6,
  seeAllHref,
  sectionId,
}: ContentRailProps) {
  const t = useTranslations('watch')
  const placeholderCount = Math.max(0, minCards - shows.length)

  return (
    <section id={sectionId} className="rail px-10 pt-8 pb-3">
      {/* Rail header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display m-0 text-[26px] tracking-[0.04em] uppercase">
            {title}
          </h2>
        </div>
        {seeAllHref ? (
          <Link
            className="mono inline-flex min-h-11 shrink-0 items-center gap-1.5"
            href={seeAllHref}
          >
            {t('viewAll')} <ArrowRight className="size-3 rtl:scale-x-[-1]" />
          </Link>
        ) : (
          <span className="mono inline-flex min-h-11 shrink-0 items-center gap-1.5 text-[var(--text-mute)]">
            {t('viewAll')} <ArrowRight className="size-3 rtl:scale-x-[-1]" />
          </span>
        )}
      </div>

      {/* Native scroll track — vertical grid on mobile, horizontal rail on sm+ */}
      <DragScroll
        touchMode="responsive"
        className="content-rail-track sm:scroll-snap-x-mandatory sm:scrollbar-hide flex flex-col gap-[var(--rail-gap)] py-1.5 pb-5 sm:flex-row sm:overflow-x-auto"
      >
        {shows.map((show) => (
          <ShowCard key={show.id} show={show} />
        ))}
        {Array.from({ length: placeholderCount }).map((_, i) => (
          <PlaceholderCard key={`placeholder-${i}`} />
        ))}
      </DragScroll>
    </section>
  )
}
