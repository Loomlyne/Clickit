import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { AlertTriangle } from 'lucide-react'
import { ArchiveTable } from '@/components/admin/archive-table'
import {
  ArchiveEpisodesTable,
  type ArchivedEpisode,
} from '@/components/admin/archive-episodes-table'
import { AdminPageHeader } from '@/components/admin/admin-shell'

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
    <div className="space-y-5">
      <AdminPageHeader title={t('heading')} description={t('description')} />

      <div className="border-brand-orange-safe/25 bg-brand-orange-safe/8 flex items-start gap-3 rounded-card border px-4 py-3">
        <AlertTriangle className="text-brand-orange-safe mt-0.5 size-5 shrink-0" />
        <div className="text-[14px]">
          <p className="text-brand-orange-safe font-medium">
            {t('hiddenWarningTitle')}
          </p>
          <p className="mt-0.5 text-[var(--text-dim)]">{t('warning')}</p>
        </div>
      </div>

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
