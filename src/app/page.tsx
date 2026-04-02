import { HeroBanner } from '@/components/home/hero-banner'
import { ContentRail } from '@/components/home/content-rail'
import { ContinueWatchingRail } from '@/components/home/continue-watching-rail'
import { NewEpisodesRail } from '@/components/home/new-episodes-rail'
import { GenresGrid } from '@/components/home/genres-grid'
import { CtaBanner } from '@/components/home/cta-banner'
import { ReelCard } from '@/components/shows/reel-card'
import {
  Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious
} from '@/components/ui/carousel'
import {
  FEATURED_SHOWS, NOW_STREAMING, COMING_SOON_SHOWS, MOCK_REELS,
  type Show, getSeasonsByShowId, getEpisodesBySeasonId,
} from '@/lib/mock-data'

const featuredWithEpisodes = FEATURED_SHOWS.map((show) => {
  const seasons = getSeasonsByShowId(show.id)
  const firstEpisodeId = seasons
    .flatMap((s) => getEpisodesBySeasonId(s.id))
    .find((ep) => ep.status === 'published')?.id
  return { show, firstEpisodeId }
})

export default function HomePage() {
  return (
    <div>
      <HeroBanner shows={featuredWithEpisodes} />

      <div className="mt-16 space-y-10 pb-16">
        <ContinueWatchingRail />
        <NewEpisodesRail />

        <ContentRail title="Now Streaming" shows={NOW_STREAMING} seeAllHref="/series" />
        <ContentRail title="Coming Soon" shows={COMING_SOON_SHOWS} seeAllHref="/coming-soon" />

        {/* Reels section */}
        <section>
          <div className="px-6 md:px-12">
            <h2 className="text-2xl font-bold text-foreground">Reels</h2>
          </div>
          <Carousel opts={{ align: 'start', containScroll: 'trimSnaps', slidesToScroll: 1 }} className="mt-4">
            <CarouselContent className="-ml-4 px-6 md:px-12">
              {MOCK_REELS.map((reel) => (
                <CarouselItem key={reel.id} className="basis-1/3 pl-4 sm:basis-1/4 lg:basis-1/5 xl:basis-1/6">
                  <ReelCard reel={reel} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden h-10 w-10 rounded-full border-0 bg-surface-3/80 text-primary backdrop-blur-sm hover:bg-surface-3 md:-left-4 md:flex" />
            <CarouselNext className="hidden h-10 w-10 rounded-full border-0 bg-surface-3/80 text-primary backdrop-blur-sm hover:bg-surface-3 md:-right-4 md:flex" />
          </Carousel>
        </section>

        <GenresGrid />
        <CtaBanner />
      </div>
    </div>
  )
}
