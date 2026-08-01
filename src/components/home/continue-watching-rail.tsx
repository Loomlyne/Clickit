// Continue Watching Rail — server component, native flex scroll
import { getLocale, getTranslations } from 'next-intl/server'
import { DragScroll } from '@/components/primitives/drag-scroll'
import { getContinueWatchingEpisodes } from '@/lib/queries'
import { ContinueWatchingCard } from '@/components/home/continue-watching-card'
import type { Locale } from '@/lib/locale'

interface ContinueWatchingRailProps {
  userId: string | null
}

export async function ContinueWatchingRail({
  userId,
}: ContinueWatchingRailProps) {
  if (!userId) return null

  const [items, t] = await Promise.all([
    getContinueWatchingEpisodes(userId, (await getLocale()) as Locale),
    getTranslations('watch'),
  ])

  if (items.length === 0) return null

  return (
    <section className="rail px-10 pt-8 pb-3">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h2 className="font-display m-0 text-[26px] font-bold">
            {t('continueWatchingHeading')}
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
