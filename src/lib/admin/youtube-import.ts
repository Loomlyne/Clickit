// Playlist import cores (YT-01, YT-02; RESEARCH Pattern 1). Preview reads one
// playlist page and writes nothing. Commit takes ids only, re-fetches and
// re-classifies every id from YouTube, refuses the whole import on any change,
// then inserts every episode in ONE statement as drafts, with compensation,
// checked counts and one audit row. The YouTube client is injected; no key,
// URL or response body ever reaches a result (T-06-27).
// Framework-free and alias-free so node --test loads it directly.
import {
  compensationAuditDiff,
  runWithCompensation,
  type CompensationResult,
  type WriteStep,
} from './compensation.ts'
import { recomputeSeasonEpisodeCount, recomputeShowCounts } from './counts.ts'
import { commitImportSchema, formatZodError, parseId, previewPageSchema } from './schemas.ts'
import { YouTubeApiError } from '../../server/youtube/client.ts'
import { buildImportPlan, importStatus } from '../../server/youtube/plan.ts'
import { dominantScript } from '../../server/youtube/script.ts'
import { videoReason } from '../../server/youtube/status.ts'
import { parsePlaylistId } from '../../server/youtube/urls.ts'
import { parseIsoDuration } from '../../server/youtube/duration.ts'
import type {
  YouTubeClientLike,
  YouTubePlaylist,
  YouTubeVideoResource,
} from '../../server/youtube/client'
import type { YouTubeStatus } from '../../server/youtube/status'
import type { YouTubeErrorCode } from '../youtube-errors'
import type { AdminDb, AuditWriter, CoreResult } from './ports'

/** Preview reads at most 4 pages of 50 (previewPageSchema page 0..3). */
export const IMPORT_MAX_ITEMS = 200

export type ImportDeps = {
  audit: AuditWriter
  adminUserId: string
  /** null when no key is stored: every YouTube step answers key_missing. */
  youtube: YouTubeClientLike | null
  now: Date
}

export type ExistingLocation = { showTitle: string; seasonNumber: number; episodeNumber: number }

export type PreviewRow = {
  videoId: string
  /** 1-based position in the whole playlist. */
  position: number
  title: string
  thumbnailUrl: string | null
  durationSeconds: number | null
  status: YouTubeStatus | 'already'
  privacy: 'public' | 'unlisted' | null
  arabicTitle: boolean
  premieresAt?: string
  existing?: ExistingLocation
}

export type PreviewPage = {
  /** Page 0 only; later pages reuse the first page's playlist. */
  playlist: YouTubePlaylist | null
  rows: PreviewRow[]
  /** null when there is no next page or the 200-item cap is reached. */
  nextPageToken: string | null
  page: number
  /** The playlist has more than IMPORT_MAX_ITEMS videos. */
  capped: boolean
}

/** A core result that may carry a typed YouTube code the UI translates. */
export type YouTubeCoreResult<T> = CoreResult<T> & { code?: YouTubeErrorCode }

export type ImportData = {
  showId: string
  seasonId: string
  episodeIds: string[]
  needsEnglishCount: number
}

export const IMPORT_CHANGED_MESSAGE =
  'Some videos changed on YouTube since the preview. Paste the link again.'
export const IMPORT_DUPLICATE_MESSAGE =
  'One or more of these videos is already on Clickit. Paste the link again.'
export const IMPORT_SEASON_CHANGED_MESSAGE =
  'Season changed while you were importing. Try again.'

/**
 * The unique (season_id, episode_number) constraint (create_schema, Postgres's
 * default name). Imports take no advisory lock, so a renumber or reorder that
 * lands between the max-number read and the insert collides here.
 */
const SEASON_NUMBER_CONSTRAINT = 'episodes_season_id_episode_number_key'
const VIDEO_ID_CONSTRAINT = 'episodes_youtube_video_id_key'

const PAGE_SIZE = 50
const LAST_PAGE = IMPORT_MAX_ITEMS / PAGE_SIZE - 1

