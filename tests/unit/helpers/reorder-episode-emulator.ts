/* eslint-disable @typescript-eslint/no-explicit-any -- loose test fake */
/* Test-only mirror of public.reorder_episode(uuid, text)
   (supabase/migrations/20260724115941_restrict_public_episode_access.sql).
   Same error codes and messages, nearest non-archived neighbour, all three number
   changes applied together or not at all. Register with
   fake.registerRpc('reorder_episode', emulateReorderEpisode). */
type Row = Record<string, any>
type Tables = Record<string, Row[]>

const fail = (code: string, message: string) => ({
  data: null,
  error: { code, message },
})

export function emulateReorderEpisode(
  args: { p_episode_id?: unknown; p_direction?: unknown },
  tables: Tables
): { data: any; error: any } {
  const direction = args.p_direction
  if (direction !== 'up' && direction !== 'down')
    return fail('22023', 'Reorder direction must be up or down')

  const episodes = (tables.episodes ??= [])
  const current = episodes.find((e) => e.id === args.p_episode_id)
  if (!current) return fail('P0002', 'Episode not found')
  if (current.archived) return fail('P0001', 'Archived episodes cannot be reordered')

  const candidates = episodes
    .filter(
      (e) =>
        e.season_id === current.season_id &&
        e.archived === false &&
        (direction === 'up'
          ? e.episode_number < current.episode_number
          : e.episode_number > current.episode_number)
    )
    .sort((a, b) =>
      direction === 'up'
        ? b.episode_number - a.episode_number
        : a.episode_number - b.episode_number
    )
  const adjacent = candidates[0]
  if (!adjacent) return fail('P0001', 'No adjacent active episode to swap with')

  // Applied together (the SQL function runs in one transaction).
  const currentNumber = current.episode_number
  const adjacentNumber = adjacent.episode_number
  current.episode_number = adjacentNumber
  adjacent.episode_number = currentNumber

  return {
    data: [
      {
        show_id: current.show_id,
        season_id: current.season_id,
        episode_id: current.id,
        episode_number: adjacentNumber,
      },
    ],
    error: null,
  }
}
