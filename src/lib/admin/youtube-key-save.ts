// Save the YouTube Data API key into Supabase Vault (D-15, D-20, G6). Order:
// format check (no database call on a bad value), rate limit 10 per admin per
// hour (fail closed), one set_youtube_key rpc, one audit row holding the last 4
// characters only. The raw value never goes into a result, an error or a log.
// Framework-free and alias-free so node --test loads it directly.
import { z } from 'zod'

import { YOUTUBE_KEY_FORMAT } from '../../server/youtube/key.ts'
import { withinRateLimitCore } from '../../server/youtube/rate-limit.ts'
import type { AdminDb, AuditWriter } from './ports'

export const youtubeKeySchema = z.string().trim().regex(YOUTUBE_KEY_FORMAT)

export type SaveKeyCode = 'format_invalid' | 'limited' | 'save_failed'

export type SaveKeyResult =
  | {
      success: true
      wrote: true
      data: { hasKey: true; last4: string }
      auditError?: string
    }
  | { success: false; wrote: false; code: SaveKeyCode; error: string }

const SAVE_LIMIT = 10
const SAVE_WINDOW_SEC = 3600

// Fixed messages: none of them can quote the value or a database error.
const MESSAGES: Record<SaveKeyCode, string> = {
  format_invalid: 'This does not look like a YouTube API key.',
  limited: 'Too many key changes. Wait a while and try again.',
  save_failed: 'The key was not saved.',
}

const refuse = (code: SaveKeyCode): SaveKeyResult => ({
  success: false,
  wrote: false,
  code,
  error: MESSAGES[code],
})

export async function saveYouTubeApiKeyCore(
  db: AdminDb,
  deps: { audit: AuditWriter; adminUserId: string; now: Date },
  raw: unknown
): Promise<SaveKeyResult> {
  const parsed = youtubeKeySchema.safeParse(raw)
  if (!parsed.success) return refuse('format_invalid')
  const key = parsed.data

  const allowed = await withinRateLimitCore(db, {
    key: `youtube-key-save:${deps.adminUserId}`,
    max: SAVE_LIMIT,
    windowSec: SAVE_WINDOW_SEC,
    now: deps.now,
    failOpen: false,
  })
  if (!allowed) return refuse('limited')

  let last4: string
  try {
    const { data, error } = await db.rpc('set_youtube_key', { p_key: key })
    if (error) return refuse('save_failed')
    last4 = typeof data === 'string' && data.length === 4 ? data : key.slice(-4)
  } catch {
    // A thrown client error could carry the request; drop it.
    return refuse('save_failed')
  }

  const audited = await deps.audit({
    adminUserId: deps.adminUserId,
    action: 'config_update',
    entity: 'app_config',
    entityId: '1',
    diff: { kind: 'youtube_key_changed', last4 },
  })

  const result: SaveKeyResult = {
    success: true,
    wrote: true,
    data: { hasKey: true, last4 },
  }
  // The key is saved; the missing audit row is reported, never swallowed.
  if (audited.error) result.auditError = 'The audit row for the key change was not written.'
  return result
}
