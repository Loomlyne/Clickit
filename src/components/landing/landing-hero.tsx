import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAppConfig } from '@/lib/config'
import { extractYouTubeId } from '@/lib/youtube'

export async function LandingHero() {
  const supabase = await createClient()
  const [{ data: { session } }, config] = await Promise.all([
    supabase.auth.getSession(),
    getAppConfig(),
  ])
  const ctaHref = session?.user ? '/browse' : '/auth'

  const { heroVideoUrl, heroVideoType } = config
  const ytId = heroVideoType === 'youtube' && heroVideoUrl ? extractYouTubeId(heroVideoUrl) : null
  const hasVideo = heroVideoType === 'mp4' ? Boolean(heroVideoUrl) : Boolean(ytId)

  return (
    <section className="relative -mt-16 min-h-dvh overflow-hidden">
      {/* MP4 background */}
      {heroVideoType === 'mp4' && heroVideoUrl && (
        <video
          src={heroVideoUrl}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* YouTube background — scaled iframe trick: covers any viewport at 16:9 */}
      {ytId && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&disablekb=1`}
            allow="autoplay; encrypted-media"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ width: '177.78vh', height: '56.25vw', minWidth: '100%', minHeight: '100%' }}
            title="Hero background video"
          />
        </div>
      )}

      {/* Dark overlay so text stays legible over video */}
      {hasVideo && (
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/25" />
      )}

      <div className="relative flex min-h-dvh items-center px-4 pt-28 pb-16 sm:px-6 md:px-10 md:pt-32 md:pb-20">
        <div className="mx-auto w-full max-w-[1400px]">
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
          </div>
        </div>
      </div>
    </section>
  )
}
