import { getTranslations } from 'next-intl/server'
import { Plus } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { AdminPageHeader } from '@/components/admin/admin-shell'
import { ShowsTable } from '@/components/admin/shows-table'
import { AdminProfileCard } from '@/components/admin/admin-profile-card'
import { YouTubeCheckPanel } from '@/components/admin/youtube-check-panel'
import * as youtubeHealth from '@/lib/admin/youtube-health'
import { readAllPages } from '@/lib/admin/read-all-pages'
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
  const admin = createAdminClient()
  const tDash = await getTranslations('admin.dashboard')

  const [
    {
      data: { user },
    },
    { data: shows },
    { data: profile },
    { data: showCategories },
    healthEpisodes,
    healthSeasons,
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
    // Admin client: the status columns are read for the YouTube check panel
    // (admin-only page). Separate reads, joined in code below. Paged in id
    // order so the panel sees every episode past the PostgREST 1000-row cap.
    readAllPages((from, to) =>
      admin
        .from('episodes')
        .select(
          'id, show_id, season_id, episode_number, archived, youtube_status, youtube_checked_at, player_error_at, player_error_code'
        )
        .eq('archived', false)
        .order('id')
        .range(from, to)
    ),
    admin.from('seasons').select('id, season_number'),
  ])

  // A failed read renders no panel: "All episodes play" must never be shown
  // for data that was not read.
  let healthSummary: youtubeHealth.YouTubeHealthSummary | null = null
  if (healthEpisodes.error || healthSeasons.error) {
    console.error(
      '[admin/dashboard] youtube check read failed',
      healthEpisodes.error ?? healthSeasons.error
    )
  } else {
    const showTitles = new Map((shows ?? []).map((s) => [s.id, s.title]))
    const seasonNumbers = new Map(
      (healthSeasons.data ?? []).map((s) => [s.id, s.season_number])
    )
    const rows: youtubeHealth.HealthRow[] = []
    for (const ep of healthEpisodes.data ?? []) {
      const showTitle = showTitles.get(ep.show_id)
      if (showTitle === undefined) continue // archived or removed show
      rows.push({
        id: ep.id,
        show_id: ep.show_id,
        show_title: showTitle,
        season_number: seasonNumbers.get(ep.season_id) ?? null,
        episode_number: ep.episode_number,
        archived: ep.archived,
        youtube_status: ep.youtube_status,
        youtube_checked_at: ep.youtube_checked_at,
        player_error_at: ep.player_error_at,
        player_error_code: ep.player_error_code,
      })
    }
    healthSummary = youtubeHealth.summarizeYouTubeHealth(rows, new Date())
  }

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

      {healthSummary && <YouTubeCheckPanel summary={healthSummary} />}

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
