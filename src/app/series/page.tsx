import type { Metadata } from 'next'
import { MOCK_SHOWS, FEATURED_SHOWS, brandColorBgMap, brandColorHexMap } from '@/lib/mock-data'
import { CINEMATIC_GRADIENT } from '@/lib/cinema'
import { PortraitShowCard } from '@/components/shows/portrait-show-card'

export const metadata: Metadata = {
  title: 'All Series | Clickit Story',
  description: 'Browse all original shows from Clickit Story',
}

interface Props {
  searchParams: Promise<{ genre?: string }>
}

export default async function SeriesPage({ searchParams }: Props) {
  const { genre } = await searchParams
  const activeGenre = genre ?? 'all'
  const genres = [...new Set(MOCK_SHOWS.map((s) => s.genre))]
  const filteredShows = activeGenre === 'all'
    ? MOCK_SHOWS
    : MOCK_SHOWS.filter((s) => s.genre === activeGenre)

  const featuredShow = FEATURED_SHOWS[0]

  return (
    <div>
      {/* Mini hero banner */}
      <div className="-mt-16 relative h-[40vh] min-h-[280px] w-full overflow-hidden">
        <div className={`absolute inset-0 ${brandColorBgMap[featuredShow.brandColor]}`}>
          <div className="pointer-events-none absolute inset-0 flex select-none items-center justify-center">
            <span className="text-[15vw] font-black leading-none text-white/10">{featuredShow.title.split(' ')[0]}</span>
          </div>
        </div>
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 80% 80% at 60% 40%, ${brandColorHexMap[featuredShow.brandColor]}44 0%, transparent 70%)` }} />
        <div className="absolute inset-0" style={{ background: CINEMATIC_GRADIENT }} />
        <div className="absolute bottom-8 left-0 z-10 px-6 md:px-12">
          <h1 className="text-4xl font-bold text-foreground lg:text-5xl">Browse Shows</h1>
          <p className="mt-2 text-base text-white/60">{MOCK_SHOWS.length} original series from CIT</p>
        </div>
      </div>

      <div className="px-6 pt-8 pb-16 md:px-12">
        {/* Genre filter tabs */}
        <div className="overflow-x-auto">
          <div className="flex gap-2">
            <a
              href="/series"
              className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm transition-colors ${activeGenre === 'all' ? 'bg-primary text-primary-foreground' : 'bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground'}`}
            >
              All
            </a>
            {genres.map((g) => (
              <a
                key={g}
                href={`/series?genre=${g}`}
                className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm whitespace-nowrap transition-colors ${activeGenre === g ? 'bg-primary text-primary-foreground' : 'bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground'}`}
              >
                {g}
              </a>
            ))}
          </div>
        </div>

        {/* Show grid */}
        {filteredShows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <h2 className="text-2xl font-bold text-foreground">No Shows Found</h2>
            <p className="mt-4 max-w-md text-text-secondary">No shows match this genre filter.</p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
            {filteredShows.map((show) => (
              <PortraitShowCard key={show.id} show={show} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
