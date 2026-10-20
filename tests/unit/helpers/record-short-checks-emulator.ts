/* eslint-disable @typescript-eslint/no-explicit-any -- loose test fake */
/* Test-only mirror of public.record_short_checks(p_rows jsonb)
   (supabase/migrations/20261020150526_youtube_episode_status_and_order.sql,
   section 5b, PR #27 review item 7). Same rules, row by row:
   - p_rows must be a JSON array (22023), at most 5000 entries (22023);
   - youtube_checked_at = now();
   - title and channel_name: refresh unless edited, with the first-check
     baseline (stored youtube_checked_at null), exactly as for episodes
     (applyRefreshUnlessEdited in record-youtube-checks-emulator.ts);
   - thumbnail_url: the row's value when it starts with https://, else kept;
   - ids with no matching short are ignored;
   - returns the number of updated rows.
   Register with fake.registerRpc('record_short_checks', emulateRecordShortChecks). */
import { applyRefreshUnlessEdited } from './record-youtube-checks-emulator.ts'

type Row = Record<string, any>
type Tables = Record<string, Row[]>

const fail = (code: string, message: string) => ({ data: null, error: { code, message } })

export function emulateRecordShortChecks(
  args: { p_rows?: unknown },
  tables: Tables
): { data: any; error: any } {
  const rows = args.p_rows
  if (!Array.isArray(rows)) return fail('22023', 'Short checks must be a JSON array')
  if (rows.length > 5000) return fail('22023', 'Too many short checks in one call')

  const shorts = (tables.shorts ??= [])
  const byId = new Map(shorts.map((s) => [s.id, s]))
  const nowIso = new Date().toISOString()

  let count = 0
  for (const r of rows) {
    const s = byId.get(r.id)
    if (!s) continue
    const old = { ...s }
    const firstCheck = old.youtube_checked_at == null
    for (const f of ['title', 'channel_name']) applyRefreshUnlessEdited(s, old, r, f, firstCheck)
    if (typeof r.thumbnail_url === 'string' && r.thumbnail_url.startsWith('https://')) {
      s.thumbnail_url = r.thumbnail_url
    }
    s.youtube_checked_at = nowIso
    count += 1
  }
  return { data: count, error: null }
}
