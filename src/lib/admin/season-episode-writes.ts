// Season and episode write cores: strict payload schemas, ids scoped from stored
// rows, audit rows, compensation for multi-step writes and checked, archived-aware
// counts. No next/* imports: revalidation stays in the actions.ts wrapper.
import {
  compensationAuditDiff,
  runAuditedDelete,
  runWithCompensation,
  type CompensationResult,
  type WriteStep,
} from './compensation.ts'
import { recomputeSeasonEpisodeCount, recomputeShowCounts } from './counts.ts'
import {
  episodeSchema,
  episodeUpdateSchema,
  formatZodError,
  parseId,
  seasonSchema,
  seasonUpdateSchema,
} from './schemas.ts'
import { verifyMessage, type DuplicateParams, type VerifyOutcome } from './youtube-verify.ts'
import {
  EPISODE_TEXT_FIELDS,
  episodeTextFromYouTube,
  flagsOnCreate,
  flagsOnUpdate,
  type EpisodeTextField,
  type TextValues,
} from './youtube-text-edits.ts'
import { parseVideoIdStrict } from '../../server/youtube/urls.ts'
import type { YouTubeErrorCode } from '../youtube-errors'
import type { AdminDb, ArabicFill, AuditWriter, CoreResult } from './ports'

type Deps = {
  audit: AuditWriter
  adminUserId: string
  fillArabic: ArabicFill
  /**
   * Server check of a new or changed video link (YT-03). Optional in the core;
   * the action wrapper always supplies it (06-13). Fail closed: key missing or
   * quota blocks saving a new or changed link; other edits are unaffected.
   */
  verifyVideo?: (raw: string, opts: { excludeEpisodeId?: string }) => Promise<VerifyOutcome>
}
type Obj = Record<string, unknown>
type StepResult = { error: string | null }
type SeasonData = { showId?: string; season?: unknown }
type YouTubeError = { code: YouTubeErrorCode; params?: DuplicateParams }
type EpisodeData = { showId?: string; episode?: unknown; youtubeError?: YouTubeError }

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

const dupNumber = (n: unknown) =>
  `Episode number ${n} already exists in this season. Choose a different number.`

const DUP_VIDEO = 'This video is already on Clickit.'

/** A 23505 raised by the catalog-wide video index (06-01), not the number one. */
const isDupVideo = (e: { code?: string; message: string }) =>
  e.code === '23505' && e.message.includes('episodes_youtube_video_id_key')

/**
 * Runs deps.verifyVideo. Returns the normalized id and the video's text routed
 * as the import routes it (for the edited flags, review item 7), or a refusal
 * result to return as-is. A throw (database read failed) is a plain error,
 * never ok.
 */
async function checkVideo(
  deps: Deps,
  raw: string,
  opts: { excludeEpisodeId?: string },
  showId: string
): Promise<
  { videoId: string; youtube: TextValues<EpisodeTextField> } | { refusal: CoreResult<EpisodeData> }
> {
  let outcome: VerifyOutcome
  try {
    outcome = await (deps.verifyVideo as NonNullable<Deps['verifyVideo']>)(raw, opts)
  } catch (e) {
    return { refusal: { success: false, error: errText(e), wrote: false, data: { showId } } }
  }
  if (outcome.ok) return { videoId: outcome.meta.videoId, youtube: episodeTextFromYouTube(outcome.meta) }
  const youtubeError: YouTubeError = outcome.params
    ? { code: outcome.code, params: outcome.params }
    : { code: outcome.code }
  return {
    refusal: { success: false, error: verifyMessage(outcome), wrote: false, data: { showId, youtubeError } },
  }
}

function blank(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
}

function pick(row: Obj, keys: string[]): Obj {
  const out: Obj = {}
  for (const k of keys) out[k] = row[k] ?? null
  return out
}

