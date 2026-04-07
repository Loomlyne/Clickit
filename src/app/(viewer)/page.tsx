import { HeroBanner } from '@/components/home/hero-banner'
import { ContentRail } from '@/components/home/content-rail'
import { ContinueWatchingRail } from '@/components/home/continue-watching-rail'
import { GenresGrid } from '@/components/home/genres-grid'
import { CtaBanner } from '@/components/home/cta-banner'
import {
  getFeaturedShows,
  getStreamingShows,
  getComingSoonShows,
  getNewEpisodeShows,
  getSeasonsByShowId,
  getEpisodesBySeasonId,
} from '@/lib/queries'

export default async function HomePage() {
  // Fetch all data from Supabase in parallel
  const [featured, streaming, comingSoon, newEpisodeShows] = await Promise.all([
    getFeaturedShows(),
    getStreamingShows(),
    getComingSoonShows(),
    getNewEpisodeShows(),
  ])

  // Resolve first episode for each featured show (for "Watch S1 E1" button)
  const featuredWithEpisodes = await Promise.all(
    featured.map(async (show) => {
      const seasons = await getSeasonsByShowId(show.id)
      const firstSeason = seasons[0]
      let firstEpisodeId: string | undefined
      if (firstSeason) {
        const eps = await getEpisodesBySeasonId(firstSeason.id)
        firstEpisodeId = eps[0]?.id
      }
      return { show, firstEpisodeId }
    })
  )

  return (
    <div>
      {featuredWithEpisodes.length > 0 && (
        <HeroBanner shows={featuredWithEpisodes} />
      )}

      <div className="mt-20 space-y-14 pb-20">
        <ContinueWatchingRail />
        {newEpisodeShows.length > 0 && (
          <ContentRail title="New Episodes" shows={newEpisodeShows} />
        )}

        {streaming.length > 0 && (
          <ContentRail title="Now Streaming" shows={streaming} />
        )}
        {comingSoon.length > 0 && (
          <ContentRail title="Coming Soon" shows={comingSoon} />
        )}

        <GenresGrid />
        <CtaBanner />
      </div>
    </div>
  )
}
