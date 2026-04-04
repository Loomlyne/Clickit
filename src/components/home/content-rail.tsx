'use client'

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { ShowCard } from '@/components/shows/show-card'
import { PlaceholderCard } from '@/components/shows/placeholder-card'
import { SectionHeader } from '@/components/primitives/section-header'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'
import type { ViewShow } from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'

interface ContentRailProps {
  title: string
  shows: ViewShow[]
  seeAllHref?: string
  /** Minimum total cards (real + placeholder) for visual density. Defaults to 6. */
  minCards?: number
}

export function ContentRail({
  title,
  shows,
  seeAllHref,
  minCards = 6,
}: ContentRailProps) {
  const placeholderCount = Math.max(0, minCards - shows.length)
  const accentColor = shows[0] ? BRAND_COLOR_HEX[shows[0].brandColor] : undefined

  return (
    <ScrollReveal>
      <section>
        <SectionHeader
          title={title}
          seeAllHref={seeAllHref}
          accentColor={accentColor}
        />

        {/* Horizontal carousel */}
        <Carousel
          opts={{
            align: 'start',
            containScroll: 'trimSnaps',
            dragFree: false,
            loop: false,
            slidesToScroll: 1,
          }}
        >
          <CarouselContent className="-ml-4 px-6 md:px-12">
            {shows.map((show) => (
              <CarouselItem
                key={show.id}
                className="pl-4 basis-[280px] flex-shrink-0"
              >
                <ShowCard show={show} />
              </CarouselItem>
            ))}
            {Array.from({ length: placeholderCount }).map((_, i) => (
              <CarouselItem
                key={`placeholder-${i}`}
                className="pl-4 basis-[280px] flex-shrink-0"
              >
                <PlaceholderCard />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden h-12 w-12 rounded-full border border-white/10 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white md:-left-4 md:flex" />
          <CarouselNext className="hidden h-12 w-12 rounded-full border border-white/10 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white md:-right-4 md:flex" />
        </Carousel>
      </section>
    </ScrollReveal>
  )
}
