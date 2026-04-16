import Link from 'next/link'
import { getDistinctGenres } from '@/lib/queries'
import { SectionHeader } from '@/components/primitives/section-header'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'

export async function GenresGrid() {
  const genres = await getDistinctGenres()

  if (genres.length === 0) return null

  return (
    <ScrollReveal>
      <section className="pt-1">
        <SectionHeader title="Browse by Genre" />
        <div className="scrollbar-hide flex gap-3 overflow-x-auto px-6 py-2 md:px-12">
          {genres.map((genre) => (
            <Link
              key={genre}
              href={`/browse?genre=${encodeURIComponent(genre)}`}
              className="group flex-shrink-0"
            >
              <div className="flex min-w-[120px] cursor-pointer items-center justify-center border border-[#1A1C23] bg-[#0F1115] px-5 py-3.5 text-sm font-medium text-white/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:text-white sm:min-w-[160px] sm:px-6">
                <span className="whitespace-nowrap">{genre}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </ScrollReveal>
  )
}
