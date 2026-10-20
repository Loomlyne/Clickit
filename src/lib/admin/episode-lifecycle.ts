// Episode lifecycle cores: archive-first audited permanent delete (pending row
// before, terminal row after), reorder through the atomic public.reorder_episode
// database function (migration 20260724115941), checked and archived-aware counts.
// No next/* imports: revalidation stays in the actions.ts wrapper.
import {
  compensationAuditDiff,
  runAuditedDelete,
  runWithCompensation,
  type CompensationResult,
  type WriteStep,
} from './compensation.ts'
import { recomputeSeasonEpisodeCount, recomputeShowCounts } from './counts.ts'
import { requireArchived } from './guards.ts'
import { parseDirection, parseId } from './schemas.ts'
import type { AdminDb, AuditWriter, CoreResult } from './ports'

type Deps = { audit: AuditWriter; adminUserId: string }
type Data = { showId?: string }
type StepResult = { error: string | null }
type Direction = 'up' | 'down'

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

async function writeAudit(
  deps: Deps,
  entry: Omit<Parameters<AuditWriter>[0], 'adminUserId'>
): Promise<StepResult> {
  try {
    return await deps.audit({ adminUserId: deps.adminUserId, ...entry })
  } catch (e) {
    return { error: errText(e) }
  }
}

async function recomputeAll(
  db: AdminDb,
  showId: string,
  seasonId: string | null
): Promise<StepResult> {
  if (seasonId) {
    const s = await recomputeSeasonEpisodeCount(db, seasonId)
    if (s.error) return s
  }
  return recomputeShowCounts(db, showId)
}

function failMessage(result: CompensationResult): string {
  if (result.ok) return ''
  if (result.leftInPlace.length === 0) return result.error
  const left = result.leftInPlace.map((l) => l.step).join(', ')
  return `${result.error} (could not undo: ${left})`
}

type EpisodeRow = {
  id: string
  show_id: string
  season_id: string | null
  title: string
  archived: boolean
}

async function readEpisode(
  db: AdminDb,
  id: string
): Promise<{ row: EpisodeRow | null; error: string | null }> {
  const { data, error } = await db
    .from('episodes')
    .select('id, show_id, season_id, title, archived')
    .eq('id', id)
    .maybeSingle()
  if (error) return { row: null, error: error.message }
  return { row: (data as EpisodeRow | null) ?? null, error: null }
}

function setArchived(db: AdminDb, id: string, archived: boolean): () => Promise<StepResult> {
  return async () => {
    const { error } = await db.from('episodes').update({ archived }).eq('id', id)
    return { error: error ? error.message : null }
  }
}

/** Reverts the archived flag and refreshes the counts it touched. */
function revertArchived(
  db: AdminDb,
  row: EpisodeRow,
  archived: boolean
): () => Promise<StepResult> {
  return async () => {
    const flip = await setArchived(db, row.id, archived)()
    if (flip.error) return flip
    return recomputeAll(db, row.show_id, row.season_id)
  }
}

export async function archiveEpisodeCore(
  db: AdminDb,
  deps: Deps,
  id: unknown,
  showId: unknown
): Promise<CoreResult<Data>> {
  const pid = parseId(id, 'episode')
  if (!pid.ok) return { success: false, error: pid.error }
  const psh = parseId(showId, 'show')
  if (!psh.ok) return { success: false, error: psh.error }

  const { row, error } = await readEpisode(db, pid.value)
  if (error) return { success: false, error }
  if (!row) return { success: false, error: 'Episode not found.' }
  if (row.archived) return { success: false, error: 'Episode is already archived.' }
  if (row.show_id !== psh.value)
    return { success: false, error: 'Episode does not belong to this show.' }

  const context = { id: row.id, title: row.title, show_id: row.show_id, season_id: row.season_id }
  const result = await runWithCompensation([
    {
      name: 'archive-episode',
      run: setArchived(db, row.id, true),
      undo: revertArchived(db, row, false),
    },
    { name: 'recompute-counts', run: () => recomputeAll(db, row.show_id, row.season_id) },
    {
      name: 'audit',
      run: () =>
        writeAudit(deps, { action: 'archive', entity: 'episode', entityId: row.id, diff: context }),
    },
  ])
  if (!result.ok) {
    await writeAudit(deps, {
      action: 'archive',
      entity: 'episode',
      entityId: row.id,
      diff: compensationAuditDiff(result, context),
    })
    return {
      success: false,
      error: failMessage(result),
      wrote: result.wrote,
      data: { showId: row.show_id },
    }
  }
  return { success: true, wrote: true, data: { showId: row.show_id } }
}

