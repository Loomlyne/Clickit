import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWatchlistShows } from '@/lib/queries'
import { Button } from '@/components/ui/button'
import { PortraitShowCard } from '@/components/shows/portrait-show-card'
import type { Locale } from '@/lib/locale'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('myList')
  return {
    title: `${t('pageTitle')} | Clickit Story`,
    description: t('emptyDescription'),
  }
}

export default async function MyListPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const locale = await getLocale()
    return redirect({ href: '/auth?next=/my-list', locale })
  }

  const [t, tCommon, shows] = await Promise.all([
    getTranslations('myList'),
    getTranslations('common'),
    getWatchlistShows(user.id, (await getLocale()) as Locale),
  ])

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="px-6 pt-16 pb-12 md:px-12">
        <div className="mx-auto max-w-5xl">
          <p className="mono mb-4 text-[var(--text-mute)]">{t('eyebrow')}</p>
          <h1 className="font-display text-[clamp(2.5rem,5vw,56px)] leading-[1.05] font-normal tracking-[-0.02em] text-[var(--text)]">
            {t('pageTitle')}
          </h1>
          <p className="mt-3 text-[var(--text-dim)]">
            {shows.length > 0
              ? t(shows.length === 1 ? 'countOne' : 'countMany', {
                  count: shows.length,
                })
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
            <h3 className="font-display text-[32px] leading-[1.1] font-normal text-[var(--text)]">
              {t('emptyHeading')}
            </h3>
            <p className="mt-3 text-[14px] text-[var(--text-dim)]">
              {t('emptyDescription')}
            </p>
            <Button variant="outline" className="mt-6" asChild>
              <Link href="/watch">{tCommon('browseShows')}</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
