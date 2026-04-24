import { Link } from '@/i18n/navigation'
import { getFeaturedShows } from '@/lib/queries'

export async function LandingHero() {
  const shows = await getFeaturedShows()
  const collage = shows.slice(0, 4)
  const backdrop = shows[0]?.heroImageUrl || shows[0]?.posterUrl

  return (
    <section className="relative -mt-16 min-h-dvh overflow-hidden">
      {/* Background image with grain */}
      {backdrop && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.08] grayscale-[30%]"
          style={{ backgroundImage: `url(${backdrop})` }}
        />
      )}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse at 20% 40%, transparent 0%, rgba(10,10,10,0.8) 60%), linear-gradient(180deg, transparent 0%, var(--bg-0) 100%)',
        }}
      />

      {/* Content grid */}
      <div className="relative flex min-h-dvh items-center px-10 pt-32 pb-20">
        <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-16 lg:grid-cols-2">
          {/* LEFT — copy */}
          <div>
            <div className="mono mb-5 flex items-center gap-2.5 text-[var(--primary)]">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Now streaming · Est. 2026
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-[clamp(48px,7vw,96px)] font-normal leading-[0.92] tracking-[-0.03em] mb-6">
              Television for the city that{' '}
              <em className="italic text-[var(--primary)]">can&apos;t sleep.</em>
            </h1>
            <p className="text-[17px] leading-relaxed text-[var(--text-dim)] max-w-[560px] mb-9">
              A hand-curated channel for urban culture, food, design and travel. No ads, no algorithm — just the shows editors love, from creators you&apos;ve never heard of.
            </p>
            <div className="flex items-center gap-3 mb-16">
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 rounded bg-[var(--primary)] px-6 py-3.5 text-[15px] font-medium text-[var(--primary-foreground)] transition-all hover:bg-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3" /></svg>
                Start watching free
              </Link>
              <Link
                href="/browse"
                className="inline-flex items-center gap-2 rounded border border-[var(--line-2)] px-6 py-3.5 text-[15px] font-medium text-[var(--text)] transition-all hover:bg-white/[0.04]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3" /></svg>
                60-second trailer
              </Link>
            </div>
            {/* Stats strip */}
            <div className="flex gap-10">
              <div>
                <div className="font-[family-name:var(--font-display)] text-3xl">7 days</div>
                <div className="mono mt-1">Free beta<br />No card required</div>
              </div>
              <div>
                <div className="font-[family-name:var(--font-display)] text-3xl">{shows.length || 15}</div>
                <div className="mono mt-1">Original shows<br />From Abu Dhabi</div>
              </div>
              <div>
                <div className="font-[family-name:var(--font-display)] text-3xl">0</div>
                <div className="mono mt-1">Ads. Ever.<br />That&apos;s the deal</div>
              </div>
            </div>
          </div>

          {/* RIGHT — poster collage */}
          <div className="relative hidden lg:block" style={{ height: 520 }}>
            {collage.map((show, i) => {
              const rotations = [-6, 4, -3, 5]
              const offsets = [
                { top: 0, left: 40 },
                { top: 30, left: 220 },
                { top: 160, left: 0 },
                { top: 200, left: 200 },
              ]
              return (
                <Link
                  key={show.slug}
                  href={`/series/${show.slug}`}
                  className="absolute w-[200px] overflow-hidden rounded shadow-[0_20px_60px_rgba(0,0,0,0.5)] transition-transform duration-300 hover:scale-105"
                  style={{
                    aspectRatio: '2/3',
                    transform: `rotate(${rotations[i]}deg)`,
                    top: offsets[i].top,
                    left: offsets[i].left,
                    zIndex: i + 1,
                  }}
                >
                  {show.posterUrl ? (
                    <img
                      src={show.posterUrl}
                      alt={show.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-[var(--bg-2)]" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <div className="mono text-[9px]">{show.genre}</div>
                    <div className="font-[family-name:var(--font-display)] text-sm">{show.title}</div>
                  </div>
                </Link>
              )
            })}
            <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 rounded bg-[var(--primary)] px-2.5 py-1 text-[var(--primary-foreground)]">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3" /></svg>
              <span className="mono text-[9px] text-[var(--primary-foreground)]">Now playing</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
