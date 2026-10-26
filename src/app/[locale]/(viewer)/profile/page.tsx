import type { Metadata } from 'next'
import { getLocale as getIntlLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { getAppConfig } from '@/lib/config'
import { getAdminStatus } from '@/server/auth-guards'
import { requireViewer } from '@/server/auth/require-viewer'
import { AccountSettings } from '@/components/profile/account-settings'
import { ProfileHeader } from '@/components/profile/profile-header'
import { ProfileHistoryRow } from '@/components/profile/profile-history-row'
import { PortraitShowCard } from '@/components/shows/portrait-show-card'
import {
  getWatchlistShows,
  getLikedShows,
  getRecentlyWatched,
} from '@/lib/queries'
import type { Locale } from '@/lib/locale'
import { stripStorageCacheBust } from '@/lib/supabase-media'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('profile')
  return {
    title: `Clickit Story`,
    description: t('accountHeading'),
  }
}

export default async function ProfilePage() {
  const locale = (await getIntlLocale()) as Locale
  // Page-level wall (05-40, W12): a signed-out visitor signs in and comes back here.
  const { userId, user } = await requireViewer(locale, '/profile')
  const supabase = await createClient()

  const [{ data: profile }, adminStatus, appConfig] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, avatar_url, password_set_at, notify_new_episodes')
      .eq('id', userId)
      .single(),
    getAdminStatus(),
    getAppConfig(),
  ])

  const isAdmin = adminStatus.isAdmin

  // Fetch personalization data
  const [watchlistShows, likedShows, recentlyWatched, t, tCommon] =
    await Promise.all([
      getWatchlistShows(userId, locale),
      getLikedShows(userId, locale),
      getRecentlyWatched(userId),
      getTranslations('profile'),
      getTranslations('common'),
    ])

  const displayName = profile?.display_name ?? ''
  const email = user.email ?? ''

  return (
    <div className="relative min-h-dvh">
      <div className="relative z-10 mx-auto w-full max-w-5xl space-y-8 px-4 pt-8 pb-16 sm:px-6 md:px-12">
        <ProfileHeader
          displayName={displayName}
          email={email}
          avatarUrl={
            stripStorageCacheBust(profile?.avatar_url) ??
            profile?.avatar_url ??
            null
          }
          isAdmin={isAdmin}
          signOutRedirect={
            appConfig.flags.comingSoonMode ? '/coming-soon' : '/watch'
          }
        />

        <AccountSettings
          displayName={displayName}
          email={email}
          locale={locale}
          hasPassword={Boolean(profile?.password_set_at)}
          notifyNewEpisodes={profile?.notify_new_episodes ?? true}
          pendingEmail={user.new_email ?? null}
          emailChangeSentAt={user.email_change_sent_at ?? null}
        />

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-[var(--text)]">
                {t('myListHeading')}
                {watchlistShows.length > 0 && (
                  <span className="ms-2 font-mono text-sm font-normal text-[var(--text-mute)]">
                    {watchlistShows.length}
                  </span>
                )}
              </h2>
              {watchlistShows.length > 0 && (
                <Link
                  href="/my-list"
                  className="inline-flex min-h-11 items-center ps-2 text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
                >
                  {t('myListSeeAll')} &rarr;
                </Link>
              )}
            </div>
            {watchlistShows.length > 0 ? (
              <div className="relative before:pointer-events-none before:absolute before:inset-y-0 before:end-0 before:z-10 before:w-10 before:bg-[linear-gradient(90deg,transparent,var(--bg-1))] rtl:before:bg-[linear-gradient(270deg,transparent,var(--bg-1))]">
                <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
                  {watchlistShows.slice(0, 8).map((show) => (
                    <div key={show.id} className="w-32 flex-shrink-0">
                      <PortraitShowCard show={show} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-[var(--text-mute)]">
                <p>{t('myListEmpty')}</p>
                <Button asChild variant="outline" className="mt-3">
                  <Link href="/watch">{tCommon('browseShows')}</Link>
                </Button>
              </div>
            )}
          </div>

          <div className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-[var(--text)]">
                {t('likedHeading')}
                {likedShows.length > 0 && (
                  <span className="ms-2 font-mono text-sm font-normal text-[var(--text-mute)]">
                    {likedShows.length}
                  </span>
                )}
              </h2>
            </div>
            {likedShows.length > 0 ? (
              <div className="relative before:pointer-events-none before:absolute before:inset-y-0 before:end-0 before:z-10 before:w-10 before:bg-[linear-gradient(90deg,transparent,var(--bg-1))] rtl:before:bg-[linear-gradient(270deg,transparent,var(--bg-1))]">
                <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
                  {likedShows.slice(0, 8).map((show) => (
                    <div key={show.id} className="w-32 flex-shrink-0">
                      <PortraitShowCard show={show} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-[var(--text-mute)]">
                <p>{t('likedEmpty')}</p>
                <Button asChild variant="outline" className="mt-3">
                  <Link href="/watch">{tCommon('browseShows')}</Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5 sm:p-6">
          <h2 className="font-display mb-4 text-lg font-semibold tracking-[-0.02em] text-[var(--text)]">
            {t('historyHeading')}
          </h2>
          {recentlyWatched.length > 0 ? (
            <div className="space-y-1">
              {recentlyWatched.map((item) => (
                <ProfileHistoryRow key={item.episodeId} item={item} />
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-[var(--text-mute)]">
              {t('historyEmpty')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
