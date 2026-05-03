import { Link } from '@/i18n/navigation'
import { getFeaturedShows } from '@/lib/queries'

export async function CtaBanner() {
  const shows = await getFeaturedShows()
  const backdrop = shows[2]?.heroImageUrl || shows[0]?.posterUrl

  return (
    <section className="relative overflow-hidden border-y border-[var(--line)] py-28 px-10 text-center">
      {backdrop && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 grayscale"
          style={{ backgroundImage: `url(${backdrop})` }}
        />
      )}
<div className="relative mx-auto max-w-[720px]">
        <div className="mono mb-3.5 text-[var(--primary)]">Start the beta</div>
        <h2 className="font-[family-name:var(--font-display)] text-[clamp(40px,6vw,80px)] font-normal leading-none tracking-[-0.02em] mb-6">
          Seven days free. Cancel in the app.
        </h2>
        <p className="text-[17px] text-[var(--text-dim)] mb-9">
          No card required. Full catalog. Keep your watchlist if you stick around.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/auth"
            className="inline-flex items-center rounded bg-[var(--primary)] px-6 py-3.5 text-[15px] font-medium text-[var(--primary-foreground)] transition-all hover:bg-white"
          >
            Create free account
          </Link>
          <Link
            href="/browse"
            className="inline-flex items-center rounded border border-[var(--line-2)] px-6 py-3.5 text-[15px] font-medium text-[var(--text)] transition-all hover:bg-white/[0.04]"
          >
            Take the tour
          </Link>
        </div>
      </div>
    </section>
  )
}
