import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { getFeaturedShows } from '@/lib/queries'
import { createClient } from '@/lib/supabase/server'

const BRAND_GLOWS = {
  'brand-blue': {
    glow: 'rgba(96,115,255,0.38)',
    edge: 'rgba(96,115,255,0.72)',
    badge: 'bg-[#6073FF]/16 text-[#C7D0FF] border-[#6073FF]/30',
  },
  'brand-purple': {
    glow: 'rgba(159,84,160,0.34)',
    edge: 'rgba(194,118,195,0.72)',
    badge: 'bg-[#9F54A0]/16 text-[#F1C4F2] border-[#9F54A0]/30',
  },
  'brand-green': {
    glow: 'rgba(80,162,88,0.34)',
    edge: 'rgba(113,206,122,0.72)',
    badge: 'bg-[#50A258]/16 text-[#CBEFD0] border-[#50A258]/30',
  },
  'brand-red': {
    glow: 'rgba(219,63,52,0.34)',
    edge: 'rgba(255,116,100,0.72)',
    badge: 'bg-[#DB3F34]/16 text-[#FFD2CC] border-[#DB3F34]/30',
  },
  'brand-orange': {
    glow: 'rgba(234,140,46,0.34)',
    edge: 'rgba(255,186,116,0.72)',
    badge: 'bg-[#EA8C2E]/16 text-[#FFE1BD] border-[#EA8C2E]/30',
  },
} as const

function getArtworkUrl(url?: string) {
  if (!url) return null
  if (url.includes('picsum.photos') || url.includes('fastly.picsum.photos')) return null
  return url
}

