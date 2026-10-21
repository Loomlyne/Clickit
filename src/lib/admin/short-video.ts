// Server check of a short's YouTube link before createShort / updateShort
// write it (PR #27 review, finding 3). Same rules as the episode save (06-06,
// 06-13): strict parse first (no key read, no fetch on a bad link), then one
// videos.list call through verifyVideoCore with checkDuplicate: false (shorts
// are outside the episode duplicate rule), fail closed when no key is set.
// On success the bare 11-character id is what gets stored.
// Framework-free and alias-free so node --test loads it directly.
import { parseVideoIdStrict } from '../../server/youtube/urls.ts'
import type { YouTubeClientLike } from '../../server/youtube/client'
import type { YouTubeErrorCode } from '../youtube-errors.ts'
import type { AdminDb } from './ports'
import { verifyMessage, verifyVideoCore, type YouTubeMeta } from './youtube-verify.ts'

/**
 * `meta` is present only when YouTube was asked (a new or changed link); the
 * save compares the admin's fields with it for the edited flags (review item 7).
 */
export type ShortVideoCheck =
  | { ok: true; videoId: string; meta?: YouTubeMeta }
  | { ok: false; code: YouTubeErrorCode; error: string }

/**
 * `getClient` is called only when a link actually needs a YouTube check and
 * answers null when no key is saved (key_missing). `currentVideoId` is the
 * stored id on an edit: the same video in any link form is not re-checked, so
 * a title edit still saves while the key is missing or the quota is used up.
 */
export async function checkShortVideoCore(
  db: AdminDb,
  getClient: () => Promise<YouTubeClientLike | null>,
  raw: unknown,
  currentVideoId?: string | null
): Promise<ShortVideoCheck> {
  const parsed = parseVideoIdStrict(typeof raw === 'string' ? raw : '')
  if (!parsed.ok) {
    return { ok: false, code: parsed.code, error: verifyMessage({ ok: false, code: parsed.code }) }
  }
  if (currentVideoId && parsed.id === currentVideoId) return { ok: true, videoId: parsed.id }

  const client = await getClient()
  const outcome = await verifyVideoCore(db, client, parsed.id, { checkDuplicate: false })
  if (outcome.ok) return { ok: true, videoId: outcome.meta.videoId, meta: outcome.meta }
  return { ok: false, code: outcome.code, error: verifyMessage(outcome) }
}
