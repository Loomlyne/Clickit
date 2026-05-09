// Continue Watching Rail — server component, native flex scroll
import { getLocale } from 'next-intl/server'
import { DragScroll } from '@/components/primitives/drag-scroll'
import { getContinueWatchingEpisodes } from '@/lib/queries'
import { ContinueWatchingCard } from '@/components/home/continue-watching-card'

interface ContinueWatchingRailProps {
  userId: string | null
}

export async function ContinueWatchingRail({
  userId,
}: ContinueWatchingRailProps) {
  if (!userId) return null

  const [items, locale] = await Promise.all([
    getContinueWatchingEpisodes(userId),
    getLocale(),
  ])

  if (items.length === 0) return null

  const isArabic = locale === 'ar'

  return (
    <section className="rail px-10 pt-8 pb-3">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h2 className="font-display m-0 text-[26px]">
            {isArabic ? 'تابع المشاهدة' : 'Continue Watching'}
          </h2>
        </div>
      </div>

      <DragScroll className="scrollbar-hide flex gap-[var(--rail-gap)] overflow-x-auto py-1.5 pb-5">
        {items.map((item) => (
          <ContinueWatchingCard key={item.episodeId} item={item} />
        ))}
      </DragScroll>
    </section>
  )
}
