import { HeroBanner } from '@/components/home/hero-banner'
import { ContentRail } from '@/components/home/content-rail'
import { ContinueWatchingRail } from '@/components/home/continue-watching-rail'
import { GenresGrid } from '@/components/home/genres-grid'
import { CtaBanner } from '@/components/home/cta-banner'
import { ReelCard } from '@/components/shows/reel-card'
import { SectionHeader } from '@/components/primitives/section-header'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'
import {
  Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious
} from '@/components/ui/carousel'
import { MOCK_REELS } from '@/lib/mock-data'
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

      <div className="mt-16 space-y-10 pb-16">
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

        {/* Reels section — still mock (no reels table) */}
        <ScrollReveal>
          <section>
            <SectionHeader title="Reels" />
            <Carousel opts={{ align: 'start', containScroll: 'trimSnaps', slidesToScroll: 1 }}>
              <CarouselContent className="-ml-4 px-6 md:px-12">
                {MOCK_REELS.map((reel) => (
                  <CarouselItem key={reel.id} className="basis-1/3 pl-4 sm:basis-1/4 lg:basis-1/5 xl:basis-1/6">
                    <ReelCard reel={reel} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="hidden h-12 w-12 rounded-full border border-white/10 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white md:-left-4 md:flex" />
              <CarouselNext className="hidden h-12 w-12 rounded-full border border-white/10 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white md:-right-4 md:flex" />
            </Carousel>
          </section>
        </ScrollReveal>

        <GenresGrid />
        <CtaBanner />
      </div>
    </div>
  )
}
