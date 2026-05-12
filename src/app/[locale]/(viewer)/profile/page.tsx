import type { Metadata } from 'next'
import { getLocale as getIntlLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLocale } from '@/lib/locale'
import { ProfileForm } from '@/components/profile/profile-form'
import { ProfileHeader } from '@/components/profile/profile-header'
import { ProfileHistoryRow } from '@/components/profile/profile-history-row'
import { PortraitShowCard } from '@/components/shows/portrait-show-card'
import { LanguagePreference } from '@/components/profile/language-preference'
import { getWatchlistShows, getLikedShows, getRecentlyWatched } from '@/lib/queries'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('profile')
  return {
    title: `Clickit Story`,
    description: t('accountHeading'),
  }
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const locale = await getIntlLocale()
    return redirect({ href: '/auth', locale })
  }

  const [{ data: profile }, { data: config }] = await Promise.all([
    supabase.from('profiles').select('display_name, avatar_url').eq('id', user.id).single(),
    supabase.from('app_config').select('admin_user_id').single(),
  ])

  const isAdmin = config?.admin_user_id === user.id

  // Fetch personalization data
  const [watchlistShows, likedShows, recentlyWatched, locale, t, tCommon] = await Promise.all([
    getWatchlistShows(user.id),
    getLikedShows(user.id),
    getRecentlyWatched(user.id),
    getLocale(),
    getTranslations('profile'),
    getTranslations('common'),
  ])

  const displayName = profile?.display_name ?? ''
  const email = user.email ?? ''

  return (
    <div className="relative min-h-dvh">
      <div className="relative z-10 mx-auto w-full max-w-5xl space-y-8 px-6 pb-16 pt-8 md:px-12">
        <ProfileHeader
          displayName={displayName}
          email={email}
          avatarUrl={profile?.avatar_url ?? null}
          isAdmin={isAdmin}
        />

        <div id="account-settings" className="rounded-[24px] border border-[var(--line)] bg-[var(--bg-1)] p-6">
          <h3 className="font-display mb-4 text-lg font-semibold tracking-[-0.02em] text-white">
            {t('accountHeading')}
          </h3>
          <ProfileForm displayName={displayName} />
        </div>

        <div className="rounded-[24px] border border-[var(--line)] bg-[var(--bg-1)] p-6">
          <h3 className="font-display mb-1 text-lg font-semibold tracking-[-0.02em] text-white">
            {t('languageHeading')}
          </h3>
          <p className="mb-4 text-sm text-[var(--text-mute)]">
            {t('languageDescription')}
          </p>
          <LanguagePreference current={locale} />
        </div>

        <div className="rounded-[24px] border border-[var(--line)] bg-[var(--bg-1)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold tracking-[-0.02em] text-white">
              {t('myListHeading')}
              {watchlistShows.length > 0 && (
                <span className="ms-2 font-mono text-sm font-normal text-[var(--text-mute)]">
                  {watchlistShows.length}
                </span>
              )}
            </h3>
            {watchlistShows.length > 0 && (
              <Link
                href="/my-list"
                className="text-sm text-[var(--text-dim)] hover:text-white transition-colors"
              >
                {t('myListSeeAll')} &rarr;
              </Link>
            )}
          </div>
          {watchlistShows.length > 0 ? (
            <div className="relative before:pointer-events-none before:absolute before:inset-y-0 before:end-0 before:z-10 before:w-10 before:bg-[linear-gradient(90deg,transparent,var(--bg-1))]">
              <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
                {watchlistShows.slice(0, 8).map((show) => (
                  <div key={show.id} className="w-32 flex-shrink-0">
                    <PortraitShowCard show={show} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-mute)] py-6 text-center">
              {t('myListEmpty')}.{' '}
              <Link href="/watch" className="text-[var(--text-dim)] hover:text-white underline">
                {tCommon('browseShows')}
              </Link>
            </p>
          )}
        </div>

        <div className="rounded-[24px] border border-[var(--line)] bg-[var(--bg-1)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold tracking-[-0.02em] text-white">
              {t('likedHeading')}
              {likedShows.length > 0 && (
                <span className="ms-2 font-mono text-sm font-normal text-[var(--text-mute)]">
                  {likedShows.length}
                </span>
              )}
            </h3>
          </div>
          {likedShows.length > 0 ? (
            <div className="relative before:pointer-events-none before:absolute before:inset-y-0 before:end-0 before:z-10 before:w-10 before:bg-[linear-gradient(90deg,transparent,var(--bg-1))]">
              <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
                {likedShows.slice(0, 8).map((show) => (
                  <div key={show.id} className="w-32 flex-shrink-0">
                    <PortraitShowCard show={show} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-mute)] py-6 text-center">
              {t('likedEmpty')}
            </p>
          )}
        </div>

        <div className="rounded-[24px] border border-[var(--line)] bg-[var(--bg-1)] p-6">
          <h3 className="font-display mb-4 text-lg font-semibold tracking-[-0.02em] text-white">
            {t('historyHeading')}
          </h3>
          {recentlyWatched.length > 0 ? (
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <div className="min-w-[520px]">
                {recentlyWatched.map((item) => (
                  <ProfileHistoryRow key={item.episodeId} item={item} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-mute)] py-6 text-center">
              {t('historyEmpty')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
