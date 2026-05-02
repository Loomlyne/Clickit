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
  return url
}

function hasHeroArtwork(show: Awaited<ReturnType<typeof getFeaturedShows>>[number]) {
  return Boolean(getArtworkUrl(show.posterUrl ?? show.heroImageUrl))
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
  const orderedShows = [...shows].sort((a, b) => Number(hasHeroArtwork(b)) - Number(hasHeroArtwork(a)))
  const collageShows = orderedShows.slice(0, 4)
  const ctaHref = user ? '/browse' : '/auth'

  return (
    <section className="relative -mt-16 min-h-dvh overflow-hidden">

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
                60-second trailer
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

          {/* RIGHT — floating poster collage */}
          <div className="relative hidden lg:block">
            <div className="relative h-[640px] max-h-[80vh]">
              {collageShows.map((show, index) => {
                const theme = BRAND_GLOWS[show.brandColor]
                const artwork = getArtworkUrl(show.posterUrl ?? show.heroImageUrl)
                const positions = [
                  { top: '0%', left: '10%', width: '44%', rotate: '-3deg', zIndex: 3 },
                  { top: '8%', right: '0%', width: '38%', rotate: '4deg', zIndex: 2 },
                  { bottom: '4%', left: '0%', width: '40%', rotate: '2deg', zIndex: 4 },
                  { bottom: '14%', right: '10%', width: '36%', rotate: '-5deg', zIndex: 1 },
                ] as const
                const current = positions[index]
                if (!current) return null

                return (
                  <Link
                    key={show.slug}
                    href={`/series/${show.slug}`}
                    className="group absolute block cursor-pointer overflow-hidden rounded-[8px] bg-[var(--bg-2)] shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-shadow duration-500 ease-out hover:shadow-[0_28px_64px_rgba(0,0,0,0.56)] motion-reduce:transform-none"
                    style={{
                      ...current,
                      aspectRatio: '2 / 3',
                      ['--poster-rotate' as string]: current.rotate,
                      animation: `floatPoster 9s ease-in-out ${index * 1.1}s infinite`,
                    }}
                  >
                    <div className="absolute inset-0">
                      {artwork ? (
                        <Image
                          src={artwork}
                          alt={show.title}
                          fill
                          unoptimized
                          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div
                          className="absolute inset-0"
                          style={{
                            background: `linear-gradient(160deg, ${theme.glow} 0%, rgba(18,18,18,0.92) 44%, rgba(10,10,10,1) 100%)`,
                          }}
                        />
                      )}
                    </div>
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,rgba(0,0,0,0.85)_100%)]" />
                    <div className="absolute inset-x-3 bottom-3 z-10 text-white">
                      <div className="mono mb-1 text-[9.5px] tracking-[0.15em] text-[var(--primary)]">
                        {show.genre}
                      </div>
                      <div className="font-[family-name:var(--font-display)] text-[18px] leading-[1.15] text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                        {show.title}
                      </div>
                    </div>
                  </Link>
                )
              })}

              <div
                className="pointer-events-none absolute left-1/2 top-[48%] z-10 flex -translate-x-1/2 -translate-y-1/2 rotate-[-6deg] items-center gap-2 rounded-[4px] bg-[var(--primary)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary-foreground)] shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3" /></svg>
                Now playing
              </div>
            </div>

            <style>{`
              @keyframes floatPoster {
                0%, 100% { transform: translateY(0px) rotate(var(--poster-rotate, 0deg)); }
                50% { transform: translateY(-10px) rotate(var(--poster-rotate, 0deg)); }
              }
            `}</style>
          </div>
        </div>
      </div>
    </section>
  )
}
