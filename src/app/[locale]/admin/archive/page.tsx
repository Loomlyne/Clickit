import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { AlertTriangle } from 'lucide-react'
import { ArchiveTable } from '@/components/admin/archive-table'
import {
  ArchiveEpisodesTable,
  type ArchivedEpisode,
} from '@/components/admin/archive-episodes-table'
import { AdminPanel } from '@/components/admin/admin-shell'

export default async function ArchivePage() {
  const supabase = await createClient()
  const t = await getTranslations('admin.archive')

  const [showsResult, episodesResult] = await Promise.all([
    supabase
      .from('shows')
      .select('*')
      .eq('archived', true)
      .order('updated_at', { ascending: false }),
    // Episodes archived on their own — their show is still active. Episodes of
    // an archived show are intentionally excluded (the show row already covers
    // them and restoring the show brings them all back).
    supabase
      .from('episodes')
      .select(
        'id, title, episode_number, updated_at, archived, show_id, shows!inner(title, archived), seasons(season_number)'
      )
      .eq('archived', true)
      .eq('shows.archived', false)
      .order('updated_at', { ascending: false }),
  ])

  const shows = showsResult.data
  const archivedEpisodes: ArchivedEpisode[] = (episodesResult.data ?? []).map(
    (row) => {
      const show = (Array.isArray(row.shows) ? row.shows[0] : row.shows) as {
        title: string
      } | null
      const season = (
        Array.isArray(row.seasons) ? row.seasons[0] : row.seasons
      ) as { season_number: number } | null
      return {
        id: row.id,
        title: row.title,
        episodeNumber: row.episode_number,
        seasonNumber: season?.season_number ?? null,
        showTitle: show?.title ?? '—',
        showId: row.show_id,
        updatedAt: row.updated_at,
        archived: row.archived === true,
      }
    }
  )

  const noArchivedShows = (shows ?? []).length === 0

  return (
    <div className="space-y-6">
      <AdminPanel className="p-6 md:p-8">
        <p className="text-muted-foreground text-xs tracking-[0.24em] uppercase">
          {t('adminConsole')}
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-foreground text-3xl font-semibold tracking-tight">
              {t('heading')}
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm md:text-base">
              {t('description')}
            </p>
          </div>

          <div className="flex max-w-md items-start gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/8 px-4 py-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-yellow-400" />
            <div className="text-sm">
              <p className="font-medium text-yellow-100">
                {t('hiddenWarningTitle')}
              </p>
              <p className="mt-1 text-yellow-100/65">{t('warning')}</p>
            </div>
          </div>
        </div>
      </AdminPanel>

      {/* Render the shows table (with its own empty state) only when there are
          archived shows, or when there is nothing archived at all — otherwise
          its "Archive empty" message would contradict the episodes below. */}
      {(!noArchivedShows || archivedEpisodes.length === 0) && (
        <ArchiveTable shows={shows ?? []} />
      )}

      <ArchiveEpisodesTable episodes={archivedEpisodes} />
    </div>
  )
}
