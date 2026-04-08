'use client'

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
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
                  className="basis-[300px] flex-shrink-0"
                >
                  <EpisodeCard episode={ep} />
                </CarouselItem>
              ))}
              {Array.from({ length: placeholderCount }).map((_, i) => (
                <CarouselItem
                  key={`placeholder-${i}`}
                  className="basis-[300px] flex-shrink-0"
                >
                  <PlaceholderCard />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden h-12 w-12 rounded-full border border-white/10 bg-[#0d1118]/88 text-white shadow-[0_18px_48px_rgba(0,0,0,0.32)] backdrop-blur-xl hover:bg-[#151b25] md:-left-2 md:flex" />
            <CarouselNext className="hidden h-12 w-12 rounded-full border border-white/10 bg-[#0d1118]/88 text-white shadow-[0_18px_48px_rgba(0,0,0,0.32)] backdrop-blur-xl hover:bg-[#151b25] md:-right-2 md:flex" />
          </Carousel>
        </div>
      </section>
    </ScrollReveal>
  )
}
