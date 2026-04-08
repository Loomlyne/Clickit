'use client'

import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel'
import { EpisodeCard } from '@/components/shows/episode-card'
import { PlaceholderCard } from '@/components/shows/placeholder-card'
import { SectionHeader } from '@/components/primitives/section-header'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'
import type { NewEpisodeItem } from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'

interface NewEpisodesRailProps {
  episodes: NewEpisodeItem[]
  minCards?: number
}

export function NewEpisodesRail({ episodes, minCards = 6 }: NewEpisodesRailProps) {
  const placeholderCount = Math.max(0, minCards - episodes.length)
  const accentColor = episodes[0] ? BRAND_COLOR_HEX[episodes[0].showBrandColor] : undefined

  return (
    <ScrollReveal>
      <section className="space-y-4">
        <SectionHeader title="New Episodes" accentColor={accentColor} />

        <div className="px-6 md:px-12 overflow-hidden">
          <Carousel
            opts={{
              align: 'start',
              containScroll: 'trimSnaps',
              dragFree: false,
              loop: false,
              slidesToScroll: 1,
            }}
          >
            <CarouselContent>
              {episodes.map((ep) => (
                <CarouselItem
                  key={ep.id}
                  className="basis-[85%] sm:basis-1/2 md:basis-1/3 lg:basis-1/4 flex-shrink-0"
                >
                  <EpisodeCard episode={ep} />
                </CarouselItem>
              ))}
              {Array.from({ length: placeholderCount }).map((_, i) => (
                <CarouselItem
                  key={`placeholder-${i}`}
                  className="basis-[85%] sm:basis-1/2 md:basis-1/3 lg:basis-1/4 flex-shrink-0"
                >
                  <PlaceholderCard />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>
      </section>
    </ScrollReveal>
  )
}
