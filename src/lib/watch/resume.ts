// Resume and save rules for the watch page (YT-05, D-10). Pure: no imports, so
// the shell (06-14) only feeds events and the rules are tested without a
// browser. Fixes the A -> B -> A bug: the shell keeps a PositionsMap that is
// updated on every switch instead of reading the page-load snapshot.

export type PositionEntry = { seconds: number; duration: number; completed: boolean }
export type PositionsMap = Record<string, PositionEntry>

/** Same 95% rule as the progress tracker (D-10). */
const COMPLETED_RATIO = 0.95
/** Below this many seconds an episode starts from 0:00. */
const MIN_RESUME_SECONDS = 5
/** Within this many seconds of the end an episode starts from 0:00. */
const NEAR_END_SECONDS = 5

/**
 * Where to start an episode. Completed, under 5 seconds, or within 5 seconds of
 * the end all start at 0:00; otherwise the saved second, floored.
 */
export function resumeSecondsFor(entry?: PositionEntry): number {
  if (!entry || entry.completed) return 0
  const { seconds, duration } = entry
  if (!Number.isFinite(seconds) || seconds < MIN_RESUME_SECONDS) return 0
  if (Number.isFinite(duration) && duration > 0 && seconds >= duration - NEAR_END_SECONDS) {
    return 0
  }
  return Math.floor(seconds)
}

/**
 * The save guards of use-progress-tracker, as one decision.
 * `videoMatches: false` always refuses: after a switch the player can still
 * report the old video's clock, and that must never land on the new episode.
 */
export function shouldSaveProgress(input: {
  currentTime: number
  duration: number
  lastSaved: number
  force?: boolean
  videoMatches: boolean
}): boolean {
  const { currentTime, duration, lastSaved, force, videoMatches } = input
  if (!videoMatches) return false
  if (!Number.isFinite(currentTime) || currentTime < 0) return false
  if (!Number.isFinite(duration) || duration <= 0) return false
  // Skip saves below 2 seconds so a post-seek 0 cannot overwrite a position.
  if (currentTime < 2 && lastSaved > 2) return false
  if (!force && Math.abs(currentTime - lastSaved) < 10) return false
  return true
}

/**
 * True when the player's clock belongs to the episode we expect: it reported the
 * expected id, or it reported no id and has been PLAYING since the switch.
 * A different reported id is always false.
 */
export function videoMatchesFor(input: {
  reportedVideoId: string | null | undefined
  expectedVideoId: string
  playingSinceSwitch: boolean
}): boolean {
  const { reportedVideoId, expectedVideoId, playingSinceSwitch } = input
  if (reportedVideoId) return reportedVideoId === expectedVideoId
  return playingSinceSwitch
}

/** Server rows (getEpisodesProgress shape) to the in-session map. */
export function seedPositions(
  serverMap: Record<
    string,
    { progressSeconds: number; durationSeconds: number; completed: boolean }
  >
): PositionsMap {
  const out: PositionsMap = {}
  for (const [episodeId, row] of Object.entries(serverMap)) {
    out[episodeId] = {
      seconds: row.progressSeconds,
      duration: row.durationSeconds,
      completed: row.completed,
    }
  }
  return out
}

export type PositionEvent =
  | { type: 'leave'; episodeId: string; seconds: number; duration: number }
  | { type: 'ended'; episodeId: string }
  | { type: 'restart'; episodeId: string }
  | { type: 'seed'; positions: PositionsMap }

/**
 * Immutable reducer for the positions map.
 * - leave: the outgoing episode's clock; unusable values (NaN, no duration, a
 *   post-seek zero over a real position) return the same map, like the tracker
 *   that would refuse the save.
 * - ended: completed, back at 0:00.
 * - restart: back at 0:00, not completed.
 * - seed: fills only episodes the session has not touched, so a re-seed from the
 *   server never rolls back what the viewer did in this session.
 */
export function nextPositions(map: PositionsMap, event: PositionEvent): PositionsMap {
  switch (event.type) {
    case 'leave': {
      const { episodeId, seconds, duration } = event
      if (!Number.isFinite(seconds) || seconds < 0) return map
      if (!Number.isFinite(duration) || duration <= 0) return map
      const prev = map[episodeId]
      if (seconds < 2 && prev && prev.seconds > 2) return map
      const whole = Math.floor(seconds)
      return {
        ...map,
        [episodeId]: {
          seconds: whole,
          duration: Math.floor(duration),
          completed: whole / Math.floor(duration) >= COMPLETED_RATIO,
        },
      }
    }
    case 'ended': {
      const prev = map[event.episodeId]
      return {
        ...map,
        [event.episodeId]: { seconds: 0, duration: prev?.duration ?? 0, completed: true },
      }
    }
    case 'restart': {
      const prev = map[event.episodeId]
      return {
        ...map,
        [event.episodeId]: { seconds: 0, duration: prev?.duration ?? 0, completed: false },
      }
    }
    case 'seed':
      return { ...event.positions, ...map }
  }
}

/** Percent for the list's progress bar: 100 when completed, else capped. */
export function progressPercent(entry?: PositionEntry): number {
  if (!entry) return 0
  if (entry.completed) return 100
  if (!Number.isFinite(entry.duration) || entry.duration <= 0) return 0
  if (!Number.isFinite(entry.seconds) || entry.seconds <= 0) return 0
  return Math.min(100, Math.round((entry.seconds / entry.duration) * 100))
}
