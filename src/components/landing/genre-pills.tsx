import Link from 'next/link'
import { getDistinctGenres } from '@/lib/queries'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'
import { GenrePill } from './genre-pill'

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

export async function GenrePills() {
  const genres = await getDistinctGenres()

  if (genres.length === 0) return null

  return (
    <ScrollReveal>
      <section className="flex flex-col gap-12 px-6 md:flex-row md:gap-16 md:px-12 lg:gap-24">
        {/* Left: sticky intro */}
        <div className="w-full md:sticky md:top-32 md:w-1/3" style={{ height: 'fit-content' }}>
          <div className="mb-4 flex items-center gap-2">
            <span className="h-px w-8 bg-brand-red" />
            <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/48">
              Exploration
            </span>
          </div>
          <h2
            className="font-display font-black leading-[0.92] text-white"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', letterSpacing: '-0.04em' }}
          >
            Browse by{' '}
            <span className="text-white/30">Category.</span>
          </h2>
          <p className="mt-5 text-base leading-7 text-white/48">
            From health and cooking to music and cinema — find the genre that matches your mood.
          </p>
        </div>

        {/* Right: flowing pill grid */}
        <div className="flex w-full flex-wrap content-start gap-3 pt-2 md:w-2/3 lg:gap-4">
          {genres.map((genre) => {
            const color = GENRE_COLORS[genre] ?? '#2C3569'
            return (
              <Link
                key={genre}
                href={`/browse?genre=${encodeURIComponent(genre)}`}
              >
                <GenrePill genre={genre} color={color} />
              </Link>
            )
          })}
        </div>
      </section>
    </ScrollReveal>
  )
}
