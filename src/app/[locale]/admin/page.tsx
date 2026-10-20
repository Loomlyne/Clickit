import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { AdminPageHeader } from '@/components/admin/admin-shell'
import { ShowsTable } from '@/components/admin/shows-table'
import { AdminProfileCard } from '@/components/admin/admin-profile-card'
import type { Database } from '@/lib/database.types'
import { stripStorageCacheBust } from '@/lib/supabase-media'

type CategoryJoin = { name_en: string; slug: string; color: string | null }
type ShowCategoryRow = Pick<
  Database['public']['Tables']['show_categories']['Row'],
  'show_id'
> & {
  categories: CategoryJoin | CategoryJoin[] | null
}

export default async function AdminPage() {
  const supabase = await createClient()
  const tDash = await getTranslations('admin.dashboard')

  const [
    {
      data: { user },
    },
    { data: shows },
    { data: profile },
    { data: showCategories },
  ] = await Promise.all([
    supabase.auth.getUser(),
    // Order by sort_order to match reorderShow(), so admin drag/up-down
    // reordering persists across re-render/refresh instead of reverting to
    // creation order. created_at is the tiebreaker for equal sort_order.
    supabase
      .from('shows')
      .select('*')
      .eq('archived', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('*').single(),
    supabase
      .from('show_categories')
      .select('show_id, categories!inner(name_en, slug, color)'),
  ])

  const categoriesByShowId = (
    (showCategories as ShowCategoryRow[] | null) ?? []
  ).reduce<
    Record<string, { name: string; slug: string; color: string | null }[]>
  >((acc, row) => {
    const category = Array.isArray(row.categories)
      ? row.categories[0]
      : row.categories
    if (!category) return acc
    if (!acc[row.show_id]) acc[row.show_id] = []
    acc[row.show_id].push({
      name: category.name_en,
      slug: category.slug,
      color: category.color ?? null,
    })
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <AdminProfileCard
        email={user?.email ?? ''}
        displayName={profile?.display_name ?? null}
        avatarUrl={
          stripStorageCacheBust(profile?.avatar_url) ??
          profile?.avatar_url ??
          null
        }
      />

      <AdminPageHeader
        title={tDash('shows')}
        action={
          <Button asChild>
            <Link href="/admin/shows/new">
              <Plus className="size-4" />
              {tDash('createShow')}
            </Link>
          </Button>
        }
      />

      <ShowsTable shows={shows ?? []} categoriesByShowId={categoriesByShowId} />
    </div>
  )
}
