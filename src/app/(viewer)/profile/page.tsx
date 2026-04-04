import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CinematicBackdrop } from '@/components/primitives/cinematic-backdrop'
import { ProfileForm } from '@/components/profile/profile-form'

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

  return (
    <div className="-mt-16 relative min-h-screen flex items-center justify-center overflow-hidden">
      <CinematicBackdrop
        brandColor="#2C3569"
        intensity="high"
        watermarkText="CIT"
        className="absolute inset-0"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.8)_70%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-[480px] mx-6 my-12">
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
    </div>
  )
}
