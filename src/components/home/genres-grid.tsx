import Link from 'next/link'
import { MOCK_SHOWS, brandColorBgMap } from '@/lib/mock-data'

export function GenresGrid() {
  const genres = [...new Set(MOCK_SHOWS.map((s) => s.genre))].slice(0, 6)
  const genreColors = genres.map((genre) => {
    const show = MOCK_SHOWS.find((s) => s.genre === genre)!
    return { genre, brandColor: show.brandColor }
  })

  return (
    <section className="px-6 md:px-12">
      <h2 className="text-2xl font-bold text-foreground">Our Genres</h2>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        {genreColors.map(({ genre, brandColor }) => (
          <Link key={genre} href={`/series?genre=${genre}`} className="group block">
            <div className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-lg ${brandColorBgMap[brandColor]} transition-transform duration-200 group-hover:scale-[1.02]`}>
              <span className="text-xl font-bold text-white drop-shadow-lg">{genre}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
