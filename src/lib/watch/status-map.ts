// Stored YouTube status per episode, for the watch page (06-09, checker W1).
// Pure: no imports. The server read (getEpisodeYouTubeStatuses in queries.ts)
// hands raw rows here. Only `blocked_ae` gates loading in the shell; the other
// statuses only pick the more precise reason on the error card.

export type StoredNonOkStatus =
  | 'private'
  | 'removed'
  | 'not_embeddable'
  | 'blocked_ae'
  | 'not_ready'

const NON_OK: ReadonlySet<string> = new Set<StoredNonOkStatus>([
  'private',
  'removed',
  'not_embeddable',
  'blocked_ae',
  'not_ready',
])

/** Rows to `{ [episodeId]: status }`, keeping only known non-ok statuses. */
export function toYouTubeStatusMap(
  rows: Array<{ id: string; youtube_status: string | null }>
): Record<string, StoredNonOkStatus> {
  const out: Record<string, StoredNonOkStatus> = {}
  for (const row of rows) {
    const status = row.youtube_status
    if (status !== null && NON_OK.has(status)) {
      out[row.id] = status as StoredNonOkStatus
    }
  }
  return out
}
