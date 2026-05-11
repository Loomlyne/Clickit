import { getWatchedShowIds, type ViewShow } from '@/lib/queries'
import { HeroBanner } from '@/components/home/hero-banner'

interface FeaturedHeroWithWatchedProps {
  userId: string
  featured: ViewShow[]
  firstEpisodeMap: Record<string, string>
  isMobile: boolean
}

/** Resolves per-show “has watched” for hero CTA — defer behind Suspense so catalog paints first. */
export async function FeaturedHeroWithWatched({
  userId,
  featured,
  firstEpisodeMap,
  isMobile,
}: FeaturedHeroWithWatchedProps) {
  const watchedShowIds = await getWatchedShowIds(
    userId,
    featured.map((s) => s.id)
  )
  const shows = featured.map((show) => ({
    show,
    firstEpisodeId: firstEpisodeMap[show.id],
    hasWatched: watchedShowIds.has(show.id),
  }))
  return <HeroBanner shows={shows} isMobile={isMobile} />
}