/** Exactly one row came back from a write chained with .select('id'). */
function oneRow(
  res: { data: unknown; error: { message: string } | null },
  what: string
): StepResult {
  if (res.error) return { error: res.error.message }
  const n = Array.isArray(res.data) ? res.data.length : 0
  return n === 1 ? { error: null } : { error: `${what}: expected 1 row, changed ${n}.` }
}

function auditStep(
  deps: Deps,
  action: 'create' | 'update',
  entity: 'season' | 'episode',
  entityId: () => string | null,
  diff: () => Obj
): WriteStep {
  return {
    name: 'audit',
    run: async () => {
      try {
        return await deps.audit({
          adminUserId: deps.adminUserId,
          action,
          entity,
          entityId: entityId(),
          diff: diff(),
        })
      } catch (e) {
        return { error: errText(e) }
      }
    },
  }
}

async function recordFailure(
  deps: Deps,
  action: 'create' | 'update',
  entity: 'season' | 'episode',
  entityId: string | null,
  result: CompensationResult,
  context: Obj
) {
  if (result.ok) return
  try {
    await deps.audit({
      adminUserId: deps.adminUserId,
      action,
      entity,
      entityId,
      diff: compensationAuditDiff(result, context),
    })
  } catch {
    // The failure is already returned to the caller; nothing more to do.
  }
}

function failMessage(result: CompensationResult): string {
  if (result.ok) return ''
  if (result.leftInPlace.length === 0) return result.error
  const left = result.leftInPlace.map((l) => l.step).join(', ')
  return `${result.error} (could not undo: ${left})`
}

async function fill(
  deps: Deps,
  en: string | null | undefined,
  ar: string | null | undefined
): Promise<{ value: string | null; error?: string }> {
  try {
    return { value: await deps.fillArabic(en, ar) }
  } catch (e) {
    return { value: null, error: errText(e) }
  }
}

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

export async function createSeasonCore(
  db: AdminDb,
  deps: Deps,
  data: unknown
): Promise<CoreResult<SeasonData>> {
  const p = seasonSchema.safeParse(data)
  if (!p.success) return { success: false, error: formatZodError(p.error), wrote: false }
  const parsed = p.data
  const ar = await fill(deps, parsed.title, parsed.title_ar)
  if (ar.error) return { success: false, error: ar.error, wrote: false }
  parsed.title_ar = ar.value

  let created: Obj | null = null
  const steps: WriteStep[] = [
    {
      name: 'insert-season',
      run: async () => {
        const res = await db.from('seasons').insert(parsed as never).select().single()
        if (res.error) return { error: res.error.message }
        created = res.data as unknown as Obj
        return { error: null }
      },
      undo: async () => {
        if (!created) return { error: null }
        const del = await db.from('seasons').delete().eq('id', created.id as string)
        if (del.error) return { error: del.error.message }
        return recomputeShowCounts(db, parsed.show_id)
      },
    },
    { name: 'recompute-counts', run: () => recomputeShowCounts(db, parsed.show_id) },
    auditStep(
      deps,
      'create',
      'season',
      () => (created?.id as string) ?? null,
      () => ({ data: created })
    ),
  ]
  const result = await runWithCompensation(steps)
  if (!result.ok) {
    await recordFailure(deps, 'create', 'season', (created as Obj | null)?.id as string ?? null, result, {
      show_id: parsed.show_id,
      title: parsed.title,
      season_number: parsed.season_number,
    })
    return {
      success: false,
      error: failMessage(result),
      wrote: result.wrote,
      data: { showId: parsed.show_id },
    }
  }
  return { success: true, wrote: true, data: { season: created, showId: parsed.show_id } }
}

