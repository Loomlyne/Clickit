import { Link } from '@/i18n/navigation'
import { getDistinctGenres } from '@/lib/queries'

export async function GenrePills() {
  const genres = await getDistinctGenres()

  if (genres.length === 0) return null

  return (
    <section className="mx-auto max-w-[1400px] border-t border-[var(--line)] px-4 py-24 sm:px-6 md:px-10">
      <div className="mono mb-3.5 text-[var(--text-mute)]">004 · Genres</div>
      <h2 className="font-[family-name:var(--font-display)] text-[clamp(36px,5vw,64px)] font-normal leading-none tracking-[-0.02em] mb-12">
        Pick a pillar.
      </h2>
      <div className="grid grid-cols-2 gap-px border border-[var(--line)] bg-[var(--line)] md:grid-cols-3">
        {genres.map((genre, index) => (
          <Link
            key={genre}
            href={`/browse?genre=${encodeURIComponent(genre)}`}
            className={[
              'group flex min-h-[220px] flex-col justify-between bg-[var(--bg-0)] p-6 transition-colors duration-200 hover:bg-[var(--bg-1)] md:min-h-[260px] md:p-8',
              genres.length % 2 === 1 && index === genres.length - 1 ? 'col-span-2' : '',
              genres.length % 3 === 1 && index === genres.length - 1 ? 'md:col-span-3' : '',
            ].filter(Boolean).join(' ')}
          >
            <div className="font-[family-name:var(--font-display)] text-[clamp(28px,3vw,40px)] leading-none tracking-[-0.02em] transition-colors duration-200 group-hover:text-[var(--primary)]">
              {genre}
            </div>
            <div className="flex items-end justify-between">
              <span className="mono">{genre}</span>
              <span className="text-xl text-[var(--text-mute)] transition-transform duration-200 group-hover:translate-x-1.5 group-hover:text-[var(--primary)]">
                →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
