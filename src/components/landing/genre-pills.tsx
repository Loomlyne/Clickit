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
    <section className="border-t border-[var(--line)] px-4 py-8 sm:px-6 md:px-10">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-3">
        <span className="mono shrink-0 text-[11px] tracking-[0.12em] text-[var(--text-mute)] uppercase">
          Genres
        </span>
        <div className="h-4 w-px shrink-0 bg-[var(--line)]" />
        {genres.map((genre) => {
          const color = GENRE_COLORS[genre] ?? DEFAULT_COLOR
          return (
            <Link
              key={genre}
              href={`/browse?genre=${encodeURIComponent(genre)}`}
              className="mono rounded px-3 py-1 text-[11px] tracking-[0.08em] uppercase transition-opacity duration-150 hover:opacity-60"
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
