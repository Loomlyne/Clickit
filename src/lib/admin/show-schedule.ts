// Bulk scheduling cores (legacy port, hardened in the next commit).
// No next/* imports: revalidation stays in the actions.ts wrapper.
import { nextBroadcastSlots } from '../scheduling.ts'
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
}

type Deps = {
  audit: AuditWriter
  adminUserId: string
  now: Date
  planOverride?: PlannedEpisodeSlot[]
}

export async function planShowScheduleCore(
  db: AdminDb,
  showId: string,
  now: Date
): Promise<
  { ok: false; error: string } | { ok: true; plan: PlannedEpisodeSlot[] }
> {
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
      db
        .from('episodes')
        .select('id, title, episode_number, season_id, youtube_video_id')
        .eq('show_id', showId)
        .eq('archived', false)
        .neq('status', 'published'),
      db.from('seasons').select('id, season_number').eq('show_id', showId),
    ])
  if (epError) return { ok: false, error: epError.message }

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
    })),
  }
}

export async function applyShowScheduleCore(
  db: AdminDb,
  deps: Deps,
  showIdRaw: unknown
): Promise<CoreResult<{ showId?: string; scheduled?: number }>> {
  const parsed = parseId(showIdRaw, 'show')
  if (!parsed.ok) return { success: false, error: parsed.error, wrote: false }
  const showId = parsed.value

  let plan = deps.planOverride
  if (!plan) {
    const result = await planShowScheduleCore(db, showId, deps.now)
    if (!result.ok) return { success: false, error: result.error, wrote: false, data: { showId } }
    plan = result.plan
  }
  if (plan.length === 0) {
    return { success: false, error: 'No unpublished episodes to schedule.', wrote: false, data: { showId } }
  }

  for (const slot of plan) {
    const { error } = await db
      .from('episodes')
      .update({ status: 'coming-soon', publish_at: slot.publishAt })
      .eq('id', slot.episodeId)
    if (error) return { success: false, error: error.message, wrote: true, data: { showId } }
  }

  await deps.audit({
    adminUserId: deps.adminUserId,
    action: 'update',
    entity: 'show',
    entityId: showId,
    diff: {
      scheduled: plan.length,
      firstAirs: plan[0]?.publishAt,
      lastAirs: plan[plan.length - 1]?.publishAt,
    },
  })
  return { success: true, wrote: true, data: { showId, scheduled: plan.length } }
}

export async function unscheduleShowCore(
  db: AdminDb,
  deps: Omit<Deps, 'now'> & { now?: Date },
  showIdRaw: unknown
): Promise<CoreResult<{ showId?: string; cleared?: number }>> {
  const parsed = parseId(showIdRaw, 'show')
  if (!parsed.ok) return { success: false, error: parsed.error, wrote: false }
  const showId = parsed.value

  const { data: cleared, error } = await db
    .from('episodes')
    .update({ status: 'draft', publish_at: null })
    .eq('show_id', showId)
    .eq('archived', false)
    .eq('status', 'coming-soon')
    .not('publish_at', 'is', null)
    .select('id')
  if (error) return { success: false, error: error.message, wrote: true, data: { showId } }

  await deps.audit({
    adminUserId: deps.adminUserId,
    action: 'update',
    entity: 'show',
    entityId: showId,
    diff: { unscheduled: cleared?.length ?? 0 },
  })
  return { success: true, wrote: true, data: { showId, cleared: cleared?.length ?? 0 } }
}
