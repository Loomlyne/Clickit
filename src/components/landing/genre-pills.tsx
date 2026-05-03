import { Link } from '@/i18n/navigation'
import { getDistinctGenres } from '@/lib/queries'

const GENRE_COLORS: Record<string, string> = {
  'Business':     '#8d9cff',
  'Cooking':      '#ffb46e',
  'Documentary':  '#c592ff',
  'Health':       '#77d586',
  'Kids':         '#f8d86f',
  'Morning Show': '#ff8b82',
  'Music':        '#c592ff',
  'Travel':       '#8d9cff',
  'Comedy':       '#f8d86f',
  'Poetry':       '#c592ff',
  'Cinema':       '#ff8b82',
  'Tech':         '#8d9cff',
}

const DEFAULT_COLOR = '#8d9cff'

export async function GenrePills() {
  const genres = await getDistinctGenres()
  if (genres.length === 0) return null

  return (
    <section className="mx-auto max-w-[1400px] border-t border-[var(--line)] px-4 py-24 sm:px-6 md:px-10">
      <div className="mono mb-3.5 text-[var(--text-mute)]">004 · Genres</div>
      <h2 className="font-[family-name:var(--font-display)] text-[clamp(36px,5vw,64px)] font-normal leading-none tracking-[-0.02em] mb-12">
        Pick a pillar.
      </h2>
      <div className="flex flex-wrap gap-2.5">
        {genres.map((genre) => {
          const color = GENRE_COLORS[genre] ?? DEFAULT_COLOR
          return (
            <Link
              key={genre}
              href={`/browse?genre=${encodeURIComponent(genre)}`}
              className="mono rounded px-3.5 py-1.5 text-[12px] tracking-[0.08em] uppercase transition-all duration-150 hover:opacity-70"
              style={{ border: `1px solid ${color}`, color }}
            >
              {genre}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
