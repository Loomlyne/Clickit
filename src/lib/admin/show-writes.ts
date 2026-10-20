// Show write cores: all-or-nothing category sync, archive-first permanent delete,
// audit row before the irreversible delete. No next/* imports: cache bumps and
// media listing stay in the actions.ts wrapper.
import {
  compensationAuditDiff,
  runAuditedDelete,
  runWithCompensation,
  type CompensationResult,
  type WriteStep,
} from './compensation.ts'
import { requireArchived } from './guards.ts'
import { parseDirection, parseId } from './schemas.ts'
import { getActiveShowNamespaceConflict } from './show-namespace.ts'
import type { Database } from '../database.types'
import type { AdminDb, AuditWriter, CoreResult } from './ports'

type Deps = { audit: AuditWriter; adminUserId: string }
type ShowInsert = Database['public']['Tables']['shows']['Insert']
type ShowUpdate = Database['public']['Tables']['shows']['Update']
type StepResult = { error: string | null }
type CategoryRow = { show_id: string; category_id: string; created_at: string }
type ShowData = { showId?: string; show?: Record<string, unknown> }

export type MediaDeletion = {
  commit(): Promise<boolean>
  rollback(): Promise<void>
}
type DeleteDeps = Deps & {
  media: { stage(showId: string): Promise<MediaDeletion[]> }
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

async function writeAudit(
  deps: Deps,
  action: 'create' | 'update',
  showId: string | null,
  diff: Record<string, unknown>
): Promise<StepResult> {
  try {
    return await deps.audit({
      adminUserId: deps.adminUserId,
      action,
      entity: 'show',
      entityId: showId,
      diff,
    })
  } catch (e) {
    return { error: errText(e) }
  }
}

async function conflictError(
  db: AdminDb,
  title: string,
  slug: string,
  excludeId?: string
): Promise<string | null> {
  const c = await getActiveShowNamespaceConflict(db, { title, slug, excludeId })
  if (c?.titleConflictTitle) return `An active show already uses the title "${title}".`
  if (c?.slugConflictTitle) return `An active show already uses the slug "${slug}".`
  return null
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

/** The delete-then-insert category replacement as undoable steps. */
function replaceShowCategoriesSteps(
  db: AdminDb,
  showId: string,
  previous: CategoryRow[],
  categoryIds: string[]
): WriteStep[] {
  const unique = [...new Set(categoryIds)]
  const steps: WriteStep[] = [
    {
      name: 'delete-categories',
      run: async () => {
        const { error } = await db.from('show_categories').delete().eq('show_id', showId)
        return { error: error?.message ?? null }
      },
      undo: async () => {
        if (previous.length === 0) return { error: null }
        const { error } = await db.from('show_categories').insert(previous)
        return { error: error?.message ?? null }
      },
    },
  ]
  steps.push(insertCategoriesStep(db, showId, unique))
  return steps
}

function insertCategoriesStep(db: AdminDb, showId: string, unique: string[]): WriteStep {
  return {
    name: 'insert-categories',
    run: async () => {
      if (unique.length === 0) return { error: null }
      const { error } = await db
        .from('show_categories')
        .insert(unique.map((category_id) => ({ show_id: showId, category_id })))
      return { error: error?.message ?? null }
    },
    undo: async () => {
      const { error } = await db.from('show_categories').delete().eq('show_id', showId)
      return { error: error?.message ?? null }
    },
  }
}

async function failedAudit(
  deps: Deps,
  action: 'create' | 'update',
  showId: string | null,
  result: CompensationResult,
  context: Record<string, unknown>
) {
  if (result.ok) return
  await writeAudit(deps, action, showId, compensationAuditDiff(result, context))
}

export async function createShowCore(
  db: AdminDb,
  deps: Deps,
  input: { insertData: Omit<ShowInsert, 'sort_order'>; categoryIds: string[] }
): Promise<CoreResult<ShowData>> {
  const { insertData, categoryIds } = input
  let showId: string | undefined = insertData.id
  if (insertData.id !== undefined) {
    const p = parseId(insertData.id, 'show')
    if (!p.ok) return { success: false, error: p.error, wrote: false }
  }
  try {
    const conflict = await conflictError(db, insertData.title, insertData.slug)
    if (conflict) return { success: false, error: conflict, wrote: false, data: { showId } }

    const { data: last, error: lastError } = await db
      .from('shows')
      .select('sort_order')
      .eq('archived', false)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lastError) return { success: false, error: lastError.message, wrote: false }

    let created: Record<string, unknown> | undefined
    const unique = [...new Set(categoryIds)]
    const context = {
      data: { title: insertData.title, slug: insertData.slug, status: insertData.status, category_ids: categoryIds },
    }
    const steps: WriteStep[] = [
      {
        name: 'insert-show',
        run: async () => {
          const { data, error } = await db
            .from('shows')
            .insert({ ...insertData, sort_order: (last?.sort_order ?? -1) + 1 })
            .select()
            .single()
          if (error) return { error: error.message }
          created = data
          showId = data.id
          return { error: null }
        },
        undo: async () => {
          if (!showId) return { error: null }
          const { error } = await db.from('shows').delete().eq('id', showId)
          return { error: error?.message ?? null }
        },
      },
      {
        name: 'insert-categories',
        run: async () => {
          if (unique.length === 0) return { error: null }
          const { error } = await db
            .from('show_categories')
            .insert(unique.map((category_id) => ({ show_id: showId!, category_id })))
          return { error: error?.message ?? null }
        },
        undo: async () => {
          const { error } = await db.from('show_categories').delete().eq('show_id', showId!)
          return { error: error?.message ?? null }
        },
      },
      {
        name: 'audit',
        run: () =>
          writeAudit(deps, 'create', showId ?? null, { outcome: 'committed', ...context }),
      },
    ]
    const result = await runWithCompensation(steps)
    if (!result.ok) {
      await failedAudit(deps, 'create', showId ?? null, result, context)
      return { success: false, error: result.error, wrote: result.wrote, data: { showId } }
    }
    return { success: true, wrote: true, data: { showId, show: created } }
  } catch (e) {
    return { success: false, error: errText(e), wrote: false, data: { showId } }
  }
}

export async function updateShowCore(
  db: AdminDb,
  deps: Deps,
  input: {
    id: unknown
    updateData: ShowUpdate & { title: string; slug: string }
    categoryIds: string[]
  }
): Promise<CoreResult<ShowData>> {
  const parsed = parseId(input.id, 'show')
  if (!parsed.ok) return { success: false, error: parsed.error, wrote: false }
  const id = parsed.value
  const { updateData, categoryIds } = input
  const refuse = (error: string): CoreResult<ShowData> => ({
    success: false,
    error,
    wrote: false,
    data: { showId: id },
  })
  try {
    const keys = Object.keys(updateData)
    const { data: current, error: currentError } = await db
      .from('shows')
      .select(['archived', ...keys].join(', '))
      .eq('id', id)
      .maybeSingle()
    if (currentError) return refuse(currentError.message)
    if (!current) return refuse('Show not found.')
    const before = current as unknown as Record<string, unknown>
    if (before.archived === true) return refuse('Restore this show before editing it.')

    const conflict = await conflictError(db, updateData.title, updateData.slug, id)
    if (conflict) return refuse(conflict)

    const { data: prevRows, error: prevError } = await db
      .from('show_categories')
      .select('show_id, category_id, created_at')
      .eq('show_id', id)
    if (prevError) return refuse(prevError.message)
    const previous = (prevRows ?? []) as CategoryRow[]

    const previousValues: Record<string, unknown> = {}
    for (const k of keys) previousValues[k] = before[k]
    const unique = [...new Set(categoryIds)]
    const context = {
      changed: [...keys, 'category_ids'],
      title: updateData.title,
      category_ids: { before: previous.map((r) => r.category_id), after: unique },
    }

    let updated: Record<string, unknown> | undefined
    const steps: WriteStep[] = [
      {
        name: 'update-show',
        run: async () => {
          const { data, error } = await db
            .from('shows')
            .update(updateData)
            .eq('id', id)
            .select()
            .single()
          if (error) return { error: error.message }
          updated = data
          return { error: null }
        },
        undo: async () => {
          const { error } = await db
            .from('shows')
            .update(previousValues as ShowUpdate)
            .eq('id', id)
          return { error: error?.message ?? null }
        },
      },
      ...replaceShowCategoriesSteps(db, id, previous, unique),
      {
        name: 'audit',
        run: () => writeAudit(deps, 'update', id, { outcome: 'committed', ...context }),
      },
    ]
    const result = await runWithCompensation(steps)
    if (!result.ok) {
      await failedAudit(deps, 'update', id, result, context)
      return { success: false, error: result.error, wrote: result.wrote, data: { showId: id } }
    }
    return { success: true, wrote: true, data: { showId: id, show: updated } }
  } catch (e) {
    return refuse(errText(e))
  }
}

export async function deleteShowCore(
  db: AdminDb,
  deps: DeleteDeps,
  id: unknown
): Promise<CoreResult<ShowData>> {
  const parsed = parseId(id, 'show')
  if (!parsed.ok) return { success: false, error: parsed.error, wrote: false }
  const showId = parsed.value
  const data = { showId }
  const refuse = (error: string): CoreResult<ShowData> => ({
    success: false,
    error,
    wrote: false,
    data,
  })

  const { data: row, error: rowError } = await db
    .from('shows')
    .select('title, slug, archived')
    .eq('id', showId)
    .maybeSingle()
  if (rowError) return refuse(rowError.message)
  const guard = requireArchived(row, 'show')
  if (!guard.ok) return refuse(guard.error)

  let staged: MediaDeletion[] = []
  try {
    staged = await deps.media.stage(showId)
  } catch (e) {
    await Promise.all(staged.map((d) => d.rollback()))
    return refuse(errText(e))
  }
  const rollbackAll = () => Promise.all(staged.map((d) => d.rollback().catch(() => undefined)))

  let deleted = false
  const outcome = await runAuditedDelete({
    audit: deps.audit,
    adminUserId: deps.adminUserId,
    action: 'delete',
    entity: 'show',
    entityId: showId,
    context: { title: row!.title, slug: row!.slug },
    steps: [
      {
        name: 'delete-show',
        run: async () => {
          const res = await db
            .from('shows')
            .delete()
            .eq('id', showId)
            .eq('archived', true)
            .select('id')
          const r = oneRow(res, 'delete show')
          if (!r.error) deleted = true
          return r
        },
      },
    ],
  })

  if (deleted) {
    // The show is gone, so its files must go too, even if the closing audit row failed.
    await Promise.all(staged.map((d) => d.commit().catch(() => false)))
    return outcome.ok
      ? { success: true, wrote: true, data }
      : { success: false, error: outcome.error, wrote: true, data }
  }
  await rollbackAll()
  return {
    success: false,
    error: outcome.error ?? 'Delete failed.',
    wrote: outcome.wrote,
    data,
  }
}

type OrderRow = { id: string; title: string; sort_order: number; created_at: string }
// Same order as the SQL (sort_order asc, created_at desc), applied in memory too.
function sortShows(rows: OrderRow[]): OrderRow[] {
  return [...rows].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
  )
}

