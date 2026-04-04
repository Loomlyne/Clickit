'use client'

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { PortraitShowCard } from '@/components/shows/portrait-show-card'
import type { ViewShow } from '@/lib/queries'

interface ShowsCarouselProps {
  shows: ViewShow[]
}

export function ShowsCarousel({ shows }: ShowsCarouselProps) {
  return (
    <Carousel
      opts={{ align: 'start', containScroll: 'trimSnaps', dragFree: false, loop: false, slidesToScroll: 1 }}
      className="mt-8"
    >
      <CarouselContent className="-ml-4 px-0">
        {shows.map((show) => (
          <CarouselItem key={show.id} className="basis-1/2 pl-4 sm:basis-1/3 lg:basis-1/4 xl:basis-1/5">
            <PortraitShowCard show={show} />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="hidden h-10 w-10 rounded-full border-0 bg-surface-3/80 text-primary backdrop-blur-sm hover:bg-surface-3 md:-left-4 md:flex" />
      <CarouselNext className="hidden h-10 w-10 rounded-full border-0 bg-surface-3/80 text-primary backdrop-blur-sm hover:bg-surface-3 md:-right-4 md:flex" />
    </Carousel>
  )
}
