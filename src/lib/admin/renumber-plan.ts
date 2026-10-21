// What "Renumber 1 to N" will do to a season's active episodes (D-14). Pure and
// client-safe: it only shows the admin the change; the database function
// renumber_season does the real work (and puts archived episodes after N, G3).

export type RenumberEpisode = {
  id: string
  title: string
  episode_number: number
}

export type RenumberChange = {
  id: string
  title: string
  from: number
  to: number
}

export type RenumberPlan = {
  /** Active episodes in their current order. */
  count: number
  /** True when the active numbers are not exactly 1..N. */
  needed: boolean
  /** Only the episodes whose number changes, in order. */
  changes: RenumberChange[]
  /** Current numbers, ascending, for the gap hint. */
  numbers: number[]
}

export function planRenumber(episodes: readonly RenumberEpisode[]): RenumberPlan {
  const sorted = [...episodes].sort((a, b) => a.episode_number - b.episode_number)
  const changes: RenumberChange[] = []
  sorted.forEach((episode, index) => {
    const to = index + 1
    if (episode.episode_number !== to) {
      changes.push({ id: episode.id, title: episode.title, from: episode.episode_number, to })
    }
  })
  return {
    count: sorted.length,
    needed: changes.length > 0,
    changes,
    numbers: sorted.map((e) => e.episode_number),
  }
}
