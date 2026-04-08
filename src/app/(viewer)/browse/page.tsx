import { HeroBanner } from '@/components/home/hero-banner'
import { ContentRail } from '@/components/home/content-rail'
import { ContinueWatchingRail } from '@/components/home/continue-watching-rail'
import { NewEpisodesRail } from '@/components/home/new-episodes-rail'
import { GenresGrid } from '@/components/home/genres-grid'
import { CtaBanner } from '@/components/home/cta-banner'
import {
  getFeaturedShows,
  getStreamingShows,
  getComingSoonShows,
  getNewEpisodes,
  getFirstEpisodesForShows,
} from '@/lib/queries'

export default async function BrowsePage() {
  // Fetch all data from Supabase in parallel
  const [featured, streaming, comingSoon, newEpisodes] = await Promise.all([
    getFeaturedShows(),
    getStreamingShows(),
    getComingSoonShows(),
    getNewEpisodes(),
  ])

  // Batch: one query for all featured shows' first episodes (was 2N queries)
  const firstEpisodeMap = await getFirstEpisodesForShows(featured.map(s => s.id))
  const featuredWithEpisodes = featured.map((show) => ({
    show,
    firstEpisodeId: firstEpisodeMap[show.id],
  }))

  return (
    <div>
      {featuredWithEpisodes.length > 0 && (
        <HeroBanner shows={featuredWithEpisodes} />
      )}

      <div className="mt-20 space-y-14 pb-20">
        <ContinueWatchingRail />
        {newEpisodes.length > 0 && (
          <NewEpisodesRail episodes={newEpisodes} />
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
