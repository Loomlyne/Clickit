// Test key and the last-test line in Admin › Settings (G6, UI-SPEC §6).
// testYouTubeKeyCore makes one videos.list call (1 quota unit) for a probe id
// and stores ok/reason as an audit row; readLastKeyTestCore reads that row
// back, and a newer key change resets it to "not tested". Framework-free and
// alias-free so node --test loads it directly.
import { YouTubeApiError, type YouTubeClientLike } from '../../server/youtube/client.ts'
import type { AdminDb, AuditWriter } from './ports'

export type KeyTestReason = 'missing' | 'rejected' | 'apiNotAllowed' | 'quota' | 'network'

export type KeyTestResult = { ok: true } | { ok: false; reason: KeyTestReason }

export type LastKeyTest = { at: string; ok: boolean; reason: string | null }

// "Me at the zoo": a stable, well-formed id used when no live episode exists.
// videos.list costs 1 unit whether or not the id is found.
const FALLBACK_PROBE_ID = 'jNQXAC9IVRw'
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

const KEY_TEST = 'youtube_key_test'
const KEY_CHANGED = 'youtube_key_changed'

async function probeId(db: AdminDb): Promise<string> {
  try {
    const { data, error } = await db
      .from('episodes')
      .select('youtube_video_id')
      .eq('archived', false)
      .not('youtube_video_id', 'is', null)
      .neq('youtube_video_id', '')
      .order('created_at', { ascending: true })
      .limit(1)
    const id = !error && Array.isArray(data) ? data[0]?.youtube_video_id : null
    return typeof id === 'string' && VIDEO_ID.test(id.trim()) ? id.trim() : FALLBACK_PROBE_ID
  } catch {
    return FALLBACK_PROBE_ID
  }
}

function reasonFor(e: unknown): Exclude<KeyTestReason, 'missing'> {
  if (e instanceof YouTubeApiError) {
    if (e.code === 'key_rejected') return 'rejected'
    if (e.code === 'api_not_allowed') return 'apiNotAllowed'
    if (e.code === 'quota') return 'quota'
  }
  return 'network'
}

/**
 * One 1-unit YouTube call with the stored key. A null client (no key saved)
 * answers `missing` without calling YouTube or writing an audit row.
 */
export async function testYouTubeKeyCore(
  db: AdminDb,
  deps: { audit: AuditWriter; adminUserId: string },
  client: YouTubeClientLike | null
): Promise<KeyTestResult & { auditError?: string }> {
  if (!client) return { ok: false, reason: 'missing' }

  const id = await probeId(db)
  let result: KeyTestResult
  try {
    await client.getVideos([id])
    result = { ok: true }
  } catch (e) {
    result = { ok: false, reason: reasonFor(e) }
  }

  const audited = await deps.audit({
    adminUserId: deps.adminUserId,
    action: 'config_update',
    entity: 'app_config',
    entityId: '1',
    diff: result.ok
      ? { kind: KEY_TEST, ok: true }
      : { kind: KEY_TEST, ok: false, reason: result.reason },
  })
  if (audited.error) {
    return { ...result, auditError: 'The audit row for the key test was not written.' }
  }
  return result
}

/**
 * The newest key test, or null when there is none, when a key change is
 * newer (UI-SPEC §6: saving a new key resets the line), or on a read error.
 */
export async function readLastKeyTestCore(db: AdminDb): Promise<LastKeyTest | null> {
  try {
    const { data, error } = await db
      .from('admin_audit_log')
      .select('created_at, diff')
      .eq('entity_type', 'app_config')
      .eq('action_type', 'config_update')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error || !Array.isArray(data)) return null
    for (const row of data) {
      const diff = row.diff
      if (!diff || typeof diff !== 'object' || Array.isArray(diff)) continue
      const d = diff as Record<string, unknown>
      if (d.kind === KEY_CHANGED) return null
      if (d.kind !== KEY_TEST) continue
      const ok = d.ok === true
      return {
        at: String(row.created_at),
        ok,
        reason: !ok && typeof d.reason === 'string' ? d.reason : null,
      }
    }
    return null
  } catch {
    return null
  }
}
