import { Link } from '@/i18n/navigation'
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
      <section className="relative">
        {/* Subtle section glow */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(ellipse 60% 80% at 0% 50%, rgba(44,53,105,0.18) 0%, transparent 70%)',
          }}
        />

        <div className="relative flex flex-col gap-12 px-6 md:flex-row md:gap-16 md:px-12 lg:gap-28">
          {/* Left: sticky intro */}
          <div className="w-full md:sticky md:top-32 md:w-[38%]" style={{ height: 'fit-content' }}>
            <div className="mb-5 flex items-center gap-3">
              <div className="h-px w-10 bg-[#DB3F34]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.34em] text-white/36">
                Explore by genre
              </span>
            </div>
            <h2
              className="font-display font-black leading-[0.9] text-white"
              style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', letterSpacing: '-0.05em' }}
            >
              Every mood.{' '}
              <span className="text-white/24">Every story.</span>
            </h2>
            <p className="mt-5 text-sm leading-7 text-white/44 md:text-base">
              From health and cooking to music and cinema — find the genre that matches your moment.
            </p>
            <Link
              href="/browse"
              className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-white/40 transition-colors hover:text-white/80"
            >
              Browse all shows →
            </Link>
          </div>

          {/* Right: pill grid */}
          <div className="flex w-full flex-wrap content-start gap-3 pt-1 md:w-[62%] lg:gap-4">
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
        </div>
      </section>
    </ScrollReveal>
  )
}
