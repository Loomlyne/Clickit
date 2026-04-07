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
      <section className="space-y-4">
        <SectionHeader
          title={title}
          seeAllHref={seeAllHref}
          accentColor={accentColor}
        />

        {/* Horizontal carousel */}
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
            <CarouselContent className="-ml-4">
              {shows.map((show) => (
                <CarouselItem
                  key={show.id}
                  className="basis-[300px] flex-shrink-0 pl-4"
                >
                  <ShowCard show={show} />
                </CarouselItem>
              ))}
              {Array.from({ length: placeholderCount }).map((_, i) => (
                <CarouselItem
                  key={`placeholder-${i}`}
                  className="basis-[300px] flex-shrink-0 pl-4"
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
