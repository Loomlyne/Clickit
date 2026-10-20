/* eslint-disable @typescript-eslint/no-explicit-any -- loose test fake */
/* Test-only mirror of public.record_youtube_checks(p_rows jsonb)
   (supabase/migrations/20261020150526_youtube_episode_status_and_order.sql,
   section 5). Same rules, row by row:
   - p_rows must be a JSON array (22023), at most 5000 entries (22023);
   - youtube_status = status (column check: one of the six statuses, 23514);
   - youtube_checked_at = now();
   - youtube_duration_seconds = coalesce(nullif(duration_seconds, 0), stored);
   - duration (minutes) follows the new seconds only when the new seconds are
     > 0, stored seconds are not null and the stored duration still equals
     greatest(1, round(stored seconds / 60)); otherwise it is kept (admin edit);
   - player_error_code / player_error_at are cleared only when status is 'ok';
   - text (refresh unless edited, PR #27 review item 7), per field of title,
     title_ar, description, description_ar: kept when <f>_edited is true;
     on the first check (stored youtube_checked_at null) kept, and the flag
     turns true when the stored text differs from the row's (both trimmed,
     empty = none); otherwise the row's trimmed text, and empty or missing
     text keeps the stored value. Flags are never set false;
   - ids with no matching episode are ignored;
   - returns the number of updated rows. All rows apply together.
   The real SQL runs only on the controller's local Supabase stack.
   Register with fake.registerRpc('record_youtube_checks', emulateRecordYouTubeChecks). */
type Row = Record<string, any>
type Tables = Record<string, Row[]>

const STATUSES = ['ok', 'private', 'removed', 'not_embeddable', 'blocked_ae', 'not_ready']

const fail = (code: string, message: string) => ({ data: null, error: { code, message } })

const TEXT_FIELDS = ['title', 'title_ar', 'description', 'description_ar']

/** nullif(btrim(v), ''): trimmed text, or null. */
export const trimmedOrNull = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null

/**
 * The SQL text rule for one field, applied to `target` from the pre-update
 * row `old` (SET reads the old row): kept when edited or on the first check,
 * else the new trimmed text unless it is empty.
 */
export function applyRefreshUnlessEdited(
  target: Row,
  old: Row,
  incoming: Row,
  field: string,
  firstCheck: boolean
): void {
  const flag = `${field}_edited`
  const edited = old[flag] === true
  const next = trimmedOrNull(incoming[field])
  if (!edited && !firstCheck && next !== null) target[field] = next
  target[flag] = edited || (firstCheck && trimmedOrNull(old[field]) !== next)
}

// Postgres round() on numeric rounds half away from zero; inputs here are >= 0.
const minutesOf = (seconds: number) => Math.max(1, Math.round(seconds / 60))

export function emulateRecordYouTubeChecks(
  args: { p_rows?: unknown },
  tables: Tables
): { data: any; error: any } {
  const rows = args.p_rows
  if (!Array.isArray(rows)) return fail('22023', 'YouTube checks must be a JSON array')
  if (rows.length > 5000) return fail('22023', 'Too many YouTube checks in one call')

  const episodes = (tables.episodes ??= [])
  const byId = new Map(episodes.map((e) => [e.id, e]))
  const nowIso = new Date().toISOString()

  // Validate first so a bad row changes nothing (one statement in SQL).
  for (const r of rows) {
    if (!STATUSES.includes(r?.status)) {
      return fail(
        '23514',
        'new row for relation "episodes" violates check constraint "episodes_youtube_status_check"'
      )
    }
  }

  let count = 0
  for (const r of rows) {
    const e = byId.get(r.id)
    if (!e) continue
    const secs: number | null = typeof r.duration_seconds === 'number' ? r.duration_seconds : null
    const stored: number | null = e.youtube_duration_seconds ?? null

    const nextDuration =
      secs !== null && secs > 0 && stored !== null && e.duration === minutesOf(stored)
        ? minutesOf(secs)
        : e.duration

    const old = { ...e }
    const firstCheck = old.youtube_checked_at == null
    for (const f of TEXT_FIELDS) applyRefreshUnlessEdited(e, old, r, f, firstCheck)

    e.youtube_status = r.status
    e.youtube_checked_at = nowIso
    e.youtube_duration_seconds = secs !== null && secs !== 0 ? secs : stored
    e.duration = nextDuration
    if (r.status === 'ok') {
      e.player_error_code = null
      e.player_error_at = null
    }
    count += 1
  }
  return { data: count, error: null }
}