export async function updateSeasonCore(
  db: AdminDb,
  deps: Deps,
  id: unknown,
  data: unknown
): Promise<CoreResult<SeasonData>> {
  const pid = parseId(id, 'season')
  if (!pid.ok) return { success: false, error: pid.error, wrote: false }
  const p = seasonUpdateSchema.safeParse(data)
  if (!p.success) return { success: false, error: formatZodError(p.error), wrote: false }
  const seasonId = pid.value

  const cur = await db
    .from('seasons')
    .select('id, show_id, title, title_ar, season_number')
    .eq('id', seasonId)
    .maybeSingle()
  if (cur.error) return { success: false, error: cur.error.message, wrote: false }
  if (!cur.data) return { success: false, error: 'Season not found.', wrote: false }
  const row = cur.data as unknown as Obj
  const showId = row.show_id as string

  const { show_id: clientShow, ...rest } = p.data
  if (clientShow !== undefined && clientShow !== showId) {
    return { success: false, error: 'Season belongs to a different show.', wrote: false, data: { showId } }
  }
  const patch: Obj = { ...rest }

  if ('title_ar' in patch && blank(patch.title_ar)) {
    const title = (patch.title as string | undefined) ?? (row.title as string)
    if (title) {
      const ar = await fill(deps, title, null)
      if (ar.error) return { success: false, error: ar.error, wrote: false, data: { showId } }
      patch.title_ar = ar.value
    }
  }
  const keys = Object.keys(patch)
  if (keys.length === 0) {
    return { success: true, wrote: false, data: { season: row, showId } }
  }
  const before = pick(row, keys)

  let updated: unknown = null
  const steps: WriteStep[] = [
    {
      name: 'update-season',
      run: async () => {
        const res = await db.from('seasons').update(patch as never).eq('id', seasonId).select().single()
        if (res.error) return { error: res.error.message }
        updated = res.data
        return { error: null }
      },
      undo: async () => {
        const res = await db.from('seasons').update(before as never).eq('id', seasonId)
        return { error: res.error?.message ?? null }
      },
    },
    auditStep(deps, 'update', 'season', () => seasonId, () => ({ before, after: patch })),
  ]
  const result = await runWithCompensation(steps)
  if (!result.ok) {
    await recordFailure(deps, 'update', 'season', seasonId, result, { before, after: patch })
    return { success: false, error: failMessage(result), wrote: result.wrote, data: { showId } }
  }
  return { success: true, wrote: true, data: { season: updated, showId } }
}

export async function deleteSeasonCore(
  db: AdminDb,
  deps: Deps,
  id: unknown,
  showId: unknown
): Promise<CoreResult<SeasonData>> {
  const pid = parseId(id, 'season')
  if (!pid.ok) return { success: false, error: pid.error, wrote: false }
  const ps = parseId(showId, 'show')
  if (!ps.ok) return { success: false, error: ps.error, wrote: false }
  const seasonId = pid.value

  const cur = await db
    .from('seasons')
    .select('id, show_id, title, season_number')
    .eq('id', seasonId)
    .maybeSingle()
  if (cur.error) return { success: false, error: cur.error.message, wrote: false }
  if (!cur.data) return { success: false, error: 'Season not found.', wrote: false }
  const row = cur.data as unknown as Obj
  const storedShow = row.show_id as string
  if (storedShow !== ps.value) {
    return { success: false, error: 'Season belongs to a different show.', wrote: false, data: { showId: storedShow } }
  }

  const eps = await db.from('episodes').select('id, archived').eq('season_id', seasonId)
  if (eps.error) return { success: false, error: eps.error.message, wrote: false, data: { showId: storedShow } }
  const epRows = (eps.data ?? []) as Array<{ id: string; archived: boolean | null }>
  // Archive first (D-04): the delete cascades to episodes, so any active episode blocks it.
  if (epRows.some((e) => e.archived !== true)) {
    return {
      success: false,
      error: 'Archive every episode in this season before deleting it.',
      wrote: false,
      data: { showId: storedShow },
    }
  }
  const episodeIds = epRows.map((e) => e.id)

  let countsError: string | null = null
  const res = await runAuditedDelete({
    audit: deps.audit,
    adminUserId: deps.adminUserId,
    action: 'delete',
    entity: 'season',
    entityId: seasonId,
    context: {
      title: row.title,
      season_number: row.season_number,
      show_id: storedShow,
      episode_ids: episodeIds,
    },
    steps: [
      {
        name: 'delete-season',
        run: async () =>
          oneRow(
            await db.from('seasons').delete().eq('id', seasonId).eq('show_id', storedShow).select('id'),
            'delete season'
          ),
      },
      {
        name: 'recompute-counts',
        run: async () => {
          const r = await recomputeShowCounts(db, storedShow)
          countsError = r.error
          return r
        },
      },
    ],
  })
  if (!res.ok) {
    const error = countsError
      ? `Season deleted, but the show counts could not be updated: ${countsError}`
      : (res.error ?? 'Failed to delete season.')
    return { success: false, error, wrote: res.wrote, data: { showId: storedShow } }
  }
  return { success: true, wrote: true, data: { showId: storedShow } }
}

