'use client'

import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'
import { PlayOverlay } from '@/components/ui/play-overlay'
import { brandColorBgMap, type Show } from '@/lib/mock-data'

const MOCK_PROGRESS = [
  { id: 'cw-1', showTitle: 'Last Call', brandColor: 'brand-purple' as Show['brandColor'], episodeTitle: 'Desert Voices', progress: 65, minutesLeft: 9 },
  { id: 'cw-2', showTitle: 'Doctor Care', brandColor: 'brand-green' as Show['brandColor'], episodeTitle: 'Sleep Science', progress: 30, minutesLeft: 28 },
  { id: 'cw-3', showTitle: 'Saturn Podcast', brandColor: 'brand-orange' as Show['brandColor'], episodeTitle: 'The AI Revolution', progress: 80, minutesLeft: 5 },
  { id: 'cw-4', showTitle: 'Review Documentary', brandColor: 'brand-blue' as Show['brandColor'], episodeTitle: 'Pearl Divers of the Gulf', progress: 45, minutesLeft: 21 },
]

export function ContinueWatchingRail() {
  return (
    <section>
      <div className="px-6 md:px-12">
        <h2 className="text-2xl font-bold text-foreground">Continue Watching</h2>
      </div>
      <Carousel opts={{ align: 'start', containScroll: 'trimSnaps', dragFree: false, loop: false, slidesToScroll: 1 }} className="mt-4">
        <CarouselContent className="-ml-4 px-6 md:px-12">
          {MOCK_PROGRESS.map((item) => (
            <CarouselItem key={item.id} className="basis-1/2 pl-4 lg:basis-1/3 xl:basis-1/4">
              <div className="group relative cursor-pointer overflow-hidden rounded-lg">
                <div className={`relative aspect-video ${brandColorBgMap[item.brandColor]}`}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-white/20">{item.showTitle}</span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <p className="truncate text-sm font-medium text-white">{item.episodeTitle}</p>
                    <p className="text-xs text-white/60">{item.minutesLeft} min left</p>
                  </div>
                  <PlayOverlay />
                </div>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                  <div className="h-full bg-brand-red" style={{ width: `${item.progress}%` }} />
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden h-10 w-10 rounded-full border-0 bg-surface-3/80 text-primary backdrop-blur-sm hover:bg-surface-3 md:-left-4 md:flex" />
        <CarouselNext className="hidden h-10 w-10 rounded-full border-0 bg-surface-3/80 text-primary backdrop-blur-sm hover:bg-surface-3 md:-right-4 md:flex" />
      </Carousel>
    </section>
  )
}
