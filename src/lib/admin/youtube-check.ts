// Daily YouTube re-check (D-17, RESEARCH Pattern 11). One read of every stored
// episode video id (archived included: stored data is stored data), one
// getVideos call (the client chunks at 50 ids), then ONE database write through
// public.record_youtube_checks. Only status, checked-at and length are sent;
// text columns are never written (D-05). A YouTube failure writes nothing.
// Framework-free and alias-free so node --test loads it directly. The caller
// logs `detail`; it holds a database message, never the API key.
import { parseIsoDuration } from '../../server/youtube/duration.ts'
import { classifyVideo, type YouTubeStatus } from '../../server/youtube/status.ts'
import { YouTubeApiError } from '../../server/youtube/client.ts'
import type { YouTubeClientLike } from '../../server/youtube/client'
import type { AdminDb } from './ports'

export type RecheckReason =
  | 'quota'
  | 'key_rejected'
  | 'api_not_allowed'
  | 'network'
  | 'read_failed'
  | 'write_failed'

export type RecheckResult =
  | { ok: true; checked: number; notOk: number; checkedAt: string }
  | { ok: false; reason: RecheckReason; detail?: string }

export type RecheckRow = {
  id: string
  status: YouTubeStatus
  duration_seconds: number | null
}

type CheckRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>
  ) => PromiseLike<{
    data: unknown
    error: { code?: string; message?: string } | null
  }>
}

const PASS_THROUGH = new Set<RecheckReason>(['quota', 'key_rejected', 'api_not_allowed', 'network'])

function youtubeReason(err: unknown): RecheckReason {
  if (err instanceof YouTubeApiError && PASS_THROUGH.has(err.code as RecheckReason)) {
    return err.code as RecheckReason
  }
  return 'network'
}

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Unknown failure')

export async function recheckVideosCore(
  db: AdminDb,
  youtube: YouTubeClientLike,
  // Run time for the caller's report; the database stamps its own now().
  now: Date
): Promise<RecheckResult> {
  let stored: { id: string; youtube_video_id: string | null }[]
  try {
    const { data, error } = await db
      .from('episodes')
      .select('id, youtube_video_id')
      .not('youtube_video_id', 'is', null)
    if (error) return { ok: false, reason: 'read_failed', detail: error.message }
    stored = (data ?? []) as typeof stored
  } catch (e) {
    return { ok: false, reason: 'read_failed', detail: errText(e) }
  }

  const episodes = stored.filter(
    (e): e is { id: string; youtube_video_id: string } =>
      typeof e.youtube_video_id === 'string' && e.youtube_video_id.trim() !== ''
  )
  const checkedAt = now.toISOString()
  if (episodes.length === 0) return { ok: true, checked: 0, notOk: 0, checkedAt }

  const ids = [...new Set(episodes.map((e) => e.youtube_video_id))]
  let videos: Awaited<ReturnType<YouTubeClientLike['getVideos']>>
  try {
    videos = await youtube.getVideos(ids)
  } catch (e) {
    return { ok: false, reason: youtubeReason(e) }
  }

  const rows: RecheckRow[] = episodes.map((e) => {
    const item = videos.get(e.youtube_video_id)
    const iso = item?.contentDetails?.duration
    return {
      id: e.id,
      status: classifyVideo(item),
      duration_seconds: typeof iso === 'string' ? parseIsoDuration(iso) : null,
    }
  })

  // The cast is needed only while database.types.ts lags the migration.
  const client = db as unknown as CheckRpcClient
  try {
    const { data, error } = await client.rpc('record_youtube_checks', { p_rows: rows })
    if (error) {
      return { ok: false, reason: 'write_failed', detail: error.message ?? 'Write failed.' }
    }
    return {
      ok: true,
      checked: typeof data === 'number' ? data : rows.length,
      notOk: rows.filter((r) => r.status !== 'ok').length,
      checkedAt,
    }
  } catch (e) {
    return { ok: false, reason: 'write_failed', detail: errText(e) }
  }
}
