import { Link } from '@/i18n/navigation'
import { getFeaturedShows, getFeaturedShorts } from '@/lib/queries'
import { FeaturedShortsStrip } from './featured-shorts-strip'

export async function ShowsPortfolio() {
  const [shows, shorts] = await Promise.all([getFeaturedShows(), getFeaturedShorts()])
  const display = shows.slice(0, 4)

  if (display.length === 0) return null

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-24 sm:px-6 md:px-10" id="shows">
      <div className="mono mb-3.5 text-[var(--text-mute)]">002 · What to watch</div>
      <h2 className="font-[family-name:var(--font-display)] text-[clamp(36px,5vw,64px)] font-normal leading-none tracking-[-0.02em] mb-12 max-w-[800px]">
        The ones worth your time.
      </h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
        {display.map((s) => (
          <Link key={s.slug} href={`/series/${s.slug}`} className="group cursor-pointer">
            <div className="mb-3 aspect-[2/3] overflow-hidden rounded bg-[var(--bg-2)] md:mb-3.5">
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
            <div className="mb-1.5 font-[family-name:var(--font-display)] text-[20px] tracking-[-0.01em] md:text-[22px]">{s.title}</div>
            <div className="text-[12px] text-[var(--text-dim)] md:text-[13px]">{s.tagline}</div>
          </Link>
        ))}
      </div>

      <FeaturedShortsStrip shorts={shorts} />
    </section>
  )
}
