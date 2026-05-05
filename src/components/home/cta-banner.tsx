import { Link } from '@/i18n/navigation'
import { getAppConfig } from '@/lib/config'
import { getCatalogStage, getFeaturedShows } from '@/lib/queries'

export async function CtaBanner() {
  const [shows, { stage }, config] = await Promise.all([
    getFeaturedShows(),
    getCatalogStage(),
    getAppConfig(),
  ])

  if (!config.flags.showCtaBanner) return null

  const copy = config.ctaCopy[stage]
  const backdrop = shows[2]?.heroImageUrl || shows[0]?.posterUrl

  return (
    <section className="relative overflow-hidden border-y border-[var(--line)] py-28 px-10 text-center">
      {backdrop && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 grayscale"
          style={{ backgroundImage: `url(${backdrop})` }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent, var(--bg-0))' }}
      />
      <div className="relative mx-auto max-w-[720px]">
        <div className="mono mb-3.5 text-[var(--primary)]">{copy.label}</div>
        <h2 className="font-[family-name:var(--font-display)] text-[clamp(40px,6vw,80px)] font-normal leading-none tracking-[-0.02em] mb-6">
          {copy.headline}{' '}
          <span className="text-[var(--text-mute)]">{copy.headlineB}</span>
        </h2>
        <p className="text-[17px] text-[var(--text-dim)] mb-9">
          {copy.body}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href={copy.primaryHref}
            className="inline-flex items-center rounded bg-[var(--primary)] px-6 py-3.5 text-[15px] font-medium text-[var(--primary-foreground)] transition-all hover:bg-white"
          >
            {copy.primaryLabel}
          </Link>
          <Link
            href={copy.secondaryHref}
            className="inline-flex items-center rounded border border-[var(--line-2)] px-6 py-3.5 text-[15px] font-medium text-[var(--text)] transition-all hover:bg-white/[0.04]"
          >
            {copy.secondaryLabel}
          </Link>
        </div>
      </div>
    </section>
  )
}