// ---------------------------------------------------------------------------
// Episodes
// ---------------------------------------------------------------------------

/** Step that moves an archived episode out of a number, with an undo that puts it back. */
async function bumpArchivedStep(
  db: AdminDb,
  seasonId: string,
  holder: { id: string; episode_number: number }
): Promise<{ step?: WriteStep; error?: string }> {
  const max = await db
    .from('episodes')
    .select('episode_number')
    .eq('season_id', seasonId)
    .order('episode_number', { ascending: false })
    .limit(1)
  if (max.error) return { error: max.error.message }
  const top = ((max.data ?? []) as Array<{ episode_number: number }>)[0]?.episode_number ?? 0
  const bumped = Math.max(top, holder.episode_number) + 1
  return {
    step: {
      name: 'bump-archived',
      run: async () => {
        const r = await db.from('episodes').update({ episode_number: bumped }).eq('id', holder.id)
        return { error: r.error?.message ?? null }
      },
      undo: async () => {
        const r = await db
          .from('episodes')
          .update({ episode_number: holder.episode_number })
          .eq('id', holder.id)
        return { error: r.error?.message ?? null }
      },
    },
  }
}

export async function createEpisodeCore(
  db: AdminDb,
  deps: Deps,
  data: unknown
): Promise<CoreResult<EpisodeData>> {
  const p = episodeSchema.safeParse(data)
  if (!p.success) return { success: false, error: formatZodError(p.error), wrote: false }
  const parsed = p.data
  const showId = parsed.show_id

  const season = await db.from('seasons').select('id, show_id').eq('id', parsed.season_id).maybeSingle()
  if (season.error) return { success: false, error: season.error.message, wrote: false }
  if (!season.data) return { success: false, error: 'Season not found.', wrote: false }
  if ((season.data as unknown as Obj).show_id !== showId) {
    return { success: false, error: 'Season does not belong to this show.', wrote: false }
  }

  let youtube: TextValues<EpisodeTextField> | null = null
  // Flags below are computed against the verified video's text, so the row
  // starts past the daily check's text baseline (PR #27 re-review, note 1).
  // No verified video: the baseline stays pending for the first ok check.
  let baseline: { youtube_text_baseline_at: string } | null = null
  if (deps.verifyVideo && !blank(parsed.youtube_video_id)) {
    const v = await checkVideo(deps, parsed.youtube_video_id as string, {}, showId)
    if ('refusal' in v) return v.refusal
    parsed.youtube_video_id = v.videoId
    youtube = v.youtube
    baseline = { youtube_text_baseline_at: new Date().toISOString() }
  }

  const t = await fill(deps, parsed.title, parsed.title_ar)
  if (t.error) return { success: false, error: t.error, wrote: false }
  const d = await fill(deps, parsed.description, parsed.description_ar)
  if (d.error) return { success: false, error: d.error, wrote: false }
  parsed.title_ar = t.value
  parsed.description_ar = d.value
  // Review item 7: a saved field that differs from the verified video's text
  // is "edited on Clickit", so the daily check keeps it. No verified video:
  // every non-empty field counts as edited.
  const edited = flagsOnCreate(EPISODE_TEXT_FIELDS, parsed, youtube)

  const visible = await db
    .from('episodes')
    .select('id')
    .eq('season_id', parsed.season_id)
    .eq('episode_number', parsed.episode_number)
    .eq('archived', false)
    .maybeSingle()
  if (visible.error) return { success: false, error: visible.error.message, wrote: false }
  if (visible.data) {
    return { success: false, error: dupNumber(parsed.episode_number), wrote: false, data: { showId } }
  }

  const steps: WriteStep[] = []
  const held = await db
    .from('episodes')
    .select('id, episode_number')
    .eq('season_id', parsed.season_id)
    .eq('episode_number', parsed.episode_number)
    .eq('archived', true)
    .maybeSingle()
  if (held.error) return { success: false, error: held.error.message, wrote: false }
  if (held.data) {
    const b = await bumpArchivedStep(db, parsed.season_id, held.data as { id: string; episode_number: number })
    if (b.error || !b.step) return { success: false, error: b.error ?? 'Could not bump archived episode.', wrote: false }
    steps.push(b.step)
  }

  const recount = async (): Promise<StepResult> => {
    const s = await recomputeSeasonEpisodeCount(db, parsed.season_id)
    if (s.error) return s
    return recomputeShowCounts(db, showId)
  }
  let created: Obj | null = null
  let dupVideo = false
  steps.push(
    {
      name: 'insert-episode',
      run: async () => {
        const res = await db
          .from('episodes')
          .insert({ ...parsed, ...edited, ...baseline, archived: false } as never)
          .select()
          .single()
        if (res.error) {
          dupVideo = isDupVideo(res.error)
          if (dupVideo) return { error: DUP_VIDEO }
          return {
            error: res.error.code === '23505' ? dupNumber(parsed.episode_number) : res.error.message,
          }
        }
        created = res.data as unknown as Obj
        return { error: null }
      },
      undo: async () => {
        if (!created) return { error: null }
        const del = await db.from('episodes').delete().eq('id', created.id as string)
        if (del.error) return { error: del.error.message }
        return recount()
      },
    },
    { name: 'recompute-counts', run: recount },
    auditStep(
      deps,
      'create',
      'episode',
      () => (created?.id as string) ?? null,
      () => ({ data: created })
    )
  )
  const result = await runWithCompensation(steps)
  if (!result.ok) {
    await recordFailure(deps, 'create', 'episode', ((created as Obj | null)?.id as string) ?? null, result, {
      show_id: showId,
      season_id: parsed.season_id,
      title: parsed.title,
      episode_number: parsed.episode_number,
    })
    const data: EpisodeData = dupVideo ? { showId, youtubeError: { code: 'video_duplicate' } } : { showId }
    return { success: false, error: failMessage(result), wrote: result.wrote, data }
  }
  return { success: true, wrote: true, data: { episode: created, showId } }
}

