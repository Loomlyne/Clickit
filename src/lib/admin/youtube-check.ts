// Daily YouTube re-check (D-17, RESEARCH Pattern 11). One paged read of every
// stored episode video id (archived included: stored data is stored data) and
// of every short, one getVideos call for all their ids (the client chunks at
// 50 ids, so episodes and shorts share batches), then one write through
// public.record_youtube_checks and one through public.record_short_checks.
//
// Text (CHANGED by Koss 2026-10-20, PR #27 review item 7: refresh unless
// edited): each episode row also carries YouTube's text routed by script with
// the import's own routing (episodeTextFromYouTube -> routeYouTubeText), and
// each short its title, channel and thumbnail as the shorts form fills them.
// Which fields are actually written is decided in SQL from the *_edited flags,
// so an admin edit that lands mid-run is kept. The core never writes a table
// directly. A video missing from the response sends no text (episodes) or no
// row (shorts). Nothing is unpublished. A YouTube failure writes nothing.
// Framework-free and alias-free so node --test loads it directly. The caller
// logs `detail`; it holds a database message, never the API key.
import { parseIsoDuration } from '../../server/youtube/duration.ts'
import { classifyVideo, type YouTubeStatus } from '../../server/youtube/status.ts'
import { YouTubeApiError } from '../../server/youtube/client.ts'
import type { YouTubeClientLike } from '../../server/youtube/client'
import type { AdminDb } from './ports'
import { readAllPages } from './read-all-pages.ts'
import { episodeTextFromYouTube, shortTextFromYouTube } from './youtube-text-edits.ts'
import { videoMeta } from './youtube-verify.ts'

export type RecheckReason =
  | 'quota'
  | 'key_rejected'
  | 'api_not_allowed'
  | 'network'
  | 'read_failed'
  | 'write_failed'

export type RecheckResult =
  | { ok: true; checked: number; notOk: number; shortsChecked: number; checkedAt: string }
  | { ok: false; reason: RecheckReason; detail?: string }

/** One episode for record_youtube_checks; text is null when YouTube gave none. */
export type RecheckRow = {
  id: string
  status: YouTubeStatus
  duration_seconds: number | null
  title: string | null
  title_ar: string | null
  description: string | null
  description_ar: string | null
}

/** One short for record_short_checks (only shorts whose video YouTube returned). */
export type ShortCheckRow = {
  id: string
  title: string | null
  channel_name: string | null
  thumbnail_url: string | null
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

type StoredVideo = { id: string; youtube_video_id: string | null }

const PASS_THROUGH = new Set<RecheckReason>(['quota', 'key_rejected', 'api_not_allowed', 'network'])

function youtubeReason(err: unknown): RecheckReason {
  if (err instanceof YouTubeApiError && PASS_THROUGH.has(err.code as RecheckReason)) {
    return err.code as RecheckReason
  }
  return 'network'
}

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Unknown failure')

const NO_TEXT = { title: null, title_ar: null, description: null, description_ar: null } as const

const withVideo = (rows: StoredVideo[]) =>
  rows.filter(
    (e): e is { id: string; youtube_video_id: string } =>
      typeof e.youtube_video_id === 'string' && e.youtube_video_id.trim() !== ''
  )

/** Pages of 1000 in id order: one plain select stops at the PostgREST cap. */
function readStored(db: AdminDb, table: 'episodes' | 'shorts') {
  return readAllPages<StoredVideo>((from, to) =>
    db
      .from(table)
      .select('id, youtube_video_id')
      .not('youtube_video_id', 'is', null)
      .order('id')
      .range(from, to)
  )
}

/** One RPC write: the row count it reports, or the failure to return. */
async function write(
  client: CheckRpcClient,
  name: 'record_youtube_checks' | 'record_short_checks',
  rows: unknown[]
): Promise<{ count: number } | { fail: RecheckResult }> {
  try {
    const { data, error } = await client.rpc(name, { p_rows: rows })
    if (error) {
      return { fail: { ok: false, reason: 'write_failed', detail: error.message ?? 'Write failed.' } }
    }
    return { count: typeof data === 'number' ? data : rows.length }
  } catch (e) {
    return { fail: { ok: false, reason: 'write_failed', detail: errText(e) } }
  }
}

export async function recheckVideosCore(
  db: AdminDb,
  youtube: YouTubeClientLike,
  // Run time for the caller's report; the database stamps its own now().
  now: Date
): Promise<RecheckResult> {
  let storedEpisodes: StoredVideo[]
  let storedShorts: StoredVideo[]
  try {
    const eps = await readStored(db, 'episodes')
    if (eps.error) return { ok: false, reason: 'read_failed', detail: eps.error.message }
    const shorts = await readStored(db, 'shorts')
    if (shorts.error) return { ok: false, reason: 'read_failed', detail: shorts.error.message }
    storedEpisodes = eps.data
    storedShorts = shorts.data
  } catch (e) {
    return { ok: false, reason: 'read_failed', detail: errText(e) }
  }

  const episodes = withVideo(storedEpisodes)
  const shorts = withVideo(storedShorts)
  const checkedAt = now.toISOString()
  if (episodes.length === 0 && shorts.length === 0) {
    return { ok: true, checked: 0, notOk: 0, shortsChecked: 0, checkedAt }
  }

  const ids = [...new Set([...episodes, ...shorts].map((e) => e.youtube_video_id))]
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
      // Same routing as the import (D-04); SQL skips edited fields.
      ...(item ? episodeTextFromYouTube(videoMeta(e.youtube_video_id, item)) : NO_TEXT),
    }
  })

  const shortRows: ShortCheckRow[] = []
  for (const s of shorts) {
    const item = videos.get(s.youtube_video_id)
    // Missing from the response: no row, so nothing about the short changes.
    if (!item) continue
    shortRows.push({ id: s.id, ...shortTextFromYouTube(videoMeta(s.youtube_video_id, item)) })
  }

  // A narrow rpc type: the rows are typed here, not as the generated Json.
  const client = db as unknown as CheckRpcClient
  let checked = 0
  if (rows.length > 0) {
    const w = await write(client, 'record_youtube_checks', rows)
    if ('fail' in w) return w.fail
    checked = w.count
  }
  let shortsChecked = 0
  if (shortRows.length > 0) {
    const w = await write(client, 'record_short_checks', shortRows)
    if ('fail' in w) return w.fail
    shortsChecked = w.count
  }
  return {
    ok: true,
    checked,
    notOk: rows.filter((r) => r.status !== 'ok').length,
    shortsChecked,
    checkedAt,
  }
}
