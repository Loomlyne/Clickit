import { createClient } from '@/lib/supabase/server'
import { ShowsTable } from '@/components/admin/shows-table'
import { AdminProfileCard } from '@/components/admin/admin-profile-card'

export default async function AdminPage() {
  const supabase = await createClient()

  const [{ data: { user } }, { data: shows }, { data: profile }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('shows')
      .select('*')
      .eq('archived', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('*')
      .single(),
  ])

  return (
    <div className="space-y-6">
      {/* Profile card */}
      <AdminProfileCard
        email={user?.email ?? ''}
        displayName={profile?.display_name ?? null}
        avatarUrl={profile?.avatar_url ?? null}
      />

      <ShowsTable shows={shows ?? []} />
    </div>
  )
}