const KEY_MISSING_MESSAGE = 'The YouTube key is not set.'
const NETWORK_MESSAGE = 'YouTube could not be reached or answered unexpectedly.'

type Obj = Record<string, unknown>
type StepResult = { error: string | null }

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** A YouTube failure as a typed code with a fixed message; unknown throws are network. */
export function youtubeFailure(e: unknown): { code: YouTubeErrorCode; error: string } {
  if (e instanceof YouTubeApiError) return { code: e.code, error: e.message }
  return { code: 'network', error: NETWORK_MESSAGE }
}

// ---------------------------------------------------------------------------
// Catalog-wide dedupe (archived included, T-06-23)
// ---------------------------------------------------------------------------

export type ExistingVideo = ExistingLocation & {
  episodeId: string
  showId: string
  seasonId: string
}

/**
 * Where each id already sits on Clickit, across every show and season,
 * archived rows included. Three flat reads (no embedded selects).
 */
export async function findExistingVideos(
  db: AdminDb,
  ids: string[]
): Promise<{ error: string | null; found: Map<string, ExistingVideo> }> {
  const found = new Map<string, ExistingVideo>()
  if (ids.length === 0) return { error: null, found }

  const eps = await db
    .from('episodes')
    .select('id, youtube_video_id, show_id, season_id, episode_number')
    .in('youtube_video_id', ids)
  if (eps.error) return { error: eps.error.message, found }
  const rows = (eps.data ?? []) as Array<{
    id: string
    youtube_video_id: string | null
    show_id: string
    season_id: string
    episode_number: number
  }>
  if (rows.length === 0) return { error: null, found }

  const seasonIds = [...new Set(rows.map((r) => r.season_id))]
  const showIds = [...new Set(rows.map((r) => r.show_id))]
  const seasons = await db.from('seasons').select('id, season_number').in('id', seasonIds)
  if (seasons.error) return { error: seasons.error.message, found }
  const shows = await db.from('shows').select('id, title').in('id', showIds)
  if (shows.error) return { error: shows.error.message, found }

  const seasonNumber = new Map(
    ((seasons.data ?? []) as Array<{ id: string; season_number: number }>).map((s) => [s.id, s.season_number])
  )
  const showTitle = new Map(
    ((shows.data ?? []) as Array<{ id: string; title: string }>).map((s) => [s.id, s.title])
  )
  for (const r of rows) {
    if (!r.youtube_video_id || found.has(r.youtube_video_id)) continue
    found.set(r.youtube_video_id, {
      episodeId: r.id,
      showId: r.show_id,
      seasonId: r.season_id,
      showTitle: showTitle.get(r.show_id) ?? '',
      seasonNumber: seasonNumber.get(r.season_id) ?? 0,
      episodeNumber: r.episode_number,
    })
  }
  return { error: null, found }
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

function thumbnail(v: YouTubeVideoResource | undefined): string | null {
  const t = v?.snippet?.thumbnails
  return t?.medium?.url ?? t?.high?.url ?? t?.default?.url ?? null
}

function privacy(v: YouTubeVideoResource | undefined): 'public' | 'unlisted' | null {
  const p = v?.status?.privacyStatus
  return p === 'public' || p === 'unlisted' ? p : null
}

function previewRow(
  videoId: string,
  position: number,
  v: YouTubeVideoResource | undefined,
  existing: ExistingVideo | undefined
): PreviewRow {
  const title = v?.snippet?.title ?? ''
  const status = existing ? 'already' : importStatus(v)
  const seconds = parseIsoDuration(v?.contentDetails?.duration ?? '')
  const row: PreviewRow = {
    videoId,
    position,
    title,
    thumbnailUrl: thumbnail(v),
    durationSeconds: seconds,
    status,
    privacy: privacy(v),
    arabicTitle: dominantScript(title) === 'ar',
  }
  if (status === 'not_ready') {
    const reason = videoReason(v)
    if (reason.kind === 'premieres') row.premieresAt = reason.at
  }
  if (existing) {
    row.existing = {
      showTitle: existing.showTitle,
      seasonNumber: existing.seasonNumber,
      episodeNumber: existing.episodeNumber,
    }
  }
  return row
}

export async function previewPlaylistPageCore(
  db: AdminDb,
  youtube: YouTubeClientLike | null,
  input: unknown
): Promise<YouTubeCoreResult<PreviewPage>> {
  const p = previewPageSchema.safeParse(input)
  if (!p.success) {
    const urlIssue = p.error.issues.some((i) => i.path[0] === 'url')
    return urlIssue
      ? { success: false, wrote: false, code: 'not_a_playlist_link', error: 'Not a playlist link.' }
      : { success: false, wrote: false, error: formatZodError(p.error) }
  }
  const { page, pageToken } = p.data

  // Resolve the playlist id before any fetch (bad links never cost quota).
  let playlistId: string
  if (page === 0) {
    const parsed = parsePlaylistId(p.data.url ?? '')
    if (!parsed.ok) return { success: false, wrote: false, code: parsed.code, error: 'Not a playlist link.' }
    playlistId = parsed.id
  } else {
    if (!p.data.playlistId || !pageToken) {
      return { success: false, wrote: false, error: 'A later page needs the playlist id and page token.' }
    }
    playlistId = p.data.playlistId
  }
  if (!youtube) return { success: false, wrote: false, code: 'key_missing', error: KEY_MISSING_MESSAGE }

  let playlist: YouTubePlaylist | null = null
  let items: Array<{ videoId: string; position: number }>
  let nextPageToken: string | null
  let videos: Map<string, YouTubeVideoResource>
  try {
    if (page === 0) playlist = await youtube.getPlaylist(playlistId)
    const listed = await youtube.listPlaylistItemsPage(playlistId, page === 0 ? undefined : pageToken)
    const seen = new Set<string>()
    items = []
    listed.items.forEach((item, i) => {
      // Placeholder items without a video id are skipped; a video listed twice keeps its first slot.
      if (!item.videoId || seen.has(item.videoId)) return
      seen.add(item.videoId)
      items.push({ videoId: item.videoId, position: (item.position ?? page * PAGE_SIZE + i) + 1 })
    })
    nextPageToken = listed.nextPageToken
    if (page === 0 && items.length === 0) {
      return { success: false, wrote: false, code: 'empty_playlist', error: 'The playlist has no videos.' }
    }
    videos = await youtube.getVideos(items.map((it) => it.videoId))
  } catch (e) {
    return { success: false, wrote: false, ...youtubeFailure(e) }
  }

  const lookup = await findExistingVideos(db, items.map((it) => it.videoId))
  if (lookup.error) return { success: false, wrote: false, error: lookup.error }

  const capped = page === LAST_PAGE && nextPageToken !== null
  return {
    success: true,
    wrote: false,
    data: {
      playlist,
      rows: items.map((it) =>
        previewRow(it.videoId, it.position, videos.get(it.videoId), lookup.found.get(it.videoId))
      ),
      nextPageToken: capped ? null : nextPageToken,
      page,
      capped,
    },
  }
}

// ---------------------------------------------------------------------------
// Commit
// ---------------------------------------------------------------------------

async function writeAudit(
  deps: ImportDeps,
  entry: Omit<Parameters<AuditWriter>[0], 'adminUserId'>
): Promise<StepResult> {
  try {
    return await deps.audit({ adminUserId: deps.adminUserId, ...entry })
  } catch (e) {
    return { error: errText(e) }
  }
}

function failMessage(result: CompensationResult): string {
  if (result.ok) return ''
  if (result.leftInPlace.length === 0) return result.error
  const left = result.leftInPlace.map((l) => l.step).join(', ')
  return `${result.error} (could not undo: ${left})`
}

/** Highest number in a season over ALL rows, archived included (0 when empty). */
async function maxEpisodeNumber(db: AdminDb, seasonId: string): Promise<{ error: string | null; max: number }> {
  const res = await db
    .from('episodes')
    .select('episode_number')
    .eq('season_id', seasonId)
    .order('episode_number', { ascending: false })
    .limit(1)
  if (res.error) return { error: res.error.message, max: 0 }
  const top = ((res.data ?? []) as Array<{ episode_number: number }>)[0]?.episode_number ?? 0
  return { error: null, max: top }
}

async function nextSeasonNumber(db: AdminDb, showId: string): Promise<{ error: string | null; next: number }> {
  const res = await db
    .from('seasons')
    .select('season_number')
    .eq('show_id', showId)
    .order('season_number', { ascending: false })
    .limit(1)
  if (res.error) return { error: res.error.message, next: 1 }
  const top = ((res.data ?? []) as Array<{ season_number: number }>)[0]?.season_number ?? 0
  return { error: null, next: top + 1 }
}

export async function commitImportCore(
  db: AdminDb,
  deps: ImportDeps,
  input: unknown
): Promise<YouTubeCoreResult<ImportData>> {
  const p = commitImportSchema.safeParse(input)
  if (!p.success) return { success: false, wrote: false, error: formatZodError(p.error) }
  const { playlistId, videoIds, target } = p.data
  const ps = parseId(p.data.showId, 'show')
  if (!ps.ok) return { success: false, wrote: false, error: ps.error }
  const showId = ps.value
  const refuse = (error: string, extra: { code?: YouTubeErrorCode } = {}) => ({
    success: false as const,
    wrote: false,
    error,
    ...extra,
  })

  const show = await db
    .from('shows')
    .select('id, title, description, description_ar')
    .eq('id', showId)
    .maybeSingle()
  if (show.error) return refuse(show.error.message)
  if (!show.data) return refuse('Show not found.')
  const showRow = show.data as unknown as { description: string | null; description_ar: string | null }

  let existingSeasonId: string | null = null
  if (target.kind === 'existing') {
    const ss = parseId(target.seasonId, 'season')
    if (!ss.ok) return refuse(ss.error)
    const season = await db.from('seasons').select('id, show_id').eq('id', ss.value).maybeSingle()
    if (season.error) return refuse(season.error.message)
    if (!season.data) return refuse('Season not found.')
    if ((season.data as unknown as Obj).show_id !== showId) return refuse('Season belongs to a different show.')
    existingSeasonId = ss.value
  }

  // Re-fetch and re-classify every id; never trust client rows (T-06-22).
  if (!deps.youtube) return refuse(KEY_MISSING_MESSAGE, { code: 'key_missing' })
  let videos: Map<string, YouTubeVideoResource>
  try {
    videos = await deps.youtube.getVideos(videoIds)
  } catch (e) {
    const f = youtubeFailure(e)
    return refuse(f.error, { code: f.code })
  }
  const lookup = await findExistingVideos(db, videoIds)
  if (lookup.error) return refuse(lookup.error)
  const changed = videoIds.filter((v) => importStatus(videos.get(v)) !== 'ok' || lookup.found.has(v))
  if (changed.length > 0) return refuse(IMPORT_CHANGED_MESSAGE)

  let startNumber = 0
  let seasonNumber = 0
  if (existingSeasonId) {
    const m = await maxEpisodeNumber(db, existingSeasonId)
    if (m.error) return refuse(m.error)
    startNumber = m.max
  } else {
    const n = await nextSeasonNumber(db, showId)
    if (n.error) return refuse(n.error)
    seasonNumber = n.next
  }

  const plan = buildImportPlan({
    videos: videoIds.map((v, i) => ({ id: v, position: i, item: videos.get(v) })),
    startNumber,
    showDefaults: { description: showRow.description, description_ar: showRow.description_ar },
    now: deps.now,
  })
  if (plan.rows.length !== videoIds.length) return refuse(IMPORT_CHANGED_MESSAGE)

  let seasonId: string | null = existingSeasonId
  let episodeIds: string[] = []
  // Set when the insert lost a race with a renumber or reorder of the season.
  let seasonChanged = false
  const recount = async (): Promise<StepResult> => {
    if (seasonId) {
      const s = await recomputeSeasonEpisodeCount(db, seasonId)
      if (s.error) return s
    }
    return recomputeShowCounts(db, showId)
  }
  const context = (): Obj => ({
    kind: 'youtube_import',
    playlist_id: playlistId,
    show_id: showId,
    season_id: seasonId,
    target: target.kind,
    episode_count: plan.rows.length,
  })

  const steps: WriteStep[] = []
  if (target.kind === 'new') {
    const title = target.seasonTitle
    steps.push({
      name: 'insert-season',
      run: async () => {
        const res = await db
          .from('seasons')
          .insert({
            show_id: showId,
            title,
            // D-04: an Arabic title is mirrored, never translated.
            title_ar: dominantScript(title) === 'ar' ? title : null,
            season_number: seasonNumber,
          })
          .select('id')
          .single()
        if (res.error) return { error: res.error.message }
        seasonId = (res.data as { id: string }).id
        return { error: null }
      },
      undo: async () => {
        if (!seasonId) return { error: null }
        const del = await db.from('seasons').delete().eq('id', seasonId)
        if (del.error) return { error: del.error.message }
        return recomputeShowCounts(db, showId)
      },
    })
  }
  steps.push(
    {
      name: 'insert-episodes',
      run: async () => {
        if (!seasonId) return { error: 'No target season.' }
        const rows = plan.rows.map((r) => ({ ...r, show_id: showId, season_id: seasonId as string, archived: false }))
        // ONE statement: a unique violation fails every row (T-06-26).
        const res = await db.from('episodes').insert(rows).select('id')
        if (res.error) {
          const unique = res.error.code === '23505'
          if (unique && res.error.message.includes(VIDEO_ID_CONSTRAINT)) {
            return { error: IMPORT_DUPLICATE_MESSAGE }
          }
          if (unique && res.error.message.includes(SEASON_NUMBER_CONSTRAINT)) {
            seasonChanged = true
            return { error: IMPORT_SEASON_CHANGED_MESSAGE }
          }
          return { error: res.error.message }
        }
        const ids = ((res.data ?? []) as Array<{ id: string }>).map((r) => r.id)
        episodeIds = ids
        if (ids.length !== rows.length) {
          return { error: `insert episodes: expected ${rows.length} rows, inserted ${ids.length}.` }
        }
        return { error: null }
      },
      undo: async () => {
        if (episodeIds.length === 0) return { error: null }
        const del = await db.from('episodes').delete().in('id', episodeIds)
        if (del.error) return { error: del.error.message }
        return recount()
      },
    },
    {
      name: 'recompute-counts',
      run: recount,
      // The insert undos above recount after removing rows, so nothing is left here.
      undo: async () => ({ error: null }),
    },
    {
      name: 'audit',
      run: () =>
        writeAudit(deps, {
          action: 'create',
          entity: 'season',
          entityId: seasonId,
          diff: {
            kind: 'youtube_import',
            playlist_id: playlistId,
            episode_count: episodeIds.length,
            season_id: seasonId,
            target: target.kind,
            episode_ids: episodeIds,
          },
        }),
    }
  )

  const result = await runWithCompensation(steps)
  if (!result.ok) {
    // D-07: the failure is audited and returned, never swallowed.
    await writeAudit(deps, {
      action: 'create',
      entity: 'season',
      entityId: seasonId,
      diff: compensationAuditDiff(result, context()),
    })
    // The retry message only when everything was undone; otherwise the
    // "could not undo" detail must reach the admin.
    const retry = seasonChanged && result.leftInPlace.length === 0
    return {
      success: false,
      wrote: result.wrote,
      error: failMessage(result),
      ...(retry ? { code: 'season_changed' as const } : {}),
    }
  }
  return {
    success: true,
    wrote: true,
    data: {
      showId,
      seasonId: seasonId as string,
      episodeIds,
      needsEnglishCount: plan.needsEnglishCount,
    },
  }
}
