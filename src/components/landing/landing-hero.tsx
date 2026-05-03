import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'

export async function LandingHero() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const ctaHref = session?.user ? '/browse' : '/auth'

  return (
    <section className="relative -mt-16 min-h-dvh overflow-hidden">
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
