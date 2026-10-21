/* eslint-disable @typescript-eslint/no-explicit-any -- loose test fake */
/* Test-only mirror of public.renumber_season(uuid)
   (supabase/migrations/20261020150526_youtube_episode_status_and_order.sql).
   Same error codes and messages and the same result rules: live episodes get
   1..N in their current order, archived episodes follow at N+1..N+K, only
   changed rows are returned, all changes apply together. The real SQL (the
   two-phase update that avoids unique-index clashes) is exercised only on the
   controller's local Supabase stack, never here.
   Register with fake.registerRpc('renumber_season', emulateRenumberSeason). */
type Row = Record<string, any>
type Tables = Record<string, Row[]>

const fail = (code: string, message: string) => ({
  data: null,
  error: { code, message },
})

export function emulateRenumberSeason(
  args: { p_season_id?: unknown },
  tables: Tables
): { data: any; error: any } {
  const seasons = (tables.seasons ??= [])
  if (!seasons.some((s) => s.id === args.p_season_id))
    return fail('P0002', 'Season not found')

  const episodes = (tables.episodes ??= [])
  const inSeason = episodes.filter((e) => e.season_id === args.p_season_id)
  if (inSeason.length === 0) return fail('P0002', 'Season has no episodes')

  const byNumber = (a: Row, b: Row) => a.episode_number - b.episode_number
  const live = inSeason.filter((e) => !e.archived).sort(byNumber)
  const archived = inSeason.filter((e) => e.archived).sort(byNumber)

  // Vacuously true for a season with no live episodes, as in the SQL.
  if (live.every((e, i) => e.episode_number === i + 1))
    return fail('P0001', 'Already numbered 1 to N')

  const ordered = [...live, ...archived]
  const map = ordered
    .map((e, i) => ({
      episode_id: e.id,
      old_number: e.episode_number,
      new_number: i + 1,
    }))
    .filter((m) => m.old_number !== m.new_number)

  // Applied together (the SQL function runs in one transaction).
  ordered.forEach((e, i) => {
    e.episode_number = i + 1
  })

  return { data: map.sort((a, b) => a.new_number - b.new_number), error: null }
}
