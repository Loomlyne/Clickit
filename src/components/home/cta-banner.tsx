import { getLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getFeaturedShows } from '@/lib/queries'
import type { Locale } from '@/lib/locale'

export async function CtaBanner() {
  const [shows, t] = await Promise.all([
    getFeaturedShows((await getLocale()) as Locale),
    getTranslations('landing'),
  ])
  const backdrop = shows[2]?.heroImageUrl || shows[0]?.posterUrl

  return (
    <section className="relative overflow-hidden border-y border-[var(--line)] px-10 py-28 text-center">
      {backdrop && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 grayscale"
          style={{ backgroundImage: `url(${backdrop})` }}
        />
      )}
      <div className="relative mx-auto max-w-[720px]">
        <div className="mono mb-3.5 text-[var(--primary)]">
          {t('ctaEyebrow')}
        </div>
        <h2 className="mb-6 font-[family-name:var(--font-display)] text-[clamp(40px,6vw,80px)] leading-none font-normal tracking-[-0.02em]">
          {t('ctaHeading')}
        </h2>
        <p className="mb-9 text-[17px] text-[var(--text-dim)]">
          {t('ctaBody')}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/auth"
            className="inline-flex items-center rounded-full bg-[var(--primary)] px-6 py-3.5 text-[15px] font-medium text-[var(--primary-foreground)] transition-all hover:bg-white"
          >
            {t('ctaCreateFree')}
          </Link>
          <Link
            href="/watch"
            className="inline-flex items-center rounded-full border border-[var(--line-2)] px-6 py-3.5 text-[15px] font-medium text-[var(--text)] transition-all hover:bg-white/[0.04]"
          >
            {t('ctaTour')}
          </Link>
        </div>
      </div>
    </section>
  )
}