export async function restoreEpisodeCore(
  db: AdminDb,
  deps: Deps,
  id: unknown
): Promise<CoreResult<Data>> {
  const pid = parseId(id, 'episode')
  if (!pid.ok) return { success: false, error: pid.error }

  const { row, error } = await readEpisode(db, pid.value)
  if (error) return { success: false, error }
  if (!row) return { success: false, error: 'Episode not found.' }

  // The unique (season_id, episode_number) constraint covers archived rows too,
  // so un-archiving can never collide.
  const context = { id: row.id, title: row.title, show_id: row.show_id, season_id: row.season_id }
  const result = await runWithCompensation([
    {
      name: 'restore-episode',
      run: setArchived(db, row.id, false),
      undo: revertArchived(db, row, true),
    },
    { name: 'recompute-counts', run: () => recomputeAll(db, row.show_id, row.season_id) },
    {
      name: 'audit',
      run: () =>
        writeAudit(deps, {
          action: 'restore',
          entity: 'episode',
          entityId: row.id,
          diff: { id: row.id, title: row.title },
        }),
    },
  ])
  if (!result.ok) {
    await writeAudit(deps, {
      action: 'restore',
      entity: 'episode',
      entityId: row.id,
      diff: compensationAuditDiff(result, context),
    })
    return {
      success: false,
      error: failMessage(result),
      wrote: result.wrote,
      data: { showId: row.show_id },
    }
  }
  return { success: true, wrote: true, data: { showId: row.show_id } }
}

export async function deleteEpisodePermanentlyCore(
  db: AdminDb,
  deps: Deps,
  id: unknown
): Promise<CoreResult<Data>> {
  const pid = parseId(id, 'episode')
  if (!pid.ok) return { success: false, error: pid.error }

  const { row, error } = await readEpisode(db, pid.value)
  if (error) return { success: false, error }
  const guard = requireArchived(row, 'episode')
  if (!guard.ok || !row) return { success: false, error: guard.ok ? 'Episode not found.' : guard.error }

  const context = { id: row.id, title: row.title, show_id: row.show_id, season_id: row.season_id }
  let countError: string | null = null
  const steps: WriteStep[] = [
    {
      name: 'delete-episode',
      run: async () => {
        // CASCADE handles watch progress / likes tied to the episode.
        const { data, error: delError } = await db
          .from('episodes')
          .delete()
          .eq('id', row.id)
          .eq('archived', true)
          .select('id')
        if (delError) return { error: delError.message }
        if (!data || data.length !== 1)
          return { error: 'Episode was not deleted (it is no longer archived).' }
        return { error: null }
      },
    },
    {
      name: 'recompute-counts',
      run: async () => {
        const res = await recomputeAll(db, row.show_id, row.season_id)
        countError = res.error
        return res
      },
    },
  ]
  const res = await runAuditedDelete({
    audit: deps.audit,
    adminUserId: deps.adminUserId,
    action: 'delete',
    entity: 'episode',
    entityId: row.id,
    context,
    steps,
  })
  const data = { showId: row.show_id }
  if (!res.ok) {
    const error = countError
      ? `Episode deleted, but counts could not be updated: ${countError}`
      : (res.error ?? 'Failed to delete episode.')
    return { success: false, error, wrote: res.wrote, data }
  }
  return { success: true, wrote: true, data }
}

type RpcError = { message: string; refusal: boolean }
type RpcRow = { show_id: string; season_id: string; episode_id: string; episode_number: number }
type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>
  ) => Promise<{
    data: RpcRow[] | null
    error: { code?: string; message?: string } | null
  }>
}

