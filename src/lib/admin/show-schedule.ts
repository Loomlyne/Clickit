// Bulk scheduling cores: conditional per-episode updates run through
// compensation, slot-level audit records, and an unschedule that reverts only
// slots the scheduler wrote and nobody changed since.
// No next/* imports: revalidation stays in the actions.ts wrapper.
import { z } from 'zod'
import { nextBroadcastSlots } from '../scheduling.ts'
import { needsEnglishTitle } from '../../server/youtube/script.ts'
import {
  compensationAuditDiff,
  runWithCompensation,
  type CompensationResult,
  type WriteStep,
} from './compensation.ts'
import { parseId } from './schemas.ts'
import type { AdminDb, AuditWriter, CoreResult } from './ports'

export type PlannedEpisodeSlot = {
  episodeId: string
  seasonNumber: number
  episodeNumber: number
  title: string
  /** UTC ISO instant the episode goes live. */
  publishAt: string
  /** False when the episode has no YouTube id: it would air with no video. */
  hasVideo: boolean
  /** Arabic-dominant title (or a mirror of title_ar): the admin should add an English one. */
  needsEnglishTitle: boolean
  /** Stored YouTube check result, or null when never checked. */
  youtubeStatus: string | null
}

const SELECTION_REFUSED = 'Some selected episodes cannot be scheduled.'

type Deps = {
  audit: AuditWriter
  adminUserId: string
  now: Date
  planOverride?: PlannedEpisodeSlot[]
}

export async function planShowScheduleCore(
  db: AdminDb,
  showId: string,
  now: Date,
  /** Limits the plan to these episodes (the import success state, D-07). Each must
   *  be an unarchived, unpublished episode of this show, else the plan is refused. */
  episodeIds?: string[]
): Promise<
  { ok: false; error: string } | { ok: true; plan: PlannedEpisodeSlot[] }
> {
  let wanted: string[] | undefined
  if (episodeIds !== undefined) {
    wanted = []
    for (const raw of episodeIds) {
      const parsed = parseId(raw, 'episode')
      if (!parsed.ok) return { ok: false, error: SELECTION_REFUSED }
      if (!wanted.includes(parsed.value)) wanted.push(parsed.value)
    }
  }

  const { data: show, error: showError } = await db
    .from('shows')
    .select('broadcast_day, broadcast_time')
    .eq('id', showId)
    .single()
  if (showError || !show) return { ok: false, error: 'Show not found' }

  const days = show.broadcast_day ?? []
  if (days.length === 0 || !show.broadcast_time) {
    return {
      ok: false,
      error:
        'Set the broadcast days and time on this show before scheduling episodes.',
    }
  }

  const [{ data: episodes, error: epError }, { data: seasons }] =
    await Promise.all([
      (() => {
        const q = db
          .from('episodes')
          .select(
            'id, title, title_ar, episode_number, season_id, youtube_video_id, youtube_status'
          )
          .eq('show_id', showId)
          .eq('archived', false)
          .neq('status', 'published')
        return wanted ? q.in('id', wanted) : q
      })(),
      db.from('seasons').select('id, season_number').eq('show_id', showId),
    ])
  if (epError) return { ok: false, error: epError.message }
  if (wanted && (episodes ?? []).length !== wanted.length)
    return { ok: false, error: SELECTION_REFUSED }

  const seasonNumberById = new Map(
    (seasons ?? []).map((s) => [s.id, s.season_number])
  )
  const ordered = (episodes ?? []).slice().sort((a, b) => {
    const seasonDelta =
      (seasonNumberById.get(a.season_id) ?? 0) -
      (seasonNumberById.get(b.season_id) ?? 0)
    return seasonDelta !== 0 ? seasonDelta : a.episode_number - b.episode_number
  })

  const slots = nextBroadcastSlots(days, show.broadcast_time, ordered.length, now)
  return {
    ok: true,
    plan: ordered.slice(0, slots.length).map((ep, i) => ({
      episodeId: ep.id,
      seasonNumber: seasonNumberById.get(ep.season_id) ?? 0,
      episodeNumber: ep.episode_number,
      title: ep.title,
      publishAt: slots[i],
      hasVideo: Boolean(ep.youtube_video_id),
      needsEnglishTitle: needsEnglishTitle({ title: ep.title, title_ar: ep.title_ar }),
      youtubeStatus: ep.youtube_status ?? null,
    })),
  }
}

type StepResult = { error: string | null }
type Data = { showId?: string; scheduled?: number; cleared?: number }

const EPISODE_STATUSES = ['draft', 'coming-soon', 'published'] as const
const CHANGED_WHILE_SCHEDULING =
  'An episode changed while scheduling; nothing was applied.'
const CHANGED_WHILE_UNSCHEDULING =
  'An episode changed while unscheduling; nothing was changed.'
const UNREADABLE_RECORD =
  'The last bulk schedule record is unreadable; nothing was changed.'

