'use client'

import Link from 'next/link'
import { Star } from 'lucide-react'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'
import { Badge } from '@/components/ui/badge'
import { PlayOverlay } from '@/components/ui/play-overlay'
import { brandColorBgMap, getNewEpisodes } from '@/lib/mock-data'

export function NewEpisodesRail() {
  const newEpisodes = getNewEpisodes()
  if (newEpisodes.length === 0) return null

  return (
    <section>
      <div className="px-6 md:px-12">
        <h2 className="text-2xl font-bold text-foreground">New Episodes</h2>
      </div>
      <Carousel opts={{ align: 'start', containScroll: 'trimSnaps', dragFree: false, loop: false, slidesToScroll: 1 }} className="mt-4">
        <CarouselContent className="-ml-4 px-6 md:px-12">
          {newEpisodes.map((ep) => (
            <CarouselItem key={ep.id} className="basis-1/2 pl-4 lg:basis-1/3 xl:basis-1/4">
              <Link href={`/watch/${ep.id}`} className="group block">
                <div className="overflow-hidden rounded-lg">
                  <div className={`relative aspect-video ${brandColorBgMap[ep.showBrandColor]}`}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-white/20">E{ep.episodeNumber}</span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                      <p className="truncate text-sm font-medium text-white">{ep.title}</p>
                      <p className="truncate text-xs text-white/60">{ep.showTitle}</p>
                    </div>
                    <PlayOverlay />
                  </div>
                  <div className="flex items-center gap-2 bg-card p-3">
                    <div className="flex items-center gap-1">
                      <Star className="size-3.5 fill-brand-yellow text-brand-yellow" />
                      <span className="text-xs text-muted-foreground">4.5</span>
                    </div>
                    <Badge variant="secondary" className="text-xs text-muted-foreground">{ep.duration} min</Badge>
                  </div>
                </div>
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden h-10 w-10 rounded-full border-0 bg-surface-3/80 text-primary backdrop-blur-sm hover:bg-surface-3 md:-left-4 md:flex" />
        <CarouselNext className="hidden h-10 w-10 rounded-full border-0 bg-surface-3/80 text-primary backdrop-blur-sm hover:bg-surface-3 md:-right-4 md:flex" />
      </Carousel>
    </section>
  )
}
