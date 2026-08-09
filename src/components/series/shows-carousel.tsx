import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel'
import { PortraitShowCard } from '@/components/shows/portrait-show-card'
import type { ViewShow } from '@/lib/queries'

interface ShowsCarouselProps {
  shows: ViewShow[]
}

export function ShowsCarousel({ shows }: ShowsCarouselProps) {
  return (
    <Carousel
      opts={{
        align: 'start',
        containScroll: 'trimSnaps',
        dragFree: false,
        loop: false,
        slidesToScroll: 1,
      }}
      className="mt-8"
    >
      <CarouselContent>
        {shows.map((show) => (
          <CarouselItem
            key={show.id}
            className="basis-1/2 sm:basis-1/3 lg:basis-1/4 xl:basis-1/5"
          >
            <PortraitShowCard show={show} />
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  )
}
