import type { Metadata } from 'next'
import { redirect } from '@/i18n/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getLocale } from '@/lib/locale'
import { ProfileForm } from '@/components/profile/profile-form'
import { ProfileHeader } from '@/components/profile/profile-header'
import { ProfileHistoryRow } from '@/components/profile/profile-history-row'
import { PortraitShowCard } from '@/components/shows/portrait-show-card'
import { LanguagePreference } from '@/components/profile/language-preference'
import { getWatchlistShows, getLikedShows, getRecentlyWatched } from '@/lib/queries'

export const metadata: Metadata = {
  title: 'Profile | Clickit Story',
  description: 'Manage your Clickit Story account',
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth')

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user.id)
    .single()

  // Check if admin
  const { data: config } = await supabase
    .from('app_config')
    .select('admin_user_id')
    .single()

  const isAdmin = config?.admin_user_id === user.id

  // Fetch personalization data
  const [watchlistShows, likedShows, recentlyWatched, locale] = await Promise.all([
    getWatchlistShows(user.id),
    getLikedShows(user.id),
    getRecentlyWatched(user.id),
    getLocale(),
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

        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
          <h3 className="font-display mb-4 text-lg font-semibold tracking-[-0.02em] text-white">
            Account Settings
          </h3>
          <ProfileForm displayName={displayName} />
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
          <h3 className="font-display mb-1 text-lg font-semibold tracking-[-0.02em] text-white">
            Language
          </h3>
          <p className="mb-4 text-sm text-white/40">
            Changes the language and text direction across the entire platform.
          </p>
          <LanguagePreference current={locale} />
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold tracking-[-0.02em] text-white">
              My List
              {watchlistShows.length > 0 && (
                <span className="ml-2 text-sm font-normal text-white/40">
                  {watchlistShows.length}
                </span>
              )}
            </h3>
            {watchlistShows.length > 0 && (
              <Link
                href="/my-list"
                className="text-sm text-white/50 hover:text-white transition-colors"
              >
                See all &rarr;
              </Link>
            )}
          </div>
          {watchlistShows.length > 0 ? (
            <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
              {watchlistShows.slice(0, 8).map((show) => (
                <div key={show.id} className="w-32 flex-shrink-0">
                  <PortraitShowCard show={show} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/40 py-6 text-center">
              No saved shows yet.{' '}
              <Link href="/series" className="text-white/60 hover:text-white underline">
                Browse shows
              </Link>
            </p>
          )}
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold tracking-[-0.02em] text-white">
              Liked Shows
              {likedShows.length > 0 && (
                <span className="ml-2 text-sm font-normal text-white/40">
                  {likedShows.length}
                </span>
              )}
            </h3>
          </div>
          {likedShows.length > 0 ? (
            <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
              {likedShows.slice(0, 8).map((show) => (
                <div key={show.id} className="w-32 flex-shrink-0">
                  <PortraitShowCard show={show} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/40 py-6 text-center">
              No liked shows yet. Hit the heart on any show to see it here.
            </p>
          )}
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
          <h3 className="font-display mb-4 text-lg font-semibold tracking-[-0.02em] text-white">
            Recently Watched
          </h3>
          {recentlyWatched.length > 0 ? (
            <div>
              {recentlyWatched.map((item) => (
                <ProfileHistoryRow key={item.episodeId} item={item} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/40 py-6 text-center">
              No watch history yet.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
