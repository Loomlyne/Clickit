import type { Metadata } from 'next'
import Link from 'next/link'

import { MOCK_SHOWS, brandColorHexMap } from '@/lib/mock-data'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'
import { PortraitShowCard } from '@/components/shows/portrait-show-card'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'All Series | Clickit Story',
  description: 'Browse all original shows from Clickit Story',
}

const GENRE_COLORS: Record<string, string> = {
  Entertainment: '#2C3569',
  Documentary: '#9F54A0',
  Health: '#50A258',
  Tech: '#2C3569',
  Kids: '#F8C623',
  Music: '#9F54A0',
  Comedy: '#EA8C2E',
  Cooking: '#DB3F34',
  Poetry: '#DB3F34',
}

interface Props {
  searchParams: Promise<{ genre?: string }>
}

export default async function SeriesPage({ searchParams }: Props) {
  const { genre: selectedGenre } = await searchParams
  const genres = [...new Set(MOCK_SHOWS.map((s) => s.genre))]
  const filteredShows = selectedGenre
    ? MOCK_SHOWS.filter((s) => s.genre === selectedGenre)
    : MOCK_SHOWS

  // Build mosaic colors from all shows, cycling if fewer than 12
  const mosaicColors = Array.from({ length: 12 }, (_, i) => {
    const show = MOCK_SHOWS[i % MOCK_SHOWS.length]
    return brandColorHexMap[show!.brandColor] ?? '#2C3569'
  })

  return (
    <div>
      {/* Mosaic Hero */}
      <div className="relative h-[50vh] min-h-[280px] overflow-hidden -mt-16">
        {/* Mosaic grid of show brand colors */}
        <div
          className="absolute inset-0 grid opacity-30"
          style={{
            gridTemplateColumns: 'repeat(6, 1fr)',
            gridTemplateRows: 'repeat(2, 1fr)',
          }}
        >
          {mosaicColors.map((color, i) => (
            <div key={i} style={{ background: color }} />
          ))}
        </div>

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/70" />

        {/* Bottom gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <h1
            className="font-display font-bold text-white mb-3"
            style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}
          >
            Browse Original Series
          </h1>
          <p className="text-white/60 text-lg">
            {MOCK_SHOWS.length} original programs from Abu Dhabi
          </p>
        </div>
      </div>

      {/* Sticky Genre Filter */}
      <div className="sticky top-16 z-40 bg-black/90 backdrop-blur-xl border-b border-white/[0.06] py-3">
        <div className="flex gap-2 overflow-x-auto px-6 md:px-12 scrollbar-hide">
          {/* All genres pill */}
          <Link href="/series">
            <div
              className={cn(
                'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer',
                !selectedGenre
                  ? 'bg-white text-black'
                  : 'bg-white/10 text-white/70 hover:text-white'
              )}
            >
              All
            </div>
          </Link>
          {genres.map((genre) => (
            <Link key={genre} href={`/series?genre=${encodeURIComponent(genre)}`}>
              <div
                className={cn(
                  'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer border',
                  selectedGenre === genre
                    ? 'text-black border-transparent'
                    : 'bg-white/5 text-white/70 hover:text-white border-white/10'
                )}
                style={
                  selectedGenre === genre
                    ? {
                        background: GENRE_COLORS[genre] ?? '#2C3569',
                        borderColor: 'transparent',
                      }
                    : {}
                }
              >
                {genre}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Shows Grid */}
      <div className="px-6 md:px-12 py-8">
        {filteredShows.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-white/40 text-lg">No shows match this genre</p>
            <Link
              href="/series"
              className="text-[var(--color-brand-blue-safe)] text-sm mt-2 inline-block hover:text-white"
            >
              Clear filter →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {filteredShows.map((show, i) => (
              <ScrollReveal key={show.id} delay={i * 0.05}>
                <PortraitShowCard show={show} />
              </ScrollReveal>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
