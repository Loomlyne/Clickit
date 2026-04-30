import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { StatusBadge } from '@/components/admin/status-badge'
import { SeasonTabs } from '@/components/admin/season-tabs'
import { EditShowButton } from '@/components/admin/edit-show-button'
import { CastEditor } from '@/components/admin/cast-editor'
import { AdminBackLink, AdminPanel } from '@/components/admin/admin-shell'
import { Badge } from '@/components/ui/badge'
import type { Database } from '@/lib/database.types'

type Episode = Database['public']['Tables']['episodes']['Row']

export default async function ShowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const [t, tDash, tShows, locale] = await Promise.all([
    getTranslations('admin.showForm'),
    getTranslations('admin.dashboard'),
    getTranslations('admin.shows'),
    getLocale(),
  ])
  const isArabic = locale === 'ar'

  const { data: show } = await supabase
    .from('shows')
    .select('*')
    .eq('id', id)
    .single()

  if (!show) notFound()

  const [
    { data: seasons },
    { data: episodes },
    { data: allEpisodes },
    { data: castMembers },
    { data: showCategories },
  ] = await Promise.all([
    supabase
      .from('seasons')
      .select('*')
      .eq('show_id', id)
      .order('season_number', { ascending: true }),
    supabase
      .from('episodes')
      .select('*')
      .eq('show_id', id)
      .eq('archived', false)
      .order('episode_number', { ascending: true }),
    supabase
      .from('episodes')
      .select('season_id, episode_number')
      .eq('show_id', id),
    supabase
      .from('show_cast')
      .select('*')
      .eq('show_id', id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('show_categories')
      .select('category_id, categories!inner(name_en, slug)')
      .eq('show_id', id),
  ])

  const categories = (showCategories ?? []).flatMap((row: any) => {
    const category = Array.isArray(row.categories)
      ? row.categories[0]
      : row.categories
    return category
      ? [{ id: row.category_id, name: category.name_en, slug: category.slug }]
      : []
  })

  const episodesBySeason: Record<string, Episode[]> = {}
  for (const ep of episodes ?? []) {
    if (!episodesBySeason[ep.season_id]) {
      episodesBySeason[ep.season_id] = []
    }
    episodesBySeason[ep.season_id].push(ep)
  }

  // Compute max episode_number per season across ALL episodes (including archived)
  const maxEpisodeNumberBySeason: Record<string, number> = {}
  for (const ep of allEpisodes ?? []) {
    const current = maxEpisodeNumberBySeason[ep.season_id] ?? 0
    if (ep.episode_number > current) {
      maxEpisodeNumberBySeason[ep.season_id] = ep.episode_number
    }
  }

  return (
    <div className="space-y-6">
      <AdminBackLink href="/admin">{tDash('allShows')}</AdminBackLink>

      <AdminPanel className="p-6 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-muted-foreground text-xs tracking-[0.24em] uppercase">
              {tShows('showDetail')}
            </p>
            <h1 className="text-foreground mt-3 text-3xl font-semibold tracking-tight">
              {show.title}
            </h1>
            <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span>{show.genre}</span>
              <span>·</span>
              <span>
                {show.episode_count} {tShows('episodes')}
              </span>
              <span>·</span>
              <span>
                {(seasons ?? []).length} {tShows('seasons')}
              </span>
              {show.broadcast_day && (
                <>
                  <span>·</span>
                  <span>
                    {show.broadcast_day} {show.broadcast_time}
                  </span>
                </>
              )}
            </div>
            {categories.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Badge key={category.id} variant="secondary">
                    {category.name}
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-muted-foreground mt-4 max-w-3xl text-sm leading-7 md:text-base">
              {show.description}
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 rounded-lg border border-white/8 bg-white/[0.03] px-4 py-4">
            <span className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
              {tShows('publishingState')}
            </span>
            <StatusBadge status={show.status} />
            <EditShowButton show={show} />
          </div>
        </div>
      </AdminPanel>

      {/* Cast & Crew */}
      <AdminPanel className="p-6 md:p-8">
        <CastEditor showId={id} cast={castMembers ?? []} />
      </AdminPanel>

      <SeasonTabs
        seasons={seasons ?? []}
        episodesBySeason={episodesBySeason}
        maxEpisodeNumberBySeason={maxEpisodeNumberBySeason}
        showId={id}
      />
    </div>
  )
}
