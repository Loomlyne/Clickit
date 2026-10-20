// Viewer player-error report core (06-09, D-17, RESEARCH Pattern 10). Pure: the
// caller passes the service-role client and the signed-in user id. It never
// calls YouTube: a viewer report is advisory and only raises the admin flag
// (episodes.player_error_code / player_error_at), it unpublishes nothing.
//
// Guards, in order: signed-in, uuid episode id, allow-listed code, published
// episode, one report per user per episode per hour on the shared rate_limits
// ledger (fail closed), then one update of two fixed columns on that episode.

import type { AdminDb } from '../lib/admin/ports'
import { REPORTABLE_PLAYER_ERRORS } from '../lib/watch/player-errors.ts'
import * as rateLimit from './youtube/rate-limit.ts'

export const PLAYER_REPORT_WINDOW_MS = 60 * 60 * 1000

export type PlayerErrorReportResult =
  | { ok: true }
  | {
      ok: false
      reason: 'unauthenticated' | 'invalid' | 'not_found' | 'limited' | 'failed'
    }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function reportPlayerErrorCore(input: {
  db: AdminDb
  userId: string | null | undefined
  episodeIdRaw: unknown
  codeRaw: unknown
  now?: Date
}): Promise<PlayerErrorReportResult> {
  const { db, userId, episodeIdRaw, codeRaw, now = new Date() } = input

  if (!userId) return { ok: false, reason: 'unauthenticated' }

  if (typeof episodeIdRaw !== 'string' || !UUID_RE.test(episodeIdRaw)) {
    return { ok: false, reason: 'invalid' }
  }
  const episodeId = episodeIdRaw

  const code = codeRaw
  if (
    typeof code !== 'number' ||
    !(REPORTABLE_PLAYER_ERRORS as readonly number[]).includes(code)
  ) {
    return { ok: false, reason: 'invalid' }
  }

  const { data: episode, error: readError } = await db
    .from('episodes')
    .select('id, status')
    .eq('id', episodeId)
    .maybeSingle()
  if (readError || !episode || episode.status !== 'published') {
    return { ok: false, reason: 'not_found' }
  }

  const allowed = await rateLimit.withinRateLimitCore(db, {
    key: 'player-error:' + episodeId + ':' + userId,
    max: 1,
    windowSec: PLAYER_REPORT_WINDOW_MS / 1000,
    now,
    failOpen: false,
  })
  if (!allowed) return { ok: false, reason: 'limited' }

  const { error } = await db
    .from('episodes')
    .update({ player_error_code: code, player_error_at: now.toISOString() })
    .eq('id', episodeId)
  if (error) return { ok: false, reason: 'failed' }

  return { ok: true }
}