export async function updateEpisodeCore(
  db: AdminDb,
  deps: Deps,
  id: unknown,
  data: unknown
): Promise<CoreResult<EpisodeData>> {
  const pid = parseId(id, 'episode')
  if (!pid.ok) return { success: false, error: pid.error, wrote: false }
  const p = episodeUpdateSchema.safeParse(data)
  if (!p.success) return { success: false, error: formatZodError(p.error), wrote: false }
  const episodeId = pid.value

  const cur = await db.from('episodes').select('*').eq('id', episodeId).maybeSingle()
  if (cur.error) return { success: false, error: cur.error.message, wrote: false }
  if (!cur.data) return { success: false, error: 'Episode not found.', wrote: false }
  const row = cur.data as unknown as Obj
  const showId = row.show_id as string
  const seasonId = row.season_id as string

  const { show_id: clientShow, season_id: clientSeason, ...rest } = p.data
  if (clientShow !== undefined && clientShow !== showId) {
    return { success: false, error: 'Episode belongs to a different show.', wrote: false, data: { showId } }
  }
  if (clientSeason !== undefined && clientSeason !== seasonId) {
    return { success: false, error: 'Episode cannot be moved to a different season.', wrote: false, data: { showId } }
  }
  const patch: Obj = { ...rest }

  // Verify only a present and changed video link (same id in another form is not a change).
  let youtube: TextValues<EpisodeTextField> | null = null
  if (deps.verifyVideo && typeof patch.youtube_video_id === 'string' && !blank(patch.youtube_video_id)) {
    const raw = patch.youtube_video_id
    const same = parseVideoIdStrict(raw)
    if (same.ok && same.id === row.youtube_video_id) {
      patch.youtube_video_id = same.id
    } else {
      const v = await checkVideo(deps, raw, { excludeEpisodeId: episodeId }, showId)
      if ('refusal' in v) return v.refusal
      patch.youtube_video_id = v.videoId
      youtube = v.youtube
    }
  }

  if ('title_ar' in patch && blank(patch.title_ar)) {
    const title = (patch.title as string | undefined) ?? (row.title as string)
    if (title) {
      const ar = await fill(deps, title, null)
      if (ar.error) return { success: false, error: ar.error, wrote: false, data: { showId } }
      patch.title_ar = ar.value
    }
  }
  if ('description_ar' in patch && blank(patch.description_ar)) {
    const description = (patch.description as string | undefined) ?? (row.description as string)
    if (description) {
      const ar = await fill(deps, description, null)
      if (ar.error) return { success: false, error: ar.error, wrote: false, data: { showId } }
      patch.description_ar = ar.value
    }
  }

  // Review item 7: a text field changed on Clickit gets its edited flag, in
  // the same UPDATE as the text, so the daily check skips it from then on.
  Object.assign(patch, flagsOnUpdate(EPISODE_TEXT_FIELDS, patch, row, youtube))

  const steps: WriteStep[] = []
  if (patch.episode_number !== undefined && patch.episode_number !== row.episode_number) {
    const holder = await db
      .from('episodes')
      .select('id, episode_number, archived')
      .eq('season_id', seasonId)
      .eq('episode_number', patch.episode_number as number)
      .neq('id', episodeId)
      .maybeSingle()
    if (holder.error) return { success: false, error: holder.error.message, wrote: false, data: { showId } }
    if (holder.data) {
      const h = holder.data as unknown as { id: string; episode_number: number; archived: boolean }
      if (!h.archived) {
        return { success: false, error: dupNumber(patch.episode_number), wrote: false, data: { showId } }
      }
      const b = await bumpArchivedStep(db, seasonId, h)
      if (b.error || !b.step) {
        return { success: false, error: b.error ?? 'Could not bump archived episode.', wrote: false, data: { showId } }
      }
      steps.push(b.step)
    }
  }

  const keys = Object.keys(patch)
  if (keys.length === 0) return { success: true, wrote: false, data: { episode: row, showId } }
  const before = pick(row, keys)

  let updated: unknown = null
  let dupVideo = false
  steps.push(
    {
      name: 'update-episode',
      run: async () => {
        const res = await db.from('episodes').update(patch as never).eq('id', episodeId).select().single()
        if (res.error) {
          dupVideo = isDupVideo(res.error)
          if (dupVideo) return { error: DUP_VIDEO }
          return {
            error:
              res.error.code === '23505'
                ? 'This episode number already exists in this season. Choose a different number.'
                : res.error.message,
          }
        }
        updated = res.data
        return { error: null }
      },
      undo: async () => {
        const res = await db.from('episodes').update(before as never).eq('id', episodeId)
        return { error: res.error?.message ?? null }
      },
    },
    auditStep(deps, 'update', 'episode', () => episodeId, () => ({ before, after: patch }))
  )
  const result = await runWithCompensation(steps)
  if (!result.ok) {
    await recordFailure(deps, 'update', 'episode', episodeId, result, { before, after: patch })
    const data: EpisodeData = dupVideo ? { showId, youtubeError: { code: 'video_duplicate' } } : { showId }
    return { success: false, error: failMessage(result), wrote: result.wrote, data }
  }
  return { success: true, wrote: true, data: { episode: updated, showId } }
}