export async function reorderShowCore(
  db: AdminDb,
  deps: Deps,
  input: { id: unknown; direction: unknown }
): Promise<CoreResult<ShowData>> {
  const idP = parseId(input.id, 'show')
  if (!idP.ok) return { success: false, error: idP.error, wrote: false }
  const dirP = parseDirection(input.direction)
  const id = idP.value
  const refuse = (error: string): CoreResult<ShowData> => ({
    success: false,
    error,
    wrote: false,
    data: { showId: id },
  })
  if (!dirP.ok) return refuse(dirP.error)
  const direction = dirP.value

  try {
    const { data: shows, error: fetchError } = await db
      .from('shows')
      .select('id, title, sort_order, created_at')
      .eq('archived', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
    if (fetchError) return refuse(fetchError.message)
    const list = sortShows(shows ?? [])
    const i = list.findIndex((s) => s.id === id)
    const j = direction === 'up' ? i - 1 : i + 1
    if (i < 0 || j < 0 || j >= list.length) return refuse('No show to swap with')
    const cur = list[i]!
    const adj = list[j]!

    const setOrder = async (rowId: string, n: number): Promise<StepResult> =>
      oneRow(
        await db.from('shows').update({ sort_order: n }).eq('id', rowId).select('id'),
        'reorder show'
      )
    const context = {
      direction,
      swapped_with: adj.id,
      ordered_titles: [cur.title, adj.title],
    }
    const result = await runWithCompensation([
      {
        name: 'move-current',
        run: () => setOrder(cur.id, adj.sort_order),
        undo: () => setOrder(cur.id, cur.sort_order),
      },
      {
        name: 'move-adjacent',
        run: () => setOrder(adj.id, cur.sort_order),
        undo: () => setOrder(adj.id, adj.sort_order),
      },
      {
        name: 'audit',
        run: () => writeAudit(deps, 'update', id, { outcome: 'committed', ...context }),
      },
    ])
    if (!result.ok) {
      await failedAudit(deps, 'update', id, result, context)
      return { success: false, error: result.error, wrote: result.wrote, data: { showId: id } }
    }
    return { success: true, wrote: true, data: { showId: id } }
  } catch (e) {
    return refuse(errText(e))
  }
}
