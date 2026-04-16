import Link from 'next/link'
import { getDistinctGenres } from '@/lib/queries'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'
import { GenrePill } from './genre-pill'

export async function GenrePills() {
  const genres = await getDistinctGenres()

  if (genres.length === 0) return null

  return (
    <ScrollReveal>
      <section className="px-6 md:px-12">
        <div className="grid grid-cols-1 items-start gap-16 lg:grid-cols-12 lg:gap-8">
          {/* Left: sticky intro */}
          <div className="pr-8 lg:sticky lg:top-32 lg:col-span-5">
            <span className="mb-6 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              <span className="h-px w-8 bg-primary" />
              Exploration
            </span>
            <h2
              className="font-display mb-6 font-medium tracking-tighter text-white"
              style={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', lineHeight: 1.05, textWrap: 'balance' }}
            >
              Browse by<br />
              <span className="text-white/40">Category.</span>
            </h2>
            <p className="max-w-md text-base font-light text-white/40">
              From health and cooking to music and cinema — find the genre that matches your mood.
            </p>
          </div>

          {/* Right: rectangular pill flow */}
          <div className="flex flex-wrap content-start gap-3 md:gap-4 lg:col-span-7">
            {genres.map((genre) => (
              <Link
                key={genre}
                href={`/browse?genre=${encodeURIComponent(genre)}`}
              >
                <GenrePill genre={genre} />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </ScrollReveal>
  )
}
