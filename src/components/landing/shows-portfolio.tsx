import { Link } from '@/i18n/navigation'
import { getFeaturedShows } from '@/lib/queries'

export async function ShowsPortfolio() {
  const shows = await getFeaturedShows()
  const display = shows.slice(0, 4)

  if (display.length === 0) return null

  return (
    <section className="mx-auto max-w-[1400px] px-10 py-24" id="shows">
      <div className="mono mb-3.5 text-[var(--text-mute)]">002 · What to watch</div>
      <h2 className="font-[family-name:var(--font-display)] text-[clamp(36px,5vw,64px)] font-normal leading-none tracking-[-0.02em] mb-12 max-w-[800px]">
        A catalog curated by editors, not by clicks.
      </h2>
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        {display.map((s) => (
          <Link key={s.slug} href={`/series/${s.slug}`} className="group cursor-pointer">
            <div className="aspect-[2/3] overflow-hidden rounded bg-[var(--bg-2)] mb-3.5">
              {s.posterUrl ? (
                <img
                  src={s.posterUrl}
                  alt={s.title}
                  className="h-full w-full object-cover transition-transform duration-400 ease-[var(--ease)] group-hover:scale-105"
                />
              ) : (
                <div className="h-full w-full bg-[var(--bg-2)]" />
              )}
            </div>
            <div className="mono mb-1">{s.genre}</div>
            <div className="font-[family-name:var(--font-display)] text-[22px] tracking-[-0.01em] mb-1.5">{s.title}</div>
            <div className="text-[13px] text-[var(--text-dim)]">{s.tagline}</div>
          </Link>
        ))}
      </div>
    </section>
  )
}
