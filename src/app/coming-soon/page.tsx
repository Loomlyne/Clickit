import Link from 'next/link'
import type { Metadata } from 'next'

import { Button } from '@/components/ui/button'
import { ComingSoonShowCard } from '@/components/shows/coming-soon-show-card'
import { EpisodeRow } from '@/components/series/episode-row'
import {
  COMING_SOON_SHOWS,
  getComingSoonEpisodesFromStreamingShows,
  type Show,
} from '@/lib/mock-data'

export const metadata: Metadata = {
  title: 'Coming Soon | Clickit Story',
  description: 'Upcoming shows and new episodes coming to Clickit Story',
}

export default function ComingSoonPage() {
  const comingSoonShows = COMING_SOON_SHOWS
  const upcomingEpisodes = getComingSoonEpisodesFromStreamingShows()

  // Group upcoming episodes by show for section 2 display
  const episodesByShow = upcomingEpisodes.reduce(
    (acc, ep) => {
      if (!acc[ep.showTitle]) {
        acc[ep.showTitle] = { brandColor: ep.showBrandColor, episodes: [] }
      }
      acc[ep.showTitle].episodes.push(ep)
      return acc
    },
    {} as Record<
      string,
      { brandColor: Show['brandColor']; episodes: typeof upcomingEpisodes }
    >
  )

  return (
    <div className="px-6 pt-12 pb-16 md:px-12">
      {/* Page header */}
      <h1 className="text-4xl font-bold text-foreground lg:text-5xl">
        Coming Soon
      </h1>
      <p className="mt-3 text-base text-muted-foreground">
        New shows and episodes on the way.
      </p>

      {/* Section 1: Upcoming Shows */}
      {comingSoonShows.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-2xl font-bold text-foreground">Upcoming Shows</h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {comingSoonShows.map((show) => (
              <ComingSoonShowCard key={show.id} show={show} />
            ))}
          </div>
        </section>
      ) : (
        <section className="mt-10">
          <h2 className="text-2xl font-bold text-foreground">Upcoming Shows</h2>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <h3 className="text-xl font-bold text-foreground">All Caught Up</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              No upcoming shows right now. Browse what&apos;s streaming.
            </p>
            <Link href="/series" className="mt-4">
              <Button variant="default">Browse Series</Button>
            </Link>
          </div>
        </section>
      )}

      {/* Section 2: New Episodes Dropping Soon */}
      {Object.keys(episodesByShow).length > 0 ? (
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-foreground">
            New Episodes Dropping Soon
          </h2>
          <div className="mt-6 space-y-8">
            {Object.entries(episodesByShow).map(
              ([showTitle, { brandColor, episodes }]) => (
                <div key={showTitle}>
                  <h3 className="mb-3 text-lg font-semibold text-foreground">
                    {showTitle}
                  </h3>
                  <div className="space-y-3">
                    {episodes.map((ep) => (
                      <EpisodeRow
                        key={ep.id}
                        episode={ep}
                        showBrandColor={brandColor}
                      />
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </section>
      ) : (
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-foreground">
            New Episodes Dropping Soon
          </h2>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <h3 className="text-xl font-bold text-foreground">
              No New Episodes Scheduled
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Check back for upcoming episode releases.
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
