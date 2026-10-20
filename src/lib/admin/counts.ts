// Checked count recompute. Counts come from non-archived rows; every error is returned.
import type { AdminDb } from './ports'

export async function recomputeShowCounts(
  db: AdminDb,
  showId: string
): Promise<{ error: string | null }> {
  const seasons = await db
    .from('seasons')
    .select('id', { count: 'exact', head: true })
    .eq('show_id', showId)
  if (seasons.error) return { error: seasons.error.message }

  const episodes = await db
    .from('episodes')
    .select('id', { count: 'exact', head: true })
    .eq('show_id', showId)
    .eq('archived', false)
  if (episodes.error) return { error: episodes.error.message }

  const { error } = await db
    .from('shows')
    .update({
      season_count: seasons.count ?? 0,
      episode_count: episodes.count ?? 0,
    })
    .eq('id', showId)
  return { error: error ? error.message : null }
}

export async function recomputeSeasonEpisodeCount(
  db: AdminDb,
  seasonId: string
): Promise<{ error: string | null }> {
  const episodes = await db
    .from('episodes')
    .select('id', { count: 'exact', head: true })
    .eq('season_id', seasonId)
    .eq('archived', false)
  if (episodes.error) return { error: episodes.error.message }

  const { error } = await db
    .from('seasons')
    .update({ episode_count: episodes.count ?? 0 })
    .eq('id', seasonId)
  return { error: error ? error.message : null }
}
