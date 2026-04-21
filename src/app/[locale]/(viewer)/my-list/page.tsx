import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWatchlistShows } from '@/lib/queries'
import { PortraitShowCard } from '@/components/shows/portrait-show-card'
import { SectionHeader } from '@/components/primitives/section-header'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('myList')
  return {
    title: `${t('pageTitle')} | Clickit Story`,
    description: t('emptyDescription'),
  }
}

export default async function MyListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const locale = await getLocale()
    return redirect({ href: '/auth?next=/my-list', locale })
  }

  const [locale, t, tCommon, shows] = await Promise.all([
    getLocale(),
    getTranslations('myList'),
    getTranslations('common'),
    getWatchlistShows(user.id),
  ])
  const isArabic = locale === 'ar'

  return (
    <div className="pb-20">
      <div className="relative overflow-hidden px-6 py-8 md:px-12">
        <div className="relative mx-auto max-w-5xl rounded-[28px] border border-white/10 bg-white/[0.03] px-8 py-12 text-center shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
          <p
            className="mb-4 text-[11px] uppercase tracking-[0.28em]"
            style={{ color: 'var(--color-brand-blue-safe)' }}
          >
            {t('pageTitle')}
          </p>
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-4xl md:text-5xl">
            {t('heading')}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-lg text-white/50">
            {shows.length > 0
              ? t(shows.length === 1 ? 'countOne' : 'countMany', { count: shows.length })
              : t('emptyDescription')}
          </p>
        </div>
      </div>

      {/* Show grid or empty state */}
      {shows.length > 0 ? (
        <div className="px-6 md:px-12">
          <SectionHeader title={isArabic ? 'برامجك' : 'Your Shows'} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-5 mt-2">
            {shows.map((show, i) => (
              <ScrollReveal key={show.id} delay={i * 0.04}>
                <PortraitShowCard show={show} initialSaved={true} userId={user.id} />
              </ScrollReveal>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 px-6 py-32 text-center">
          <h3 className="text-2xl font-semibold tracking-[-0.03em] text-white">{isArabic ? 'قائمتك فارغة' : 'Your list is empty'}</h3>
          <p className="text-sm text-white/50">{t('emptyDescription')}</p>
          <Link href="/" className="rounded-full border border-white/14 bg-white/[0.03] px-6 py-3 text-sm text-white/70 transition-all duration-200 hover:border-white/24 hover:text-white">
            {tCommon('browseShows')}
          </Link>
        </div>
      )}
    </div>
  )
}
