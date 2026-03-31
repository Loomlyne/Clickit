import { HeroBanner } from '@/components/home/hero-banner'
import { ContentRail } from '@/components/home/content-rail'
import {
  FEATURED_SHOWS,
  NOW_STREAMING,
  COMING_SOON_SHOWS,
  MOCK_SHOWS,
} from '@/lib/mock-data'

/** Unique genres derived from all shows, for genre-based content rails. */
const genres = [...new Set(MOCK_SHOWS.map((s) => s.genre))]

export default function HomePage() {
  return (
    <div>
      <HeroBanner shows={FEATURED_SHOWS} />

      <div className="mt-16 space-y-8 pb-16">
        <ContentRail
          title="Now Streaming"
          shows={NOW_STREAMING}
          seeAllHref="/series"
        />
        <ContentRail
          title="Coming Soon"
          shows={COMING_SOON_SHOWS}
          seeAllHref="/series"
        />

        {/* Genre-based rails: one rail per unique genre */}
        {genres.map((genre) => {
          const genreShows = MOCK_SHOWS.filter((s) => s.genre === genre)
          return (
            <ContentRail key={genre} title={genre} shows={genreShows} />
          )
        })}
      </div>
    </div>
  )
}
