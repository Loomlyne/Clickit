'use client'

import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'
import { EpisodeArtCard } from '@/components/shows/episode-art-card'
import { SectionHeader } from '@/components/primitives/section-header'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'
import { getNewEpisodes, MOCK_SEASONS } from '@/lib/mock-data'

export function NewEpisodesRail() {
  const newEpisodes = getNewEpisodes()
  if (newEpisodes.length === 0) return null

  return (
    <ScrollReveal>
      <section>
        <SectionHeader title="New Episodes" />
        <Carousel
          opts={{ align: 'start', containScroll: 'trimSnaps', dragFree: false, loop: false, slidesToScroll: 1 }}
        >
          <CarouselContent className="-ml-4 px-6 md:px-12">
            {newEpisodes.map((ep) => {
              const season = MOCK_SEASONS.find((s) => s.id === ep.seasonId)
              return (
                <CarouselItem key={ep.id} className="pl-4 basis-[320px] flex-shrink-0">
                  <EpisodeArtCard
                    episode={{
                      id: ep.id,
                      title: ep.title,
                      episodeNumber: ep.episodeNumber,
                      seasonNumber: season?.seasonNumber ?? 1,
                      duration: ep.duration,
                      showTitle: ep.showTitle,
                      showSlug: ep.showSlug,
                      brandColor: ep.showBrandColor,
                    }}
                  />
                </CarouselItem>
              )
            })}
          </CarouselContent>
          <CarouselPrevious className="hidden h-12 w-12 rounded-full border border-white/10 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white md:-left-4 md:flex" />
          <CarouselNext className="hidden h-12 w-12 rounded-full border border-white/10 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white md:-right-4 md:flex" />
        </Carousel>
      </section>
    </ScrollReveal>
  )
}
