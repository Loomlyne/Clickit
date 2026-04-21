import { redirect } from '@/i18n/navigation'
import { HeroBanner } from '@/components/home/hero-banner'
import { ContentRail } from '@/components/home/content-rail'
import { ContinueWatchingRail } from '@/components/home/continue-watching-rail'
import { NewEpisodesRail } from '@/components/home/new-episodes-rail'
import { GenresGrid } from '@/components/home/genres-grid'
import { CtaBanner } from '@/components/home/cta-banner'
import { createClient } from '@/lib/supabase/server'
import {
  getFeaturedShows,
  getStreamingShows,
  getComingSoonShows,
  getNewEpisodes,
  getFirstEpisodesForShows,
} from '@/lib/queries'
import { getIsMobile } from '@/lib/device'

export default async function BrowsePage() {
  // Resolve user once at the page level and pass it down. Previously the
  // ContinueWatchingRail called getUser() independently, giving this request
  // three auth touch-points (middleware + page + rail). Now it's two.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? null

  // Fetch all data from Supabase in parallel
  const [featured, streaming, comingSoon, newEpisodes, isMobile] = await Promise.all([
    getFeaturedShows(),
    getStreamingShows(),
    getComingSoonShows(),
    getNewEpisodes(),
    getIsMobile(),
  ])

  // D-01: empty catalog redirects to marketing landing page
  if (streaming.length === 0 && comingSoon.length === 0) {
    redirect('/')
  }

  // Batch: one query for all featured shows' first episodes (was 2N queries)
  const firstEpisodeMap = await getFirstEpisodesForShows(featured.map(s => s.id))
  const featuredWithEpisodes = featured.map((show) => ({
    show,
    firstEpisodeId: firstEpisodeMap[show.id],
  }))

  return (
    <div>
      {featuredWithEpisodes.length > 0 && (
        <HeroBanner shows={featuredWithEpisodes} isMobile={isMobile} />
      )}

      <div className="mt-20 space-y-14 pb-20">
        <ContinueWatchingRail userId={userId} />
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
