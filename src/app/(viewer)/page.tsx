import { HeroBanner } from '@/components/home/hero-banner'
import { ContentRail } from '@/components/home/content-rail'
import { ContinueWatchingRail } from '@/components/home/continue-watching-rail'
import { NewEpisodesRail } from '@/components/home/new-episodes-rail'
import { GenresGrid } from '@/components/home/genres-grid'
import { CtaBanner } from '@/components/home/cta-banner'
import { ReelCard } from '@/components/shows/reel-card'
import { SectionHeader } from '@/components/primitives/section-header'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'
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

        <ContentRail title="Now Streaming" shows={NOW_STREAMING} />
        <ContentRail title="Coming Soon" shows={COMING_SOON_SHOWS} />

        {/* Reels section */}
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
