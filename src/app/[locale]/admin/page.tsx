import { createClient } from '@/lib/supabase/server'
import { ShowsTable } from '@/components/admin/shows-table'
import { AdminProfileCard } from '@/components/admin/admin-profile-card'

export default async function AdminPage() {
  const supabase = await createClient()

  const [{ data: { user } }, { data: shows }, { data: profile }, { data: showCategories }] = await Promise.all([
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
    supabase
      .from('show_categories')
      .select('show_id, categories!inner(name_en, slug)'),
  ])

  const categoriesByShowId = (showCategories ?? []).reduce<Record<string, { name: string; slug: string }[]>>((acc, row: any) => {
    const category = Array.isArray(row.categories) ? row.categories[0] : row.categories
    if (!category) return acc
    if (!acc[row.show_id]) acc[row.show_id] = []
    acc[row.show_id].push({ name: category.name_en, slug: category.slug })
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Profile card */}
      <AdminProfileCard
        email={user?.email ?? ''}
        displayName={profile?.display_name ?? null}
        avatarUrl={profile?.avatar_url ?? null}
      />

      <ShowsTable shows={shows ?? []} categoriesByShowId={categoriesByShowId} />
    </div>
  )
}
