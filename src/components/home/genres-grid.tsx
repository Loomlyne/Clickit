import Link from 'next/link'
import { getDistinctGenres } from '@/lib/queries'
import { SectionHeader } from '@/components/primitives/section-header'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'

const GENRE_COLORS: Record<string, string> = {
  Entertainment: '#9F54A0',
  Documentary: '#2C3569',
  Health: '#50A258',
  Tech: '#2C3569',
  Kids: '#F8C623',
  Music: '#9F54A0',
  Comedy: '#EA8C2E',
  Cooking: '#DB3F34',
  Travel: '#50A258',
  Poetry: '#9F54A0',
  Cinema: '#DB3F34',
  Drama: '#9F54A0',
  Talk: '#2C3569',
  Business: '#50A258',
  Quiz: '#F8C623',
  Podcast: '#9F54A0',
}

export async function GenresGrid() {
  const genres = await getDistinctGenres()

  if (genres.length === 0) return null

  return (
    <ScrollReveal>
      <section className="pt-1">
        <SectionHeader title="Browse by Genre" />
        <div className="scrollbar-hide flex gap-3 overflow-x-auto px-6 py-2 md:px-12">
          {genres.map((genre) => {
            const color = GENRE_COLORS[genre] ?? '#2C3569'
            return (
              <Link
                key={genre}
                href={`/browse?genre=${encodeURIComponent(genre)}`}
                className="group flex-shrink-0"
              >
                <div
                  className="flex min-w-[120px] sm:min-w-[160px] cursor-pointer items-center justify-center rounded-full border bg-white/[0.03] px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 sm:px-6"
                  style={{
                    borderColor: `${color}35`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 18px 40px rgba(0,0,0,0.12)`,
                  }}
                >
                  <span
                    className="whitespace-nowrap text-sm font-medium"
                    style={{ color }}
                  >
                    {genre}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </ScrollReveal>
  )
}