export async function LandingHero() {
  // proxy.ts already validated the JWT — getSession() reads the cookie locally
  // without a Supabase auth round-trip. The user is only consumed to pick the
  // CTA href; getUser()'s extra validation is unnecessary here.
  const supabase = await createClient()
  const [shows, { data: { session } }] = await Promise.all([
    getFeaturedShows(),
    supabase.auth.getSession(),
  ])
  const user = session?.user ?? null
  const collage = shows.slice(0, 4)
  const backdrop = shows[0]?.heroImageUrl || shows[0]?.posterUrl
  const ctaHref = user ? '/browse' : '/auth'
  const primaryShow = collage[0]
  const secondaryShows = collage.slice(1)
  const primaryTheme = primaryShow ? BRAND_GLOWS[primaryShow.brandColor] : BRAND_GLOWS['brand-blue']

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
      <div className="relative flex min-h-dvh items-center px-4 pt-28 pb-16 sm:px-6 md:px-10 md:pt-32 md:pb-20">
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
            <div className="flex flex-wrap items-center gap-3 mb-12 md:mb-16">
              <Link
                href={ctaHref}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded bg-[var(--primary)] px-5 py-3 text-[14px] font-medium text-[var(--primary-foreground)] transition-all hover:bg-white sm:px-6 sm:py-3.5 sm:text-[15px]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3" /></svg>
                Start watching
              </Link>
              <Link
                href="/browse"
                className="inline-flex items-center gap-2 whitespace-nowrap rounded border border-[var(--line-2)] px-5 py-3 text-[14px] font-medium text-[var(--text)] transition-all hover:bg-white/[0.04] sm:px-6 sm:py-3.5 sm:text-[15px]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3" /></svg>
                Browse the catalog
              </Link>
            </div>
            {/* Stats strip */}
            <div className="flex flex-wrap gap-6 sm:gap-10">
              <div>
                <div className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl">7 days</div>
                <div className="mono mt-1 text-xs sm:text-sm">Free beta<br />No card required</div>
              </div>
              <div>
                <div className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl">{shows.length || 15}</div>
                <div className="mono mt-1 text-xs sm:text-sm">Original shows<br />From Abu Dhabi</div>
              </div>
              <div>
                <div className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl">0</div>
                <div className="mono mt-1 text-xs sm:text-sm">Ads. Ever.<br />That&apos;s the deal</div>
              </div>
            </div>
          </div>

          {/* RIGHT — cinematic showcase */}
          <div className="relative hidden lg:block" style={{ height: 560 }}>
            <div className="absolute inset-[28px] overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(145deg,rgba(14,17,24,0.96),rgba(8,10,15,0.88))] shadow-[0_40px_140px_rgba(0,0,0,0.58)]">
              <div
                className="absolute -left-10 top-8 h-52 w-52 rounded-full blur-3xl motion-safe:animate-[pulse_8s_ease-in-out_infinite]"
                style={{ backgroundColor: primaryTheme.glow }}
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_24%,transparent_72%,rgba(255,255,255,0.02))]" />
              <div className="absolute inset-x-10 top-10 flex items-center justify-between">
                <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 backdrop-blur-md">
                  <span className="mono text-[10px] uppercase tracking-[0.32em] text-white/58">Curated stack</span>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 backdrop-blur-md">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 motion-safe:animate-pulse" />
                  <span className="mono text-[10px] uppercase tracking-[0.28em] text-white/68">Now playing</span>
                </div>
              </div>

              {primaryShow && (
                <Link
                  href={`/series/${primaryShow.slug}`}
                  className="group absolute right-12 top-20 block w-[300px] overflow-hidden rounded-[28px] border border-white/12 bg-[#0f131b] shadow-[0_36px_120px_rgba(0,0,0,0.55)] transition-[border-color,box-shadow] duration-500 ease-out hover:border-white/20 hover:shadow-[0_42px_140px_rgba(0,0,0,0.62)] motion-safe:animate-[floatHero_7s_ease-in-out_infinite] motion-reduce:animate-none"
                  style={{ transform: 'perspective(1800px) rotateY(-12deg) rotateX(3deg)' }}
                >
                  <div className="relative aspect-[10/13] overflow-hidden">
                    {getArtworkUrl(primaryShow.posterUrl ?? primaryShow.heroImageUrl) ? (
                      <Image
                        src={getArtworkUrl(primaryShow.posterUrl ?? primaryShow.heroImageUrl)!}
                        alt={primaryShow.title}
                        fill
                        unoptimized
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                      />
                    ) : (
                      <div
                        className="absolute inset-0"
                        style={{
                          background: `radial-gradient(circle at top, ${primaryTheme.edge} 0%, rgba(8,10,15,0.18) 26%), linear-gradient(160deg, rgba(255,255,255,0.07), rgba(9,12,17,0.98) 55%)`,
                        }}
                      >
                        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,transparent_52%,rgba(255,255,255,0.08)_52%,transparent_58%,transparent_100%)] opacity-60" />
                        <div className="absolute bottom-8 left-7 right-7">
                          <div className="mono text-[11px] uppercase tracking-[0.34em] text-white/55">{primaryShow.genre}</div>
                          <div className="mt-3 font-[family-name:var(--font-display)] text-[34px] leading-[0.88] text-white">
                            {primaryShow.title}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_24%,rgba(0,0,0,0.1)_48%,rgba(0,0,0,0.82)_100%)]" />
                    <div className="absolute inset-x-0 bottom-0 p-6">
                      <div className={`inline-flex items-center rounded-full border px-2.5 py-1 ${primaryTheme.badge}`}>
                        <span className="mono text-[10px] uppercase tracking-[0.24em]">{primaryShow.genre}</span>
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-4">
                        <div>
                          <div className="font-[family-name:var(--font-display)] text-[26px] leading-[0.92] text-white">
                            {primaryShow.title}
                          </div>
                          <div className="mt-2 max-w-[180px] text-[12px] leading-5 text-white/62">
                            {primaryShow.tagline || primaryShow.description}
                          </div>
                        </div>
                        <div className="rounded-full border border-white/12 bg-white/8 p-3 backdrop-blur-md transition-transform duration-300 group-hover:translate-x-1">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-white"><polygon points="6 3 20 12 6 21 6 3" /></svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              )}

              {secondaryShows.map((show, index) => {
                const theme = BRAND_GLOWS[show.brandColor]
                const positions = [
                  { left: 36, top: 92, width: 184, rotate: '-7deg', delay: '0s' },
                  { left: 86, top: 290, width: 200, rotate: '7deg', delay: '1.2s' },
                  { left: 284, top: 318, width: 154, rotate: '-3deg', delay: '2.1s' },
                ] as const
                const current = positions[index]
                if (!current) return null

                return (
                  <Link
                    key={show.slug}
                    href={`/series/${show.slug}`}
                    className="group absolute block overflow-hidden rounded-[24px] border border-white/10 bg-[#0d1016]/95 shadow-[0_20px_60px_rgba(0,0,0,0.5)] transition-[border-color,box-shadow] duration-500 ease-out hover:border-white/18 hover:shadow-[0_26px_70px_rgba(0,0,0,0.58)] motion-reduce:[animation:none]"
                    style={{
                      left: current.left,
                      top: current.top,
                      width: current.width,
                      ['--card-rotate' as string]: current.rotate,
                      animation: `floatCard 9s ease-in-out ${current.delay} infinite`,
                    }}
                  >
                    <div className="relative aspect-[4/5]">
                      {getArtworkUrl(show.posterUrl ?? show.heroImageUrl) ? (
                        <Image
                          src={getArtworkUrl(show.posterUrl ?? show.heroImageUrl)!}
                          alt={show.title}
                          fill
                          unoptimized
                          className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                        />
                      ) : (
                        <div
                          className="absolute inset-0"
                          style={{
                            background: `linear-gradient(160deg, ${theme.glow} 0%, rgba(13,16,22,0.95) 42%, rgba(7,9,14,1) 100%)`,
                          }}
                        >
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_35%)]" />
                          <div className="absolute bottom-5 left-5 right-5">
                            <div className="mono text-[9px] uppercase tracking-[0.32em] text-white/50">{show.genre}</div>
                            <div className="mt-2 font-[family-name:var(--font-display)] text-[20px] leading-[0.92] text-white">{show.title}</div>
                          </div>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05)_20%,rgba(0,0,0,0.28)_58%,rgba(0,0,0,0.84)_100%)]" />
                      <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
                        <span className={`rounded-full border px-2 py-1 ${theme.badge}`}>
                          <span className="mono text-[9px] uppercase tracking-[0.24em]">{show.genre}</span>
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1">
                          <span className="mono text-[8px] uppercase tracking-[0.24em] text-white/65">
                            {index === 0 ? 'Editors pick' : index === 1 ? 'Fresh drop' : 'Late night'}
                          </span>
                        </span>
                      </div>
                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <div className="font-[family-name:var(--font-display)] text-[18px] leading-[0.95] text-white">
                          {show.title}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}

              <div className="absolute bottom-8 left-10 right-10 flex items-end justify-between">
                <div className="max-w-[280px]">
                  <div className="mono text-[10px] uppercase tracking-[0.32em] text-white/42">Featured selection</div>
                  <div className="mt-3 font-[family-name:var(--font-display)] text-[28px] leading-[0.95] text-white">
                    Curated for nights that keep moving.
                  </div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-black/30 px-4 py-3 backdrop-blur-xl">
                  <div className="mono text-[9px] uppercase tracking-[0.32em] text-white/48">Queue</div>
                  <div className="mt-2 flex items-center gap-3">
                    {collage.slice(0, 3).map((show) => {
                      const artwork = getArtworkUrl(show.posterUrl ?? show.heroImageUrl)
                      return (
                        <div
                          key={show.slug}
                          className="relative h-12 w-9 overflow-hidden rounded-[10px] border border-white/10 bg-white/5"
                        >
                          {artwork ? (
                            <Image
                              src={artwork}
                              alt={show.title}
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(255,255,255,0.1),rgba(255,255,255,0.02))]" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            <style>{`
              @keyframes floatHero {
                0%, 100% { transform: perspective(1800px) rotateY(-12deg) rotateX(3deg) translateY(0px); }
                50% { transform: perspective(1800px) rotateY(-10deg) rotateX(1deg) translateY(-12px); }
              }

              @keyframes floatCard {
                0%, 100% { transform: translateY(0px) rotate(var(--card-rotate, 0deg)); }
                50% { transform: translateY(-12px) rotate(var(--card-rotate, 0deg)); }
              }
            `}</style>
          </div>
        </div>
      </div>
    </section>
  )
}