function mapRpcError(err: { code?: string; message?: string }): RpcError {
  const message = err.message ?? ''
  if (err.code === '22023') return { message: 'Invalid direction.', refusal: true }
  if (err.code === 'P0002') return { message: 'Episode not found.', refusal: true }
  if (err.code === 'P0001') {
    if (message.startsWith('Archived episodes cannot be reordered'))
      return { message: 'Archived episodes cannot be reordered.', refusal: true }
    if (message.startsWith('No adjacent active episode'))
      return { message: 'No adjacent episode to swap with', refusal: true }
    return { message, refusal: true }
  }
  if (err.code === 'PGRST202' || err.code === '42883')
    return {
      message:
        'Episode reordering needs database migration 20260724115941 (function public.reorder_episode is missing).',
      refusal: false,
    }
  return { message: message || 'Reorder failed.', refusal: false }
}

/** The one place that calls the database function; the cast is needed because
 *  database.types.ts does not list it. */
export async function callReorderEpisodeRpc(
  db: AdminDb,
  episodeId: string,
  direction: Direction
): Promise<{ row: RpcRow | null; error: RpcError | null }> {
  const client = db as unknown as RpcClient
  const { data, error } = await client.rpc('reorder_episode', {
    p_episode_id: episodeId,
    p_direction: direction,
  })
  if (error) return { row: null, error: mapRpcError(error) }
  return { row: data?.[0] ?? null, error: null }
}

export async function reorderEpisodeCore(
  db: AdminDb,
  deps: Deps,
  id: unknown,
  direction: unknown
): Promise<CoreResult<Data>> {
  const pid = parseId(id, 'episode')
  if (!pid.ok) return { success: false, error: pid.error }
  const pdir = parseDirection(direction)
  if (!pdir.ok) return { success: false, error: pdir.error }
  const dir = pdir.value
  const opposite: Direction = dir === 'up' ? 'down' : 'up'

  const { data: current, error: readError } = await db
    .from('episodes')
    .select('id, show_id, season_id, episode_number, archived')
    .eq('id', pid.value)
    .maybeSingle()
  if (readError) return { success: false, error: readError.message }
  if (!current) return { success: false, error: 'Episode not found.' }
  if (current.archived)
    return { success: false, error: 'Archived episodes cannot be reordered.' }

  const data = { showId: current.show_id }
  const from = current.episode_number
  let to: number | null = null
  let swapRefusal = false

  const result = await runWithCompensation([
    {
      name: 'swap',
      run: async () => {
        const res = await callReorderEpisodeRpc(db, current.id, dir)
        if (res.error) {
          swapRefusal = res.error.refusal
          return { error: res.error.message }
        }
        to = res.row?.episode_number ?? null
        return { error: null }
      },
      undo: async () => {
        const back = await callReorderEpisodeRpc(db, current.id, opposite)
        if (back.error) return { error: back.error.message }
        const { data: now, error: nowError } = await db
          .from('episodes')
          .select('episode_number')
          .eq('id', current.id)
          .maybeSingle()
        if (nowError) return { error: nowError.message }
        if (now?.episode_number !== from)
          return {
            error: `Swap could not be reversed; episode now holds ${now?.episode_number ?? 'unknown'}`,
          }
        return { error: null }
      },
    },
    {
      name: 'audit',
      run: async () => {
        const { data: other, error: otherError } = await db
          .from('episodes')
          .select('id')
          .eq('season_id', current.season_id)
          .eq('episode_number', from)
          .neq('id', current.id)
          .maybeSingle()
        if (otherError) return { error: otherError.message }
        return writeAudit(deps, {
          action: 'update',
          entity: 'episode',
          entityId: current.id,
          diff: { kind: 'reorder', direction: dir, swapped_with: other?.id ?? null, from, to },
        })
      },
    },
  ])

  if (result.ok) return { success: true, wrote: true, data }

  // The function raised before writing: nothing to record or revalidate.
  if (result.failedStep === 'swap' && swapRefusal)
    return { success: false, error: result.error, wrote: false, data }

  const failedAudit = await writeAudit(deps, {
    action: 'update',
    entity: 'episode',
    entityId: current.id,
    diff: compensationAuditDiff(result, { kind: 'reorder', direction: dir, from, to }),
  })

  let error = result.error
  if (result.failedStep === 'audit') {
    error =
      result.leftInPlace.length > 0
        ? `The reorder audit record could not be written and the swap was left in place (${failMessage(result)}).`
        : `The reorder audit record could not be written, so the swap was reversed: ${result.error}`
  }
  if (failedAudit.error)
    error += ` (the failure audit row also failed: ${failedAudit.error})`
  return { success: false, error, wrote: true, data }
}
