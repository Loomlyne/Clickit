import { getTranslations } from 'next-intl/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { SeasonTabs } from '@/components/admin/season-tabs'
import { EditShowButton } from '@/components/admin/edit-show-button'
import { ScheduleEpisodesButton } from '@/components/admin/schedule-episodes-button'
import { CastEditor } from '@/components/admin/cast-editor'
import { AdminBackLink, AdminPanel } from '@/components/admin/admin-shell'
import type { Database } from '@/lib/database.types'

type Episode = Database['public']['Tables']['episodes']['Row']

export default async function ShowDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const tDash = await getTranslations('admin.dashboard')

  const { data: show, error: showError } = await supabase
    .from('shows')
    .select('*')
    .eq('id', id)
    .single()

  if (showError && showError.code !== 'PGRST116') throw showError
  if (!show) notFound()

  const [seasonsResult, episodesResult, allEpisodesResult, castMembersResult] =
    await Promise.all([
      supabase
        .from('seasons')
        .select('*')
        .eq('show_id', id)
        .order('season_number', { ascending: true }),
      admin
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
    ])

  for (const result of [
    seasonsResult,
    episodesResult,
    allEpisodesResult,
    castMembersResult,
  ]) {
    if (result.error) throw result.error
  }

  const seasons = seasonsResult.data ?? []
  const episodes = episodesResult.data ?? []
  const allEpisodes = allEpisodesResult.data ?? []
  const castMembers = castMembersResult.data ?? []

  const episodesBySeason: Record<string, Episode[]> = {}
  for (const ep of episodes) {
    if (!episodesBySeason[ep.season_id]) {
      episodesBySeason[ep.season_id] = []
    }
    episodesBySeason[ep.season_id].push(ep)
  }

  const maxEpisodeNumberBySeason: Record<string, number> = {}
  for (const ep of allEpisodes) {
    const current = maxEpisodeNumberBySeason[ep.season_id] ?? 0
    if (ep.episode_number > current) {
      maxEpisodeNumberBySeason[ep.season_id] = ep.episode_number
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <AdminBackLink href="/admin">{tDash('allShows')}</AdminBackLink>
          <h1 className="text-foreground truncate text-xl font-semibold tracking-tight sm:text-2xl">
            {show.title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ScheduleEpisodesButton showId={id} />
          <EditShowButton show={show} />
        </div>
      </div>

      <AdminPanel className="border-[#2e2e2e] bg-[#171717] p-5 md:p-6">
        <CastEditor showId={id} cast={castMembers} />
      </AdminPanel>

      <SeasonTabs
        seasons={seasons}
        episodesBySeason={episodesBySeason}
        maxEpisodeNumberBySeason={maxEpisodeNumberBySeason}
        showId={id}
        showDefaults={{
          title: show.title,
          title_ar: show.title_ar,
          description: show.description,
          description_ar: show.description_ar,
        }}
      />
    </div>
  )
}
