import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from '@/components/profile/profile-form'
import { ProfileHeader } from '@/components/profile/profile-header'
import { ProfileHistoryRow } from '@/components/profile/profile-history-row'
import { PortraitShowCard } from '@/components/shows/portrait-show-card'
import { getWatchlistShows, getRecentlyWatched } from '@/lib/queries'

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
  const [watchlistShows, recentlyWatched] = await Promise.all([
    getWatchlistShows(user.id),
    getRecentlyWatched(user.id),
  ])

  const displayName = profile?.display_name ?? ''
  const email = user.email ?? ''

  return (
    <div className="relative min-h-screen">
      {/* Subtle gradient at top — not heavy cinematic */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-white/[0.02] to-transparent" />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 md:px-12 pt-24 md:pt-28 pb-16 space-y-8">
        {/* Profile Header */}
        <ProfileHeader
          displayName={displayName}
          email={email}
          isAdmin={isAdmin}
        />

        {/* Account Settings */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6">
          <h3 className="font-display text-lg font-semibold text-white mb-4">
            Account Settings
          </h3>
          <ProfileForm
            displayName={displayName}
          />
        </div>

        {/* My List */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold text-white">
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
                  <PortraitShowCard show={show} initialSaved userId={user.id} />
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

        {/* Recently Watched */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6">
          <h3 className="font-display text-lg font-semibold text-white mb-4">
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