/** Shape of the committed audit diff written by applyShowScheduleCore. */
export const bulkScheduleRecordSchema = z.object({
  kind: z.literal('bulk_schedule'),
  slots: z
    .array(
      z.strictObject({
        episodeId: z.uuid(),
        previous_status: z.enum(EPISODE_STATUSES),
        previous_publish_at: z.iso.datetime({ offset: true }).nullable(),
        publish_at: z.iso.datetime({ offset: true }),
      })
    )
    .min(1),
})

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

async function writeAudit(
  deps: Pick<Deps, 'audit' | 'adminUserId'>,
  diff: Record<string, unknown>,
  showId: string
): Promise<StepResult> {
  try {
    return await deps.audit({
      adminUserId: deps.adminUserId,
      action: 'update',
      entity: 'show',
      entityId: showId,
      diff,
    })
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

/** Runs the steps; on failure writes one failed audit row and builds the result. */
async function runAndAudit(
  deps: Pick<Deps, 'audit' | 'adminUserId'>,
  showId: string,
  steps: WriteStep[],
  failedContext: Record<string, unknown>
): Promise<
  { ok: true; wrote: boolean } | { ok: false; error: string; wrote: boolean }
> {
  const result = await runWithCompensation(steps)
  if (result.ok) return { ok: true, wrote: result.wrote }
  const closing = await writeAudit(
    deps,
    compensationAuditDiff(result, failedContext),
    showId
  )
  const error = failMessage(result)
  return {
    ok: false,
    wrote: result.wrote,
    error: closing.error
      ? `${error} (the failure audit row also failed to write)`
      : error,
  }
}

type EpisodeState = {
  id: string
  show_id: string
  archived: boolean
  status: string
  publish_at: string | null
}

async function readEpisodes(
  db: AdminDb,
  ids: string[]
): Promise<{ rows: Map<string, EpisodeState>; error: string | null }> {
  const { data, error } = await db
    .from('episodes')
    .select('id, show_id, archived, status, publish_at')
    .in('id', ids)
  if (error) return { rows: new Map(), error: error.message }
  return {
    rows: new Map(((data ?? []) as EpisodeState[]).map((r) => [r.id, r])),
    error: null,
  }
}

export async function applyShowScheduleCore(
  db: AdminDb,
  deps: Deps,
  showIdRaw: unknown
): Promise<CoreResult<Data>> {
  const parsed = parseId(showIdRaw, 'show')
  if (!parsed.ok) return { success: false, error: parsed.error, wrote: false }
  const showId = parsed.value
  const fail = (error: string, wrote = false): CoreResult<Data> => ({
    success: false,
    error,
    wrote,
    data: { showId },
  })

  let plan = deps.planOverride
  if (!plan) {
    const result = await planShowScheduleCore(db, showId, deps.now)
    if (!result.ok) return fail(result.error)
    plan = result.plan
  }
  if (plan.length === 0) return fail('No unpublished episodes to schedule.')

  const current = await readEpisodes(db, plan.map((s) => s.episodeId))
  if (current.error) return fail(current.error)

  const slots: {
    episodeId: string
    previous_status: string
    previous_publish_at: string | null
    publish_at: string
  }[] = []
  for (const slot of plan) {
    const row = current.rows.get(slot.episodeId)
    if (!row) return fail(CHANGED_WHILE_SCHEDULING)
    slots.push({
      episodeId: slot.episodeId,
      previous_status: row.status,
      previous_publish_at: row.publish_at,
      publish_at: slot.publishAt,
    })
  }

  const steps: WriteStep[] = slots.map((slot) => ({
    name: `schedule:${slot.episodeId}`,
    run: async () => {
      const { data, error } = await db
        .from('episodes')
        .update({ status: 'coming-soon', publish_at: slot.publish_at })
        .eq('id', slot.episodeId)
        .eq('show_id', showId)
        .eq('archived', false)
        .neq('status', 'published')
        .select('id')
      if (error) return { error: error.message }
      if (!data || data.length === 0) return { error: CHANGED_WHILE_SCHEDULING }
      return { error: null }
    },
    undo: async () => {
      const { error } = await db
        .from('episodes')
        .update({
          status: slot.previous_status as (typeof EPISODE_STATUSES)[number],
          publish_at: slot.previous_publish_at,
        })
        .eq('id', slot.episodeId)
      return { error: error ? error.message : null }
    },
  }))
  steps.push({
    name: 'audit',
    run: () =>
      writeAudit(
        deps,
        {
          kind: 'bulk_schedule',
          outcome: 'committed',
          scheduled: slots.length,
          firstAirs: slots[0].publish_at,
          lastAirs: slots[slots.length - 1].publish_at,
          slots,
        },
        showId
      ),
  })

  const run = await runAndAudit(deps, showId, steps, {
    kind: 'bulk_schedule',
    scheduled: slots.length,
  })
  if (!run.ok) return fail(run.error, run.wrote)
  return { success: true, wrote: true, data: { showId, scheduled: slots.length } }
}

type Revert = {
  episodeId: string
  /** Value read just now; the conditional update only matches this. */
  readPublishAt: string
  toStatus: (typeof EPISODE_STATUSES)[number]
  toPublishAt: string | null
}

export async function unscheduleShowCore(
  db: AdminDb,
  deps: Omit<Deps, 'now'> & { now?: Date },
  showIdRaw: unknown
): Promise<CoreResult<Data>> {
  const parsed = parseId(showIdRaw, 'show')
  if (!parsed.ok) return { success: false, error: parsed.error, wrote: false }
  const showId = parsed.value
  const fail = (error: string, wrote = false): CoreResult<Data> => ({
    success: false,
    error,
    wrote,
    data: { showId, cleared: 0 },
  })

  const { data: records, error: recordError } = await db
    .from('admin_audit_log')
    .select('id, diff')
    .eq('action_type', 'update')
    .eq('entity_type', 'show')
    .eq('entity_id', showId)
    .eq('diff->>kind', 'bulk_schedule')
    .eq('diff->>outcome', 'committed')
    .order('created_at', { ascending: false })
    .limit(1)
  if (recordError) return fail(recordError.message)

  const record = records?.[0] as { id: string; diff: unknown } | undefined
  const reverts: Revert[] = []
  const skipped: { episodeId: string; reason: string }[] = []
  let source: 'record' | 'legacy'

  if (record) {
    source = 'record'
    const check = bulkScheduleRecordSchema.safeParse(record.diff)
    if (!check.success) {
      await writeAudit(
        deps,
        {
          kind: 'bulk_unschedule',
          outcome: 'failed',
          reason: 'unreadable record',
          record_id: record.id,
          issues: check.error.issues.map((i) => i.path.join('.')),
        },
        showId
      )
      return fail(UNREADABLE_RECORD)
    }
    const slots = check.data.slots
    const current = await readEpisodes(db, slots.map((s) => s.episodeId))
    if (current.error) return fail(current.error)
    for (const slot of slots) {
      const row = current.rows.get(slot.episodeId)
      let reason: string | null = null
      if (!row) reason = 'missing'
      else if (row.show_id !== showId) reason = 'moved'
      else if (row.archived) reason = 'archived'
      else if (row.status !== 'coming-soon') reason = 'status changed'
      else if (
        row.publish_at == null ||
        Date.parse(row.publish_at) !== Date.parse(slot.publish_at)
      )
        reason = 'publish_at changed'
      if (reason || !row || row.publish_at == null) {
        skipped.push({ episodeId: slot.episodeId, reason: reason ?? 'missing' })
        continue
      }
      reverts.push({
        episodeId: slot.episodeId,
        readPublishAt: row.publish_at,
        toStatus: slot.previous_status,
        toPublishAt: slot.previous_publish_at,
      })
    }
  } else {
    source = 'legacy'
    const { data, error } = await db
      .from('episodes')
      .select('id, publish_at')
      .eq('show_id', showId)
      .eq('archived', false)
      .eq('status', 'coming-soon')
      .not('publish_at', 'is', null)
    if (error) return fail(error.message)
    for (const r of (data ?? []) as { id: string; publish_at: string | null }[]) {
      if (r.publish_at == null) continue
      reverts.push({
        episodeId: r.id,
        readPublishAt: r.publish_at,
        toStatus: 'draft',
        toPublishAt: null,
      })
    }
  }

  const steps: WriteStep[] = reverts.map((rv) => ({
    name: `unschedule:${rv.episodeId}`,
    run: async () => {
      const { data, error } = await db
        .from('episodes')
        .update({ status: rv.toStatus, publish_at: rv.toPublishAt })
        .eq('id', rv.episodeId)
        .eq('show_id', showId)
        .eq('archived', false)
        .eq('status', 'coming-soon')
        .eq('publish_at', rv.readPublishAt)
        .select('id')
      if (error) return { error: error.message }
      if (!data || data.length === 0) return { error: CHANGED_WHILE_UNSCHEDULING }
      return { error: null }
    },
    undo: async () => {
      const { error } = await db
        .from('episodes')
        .update({ status: 'coming-soon', publish_at: rv.readPublishAt })
        .eq('id', rv.episodeId)
      return { error: error ? error.message : null }
    },
  }))
  steps.push({
    name: 'audit',
    run: () =>
      writeAudit(
        deps,
        {
          kind: 'bulk_unschedule',
          outcome: 'committed',
          source,
          ...(record ? { record_id: record.id } : {}),
          reverted: reverts.map((rv) => ({
            episodeId: rv.episodeId,
            from: { status: 'coming-soon', publish_at: rv.readPublishAt },
            to: { status: rv.toStatus, publish_at: rv.toPublishAt },
          })),
          skipped,
        },
        showId
      ),
  })

  const run = await runAndAudit(deps, showId, steps, {
    kind: 'bulk_unschedule',
    source,
    ...(record ? { record_id: record.id } : {}),
  })
  if (!run.ok) return fail(run.error, run.wrote)
  return {
    success: true,
    wrote: true,
    data: { showId, cleared: reverts.length },
  }
}
