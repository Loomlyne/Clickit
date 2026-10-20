// TODO(phase-2): register '30 1 * * *' -> /api/cron/youtube-recheck in CRON_ROUTES (src/server/cron-schedule.ts) and wrangler.jsonc triggers.crons
import { NextResponse } from 'next/server'

import { recheckVideosCore, type RecheckReason } from '@/lib/admin/youtube-check'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerYouTubeClient } from '@/server/youtube-service'

/**
 * Daily YouTube re-check (D-17).
 *
 * Refreshes youtube_status, youtube_checked_at and the length of every stored
 * episode video (archived included) with one read, batched videos.list calls
 * and one record_youtube_checks write. Never changes text columns and never
 * unpublishes; admins see "Can't play" from the stored status.
 *
 * Schedule: none yet. Until Phase 2 registers the trigger (TODO at the top) the
 * check runs by hand:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     localhost:3000/api/cron/youtube-recheck
 *
 * YouTube failures (quota, key, network) answer 200 with the reason so a
 * scheduler does not retry and burn more quota. Database failures answer 500.
 * Logs carry reason codes and database messages only, never the key.
 */
const YOUTUBE_REASONS = new Set<RecheckReason>(['quota', 'key_rejected', 'api_not_allowed', 'network'])

export async function GET(req: Request) {
  // --- Auth guard ----------------------------------------------------------
  // TODO(phase-2): swap the inline Bearer check for cronAuthOk(header, secret) from src/server/cron-auth.ts (constant time)
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET?.trim()
  const expected = `Bearer ${cronSecret}`
  if (!cronSecret || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const youtube = await getServerYouTubeClient()
    if ('missing' in youtube) {
      console.error('[cron/youtube-recheck] stopped: YouTube access is not set up in Settings')
      return NextResponse.json({ ok: false, reason: 'key_missing' }, { status: 503 })
    }

    const result = await recheckVideosCore(createAdminClient(), youtube.client, new Date())
    if (!result.ok) {
      if (result.detail) {
        console.error('[cron/youtube-recheck] database step failed', result.reason, result.detail)
      } else {
        console.error('[cron/youtube-recheck] YouTube step failed', result.reason)
      }
      return NextResponse.json(
        { ok: false, reason: result.reason },
        { status: YOUTUBE_REASONS.has(result.reason) ? 200 : 500 }
      )
    }

    return NextResponse.json(result)
  } catch (err) {
    // Only the error name: a message could quote a request.
    console.error('[cron/youtube-recheck] unhandled failure', err instanceof Error ? err.name : 'unknown')
    return NextResponse.json({ ok: false, reason: 'unhandled' }, { status: 500 })
  }
}
