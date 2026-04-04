import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllShows, getDistinctGenres } from '@/lib/queries'
import { PortraitShowCard } from '@/components/shows/portrait-show-card'
import { SectionHeader } from '@/components/primitives/section-header'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'

export const metadata: Metadata = {
  title: 'All Series | Clickit Story',
  description: 'Browse all shows on Clickit Story',
}

const GENRE_COLORS: Record<string, string> = {
  Comedy: '#F8C623',
  Drama: '#9F54A0',
  Documentary: '#50A258',
  Music: '#EA8C2E',
  Talk: '#2C3569',
  Kids: '#DB3F34',
  Cooking: '#EA8C2E',
  Health: '#50A258',
  Poetry: '#9F54A0',
  Cinema: '#2C3569',
  Tech: '#2C3569',
  Business: '#50A258',
  Travel: '#50A258',
  Quiz: '#F8C623',
  Podcast: '#9F54A0',
}

function getGenreColor(genre: string): string {
  return GENRE_COLORS[genre] ?? '#2C3569'
}

export default async function SeriesPage(props: {
  searchParams: Promise<{ genre?: string }>
}) {
  const searchParams = await props.searchParams
  const activeGenre = searchParams.genre ?? null

  const [allShows, genres] = await Promise.all([
    getAllShows(),
    getDistinctGenres(),
  ])

  const filteredShows = activeGenre
    ? allShows.filter(
        (s) => s.genre.toLowerCase() === activeGenre.toLowerCase()
      )
    : allShows

  return (
    <div className="pb-16">
      {/* Page header */}
      <div className="relative py-20 px-6 md:px-12 text-center overflow-hidden">
        {/* Restrained radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 80% at 50% 100%, rgba(44,53,105,0.15), transparent)',
          }}
        />
        <div className="relative">
          <p
            className="text-sm tracking-[0.3em] uppercase mb-4"
            style={{ color: 'var(--color-brand-blue-safe)' }}
          >
            Browse
          </p>
          <h1
            className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-white leading-tight"
          >
            All Series
          </h1>
          <p className="text-white/50 text-lg mt-3 max-w-md mx-auto">
            Discover original shows from Clickit Story
          </p>
        </div>
      </div>

      {/* Genre filter chips */}
      {genres.length > 0 && (
        <div className="px-6 md:px-12 mb-8">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {/* All chip */}
            <Link
              href="/series"
              className="rounded-xl px-6 py-3 min-w-[100px] text-center text-sm font-medium transition-all duration-200 flex-shrink-0"
              style={
                !activeGenre
                  ? {
                      background: 'rgba(44,53,105,0.5)',
                      color: '#fff',
                      border: '1px solid rgba(44,53,105,0.6)',
                    }
                  : {
                      background: 'rgba(255,255,255,0.04)',
                      color: 'rgba(255,255,255,0.6)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }
              }
            >
              All
            </Link>
            {genres.map((genre) => {
              const isActive =
                activeGenre?.toLowerCase() === genre.toLowerCase()
              const color = getGenreColor(genre)
              return (
                <Link
                  key={genre}
                  href={`/series?genre=${encodeURIComponent(genre)}`}
                  className="rounded-xl px-6 py-3 min-w-[120px] text-center text-sm font-medium transition-all duration-200 flex-shrink-0"
                  style={
                    isActive
                      ? {
                          background: `${color}40`,
                          color: '#fff',
                          border: `1px solid ${color}60`,
                        }
                      : {
                          background: 'rgba(255,255,255,0.04)',
                          color: 'rgba(255,255,255,0.6)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }
                  }
                >
                  {genre}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Show grid */}
      {filteredShows.length > 0 ? (
        <div className="px-6 md:px-12">
          <SectionHeader
            title={activeGenre ? `${activeGenre} Shows` : 'All Shows'}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-5 mt-2">
            {filteredShows.map((show, i) => (
              <ScrollReveal key={show.id} delay={i * 0.04}>
                <PortraitShowCard show={show} />
              </ScrollReveal>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-6 md:px-12">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <h3 className="text-xl font-bold text-white">No shows found</h3>
            <p className="mt-2 text-sm text-white/50">
              Try a different genre or browse all series.
            </p>
            <Link
              href="/series"
              className="mt-4 rounded-lg px-5 py-2.5 text-sm font-medium bg-white/[0.08] text-white hover:bg-white/[0.12] transition-colors"
            >
              Reset Filters
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
