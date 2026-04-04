import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CinematicBackdrop } from '@/components/primitives/cinematic-backdrop'
import { ProfileForm } from '@/components/profile/profile-form'
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

  return (
    <div className="-mt-16 relative min-h-screen overflow-hidden">
      <CinematicBackdrop
        brandColor="#2C3569"
        intensity="high"
        watermarkText="CIT"
        className="absolute inset-0"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.8)_70%)] pointer-events-none" />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 md:px-12 py-24">
        {/* Settings card */}
        <div className="mx-auto max-w-[480px]">
          <div
            className="rounded-2xl p-8 backdrop-blur-xl"
            style={{
              background: 'rgba(17, 17, 22, 0.85)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 32px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <h2
              className="font-display font-semibold text-white text-center mb-1"
              style={{ fontSize: '1.75rem' }}
            >
              Your Profile
            </h2>
            <p className="text-white/50 text-sm text-center mb-8">
              Manage your account settings
            </p>

            <ProfileForm
              email={user.email ?? ''}
              displayName={profile?.display_name ?? ''}
              avatarUrl={profile?.avatar_url ?? null}
              isAdmin={isAdmin}
            />
          </div>
        </div>

        {/* Personalization sections */}
        <div className="mt-12 space-y-12">
          {/* My List preview */}
          <div className="rounded-2xl border border-white/10 bg-[rgba(17,17,22,0.7)] backdrop-blur-xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-xl font-semibold text-white">My List</h3>
              {watchlistShows.length > 0 && (
                <Link href="/my-list" className="text-sm text-white/50 hover:text-white transition-colors">
                  See all
                </Link>
              )}
            </div>
            {watchlistShows.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {watchlistShows.slice(0, 6).map((show) => (
                  <PortraitShowCard key={show.id} show={show} initialSaved userId={user.id} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/40 text-center py-8">
                No saved shows yet.{' '}
                <Link href="/series" className="text-white/60 hover:text-white underline">
                  Browse shows
                </Link>
              </p>
            )}
          </div>

          {/* Recently Watched */}
          <div className="rounded-2xl border border-white/10 bg-[rgba(17,17,22,0.7)] backdrop-blur-xl p-6 md:p-8">
            <h3 className="font-display text-xl font-semibold text-white mb-6">Recently Watched</h3>
            {recentlyWatched.length > 0 ? (
              <div>
                {recentlyWatched.map((item) => (
                  <ProfileHistoryRow key={item.episodeId} item={item} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/40 text-center py-8">
                No watch history yet. Start watching to see your activity here.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
