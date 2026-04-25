import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWatchlistShows } from '@/lib/queries'
import { PortraitShowCard } from '@/components/shows/portrait-show-card'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('myList')
  return {
    title: `${t('pageTitle')} | Clickit Story`,
    description: t('emptyDescription'),
  }
}

export default async function MyListPage() {
  // proxy.ts already validated the JWT — getSession() reads the cookie locally.
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

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
      {/* Header */}
      <div className="px-6 pb-12 pt-16 md:px-12">
        <div className="mx-auto max-w-5xl">
          <p className="mono mb-4 text-[var(--text-mute)]">
            {isArabic ? 'قائمتك' : 'Your watchlist'}
          </p>
          <h1 className="font-display text-[clamp(2.5rem,5vw,56px)] font-normal leading-[1.05] tracking-[-0.02em] text-[var(--text)]">
            {t('pageTitle')}
          </h1>
          <p className="mt-3 text-[var(--text-dim)]">
            {shows.length > 0
              ? t(shows.length === 1 ? 'countOne' : 'countMany', { count: shows.length })
              : t('emptyDescription')}
          </p>
        </div>
      </div>

      {/* Show grid or empty state */}
      {shows.length > 0 ? (
        <div className="mx-auto max-w-5xl px-6 md:px-12">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-4 xl:grid-cols-5">
            {shows.map((show) => (
              <PortraitShowCard
                key={show.id}
                show={show}
                initialSaved={true}
                userId={user.id}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-5xl px-6 md:px-12">
          <div className="border-t border-[var(--line)] py-24 text-center">
            <h3 className="font-display text-[32px] font-normal leading-[1.1] text-[var(--text)]">
              {isArabic ? 'قائمتك فارغة' : 'Nothing here yet.'}
            </h3>
            <p className="mt-3 text-[14px] text-[var(--text-dim)]">
              {t('emptyDescription')}
            </p>
            <Link
              href="/"
              className="mono mt-6 inline-block rounded-[4px] border border-[var(--line-2)] bg-transparent px-6 py-3 text-[12px] text-[var(--text-dim)] transition-colors hover:border-[var(--accent-yellow)] hover:text-[var(--text)]"
            >
              {tCommon('browseShows')}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
