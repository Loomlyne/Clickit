'use client'

import Link from 'next/link'

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { ShowCard } from '@/components/shows/show-card'
import { PlaceholderCard } from '@/components/shows/placeholder-card'
import type { Show } from '@/lib/mock-data'

interface ContentRailProps {
  title: string
  shows: Show[]
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

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between px-6 md:px-12">
        <h2 className="text-2xl font-bold text-primary">{title}</h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="text-sm text-brand-blue-safe hover:underline"
          >
            See All
          </Link>
        )}
      </div>

      {/* Horizontal carousel */}
      <Carousel
        opts={{
          align: 'start',
          containScroll: 'trimSnaps',
          dragFree: false,
          loop: false,
          slidesToScroll: 1,
        }}
        className="mt-4"
      >
        <CarouselContent className="-ml-6 px-6 md:px-12">
          {shows.map((show) => (
            <CarouselItem
              key={show.id}
              className="basis-1/2 pl-6 sm:basis-1/2 lg:basis-1/3 xl:basis-1/4"
            >
              <ShowCard show={show} />
            </CarouselItem>
          ))}
          {Array.from({ length: placeholderCount }).map((_, i) => (
            <CarouselItem
              key={`placeholder-${i}`}
              className="basis-1/2 pl-6 sm:basis-1/2 lg:basis-1/3 xl:basis-1/4"
            >
              <PlaceholderCard />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden h-10 w-10 rounded-full border-0 bg-surface-3/80 text-primary backdrop-blur-sm hover:bg-surface-3 md:-left-4 md:flex" />
        <CarouselNext className="hidden h-10 w-10 rounded-full border-0 bg-surface-3/80 text-primary backdrop-blur-sm hover:bg-surface-3 md:-right-4 md:flex" />
      </Carousel>
    </section>
  )
}
