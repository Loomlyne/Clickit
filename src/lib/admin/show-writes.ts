// Show write cores (legacy port, plan 01.1-06 task 1). No next/* imports.
import { getActiveShowNamespaceConflict } from './show-namespace.ts'
import type { Database } from '../database.types'
import type { AdminDb, AuditWriter, CoreResult } from './ports'

type Deps = { audit: AuditWriter; adminUserId: string }
type ShowInsert = Database['public']['Tables']['shows']['Insert']
type ShowUpdate = Database['public']['Tables']['shows']['Update']
export type MediaDeletion = {
  commit(): Promise<boolean>
  rollback(): Promise<void>
}
type DeleteDeps = Deps & {
  media: { stage(showId: string): Promise<MediaDeletion[]> }
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

async function syncCategories(db: AdminDb, showId: string, categoryIds: string[]) {
  const unique = [...new Set(categoryIds)]
  const { error: delErr } = await db.from('show_categories').delete().eq('show_id', showId)
  if (delErr) throw new Error(delErr.message)
  if (unique.length === 0) return
  const { error: insErr } = await db
    .from('show_categories')
    .insert(unique.map((category_id) => ({ show_id: showId, category_id })))
  if (insErr) throw new Error(insErr.message)
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

export async function createShowCore(
  db: AdminDb,
  deps: Deps,
  input: { insertData: Omit<ShowInsert, 'sort_order'>; categoryIds: string[] }
): Promise<CoreResult<{ showId?: string }>> {
  try {
    const { insertData, categoryIds } = input
    const conflict = await conflictError(db, insertData.title, insertData.slug)
    if (conflict) return { success: false, error: conflict, wrote: false }
    const { data: last } = await db
      .from('shows')
      .select('sort_order')
      .eq('archived', false)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const { data: show, error } = await db
      .from('shows')
      .insert({ ...insertData, sort_order: (last?.sort_order ?? -1) + 1 })
      .select()
      .single()
    if (error) return { success: false, error: error.message, wrote: false }
    await syncCategories(db, show.id, categoryIds)
    await deps.audit({
      adminUserId: deps.adminUserId,
      action: 'create',
      entity: 'show',
      entityId: show.id,
      diff: {
        data: { title: show.title, slug: show.slug, status: show.status, category_ids: categoryIds },
      },
    })
    return { success: true, wrote: true, data: { showId: show.id } }
  } catch (e) {
    return { success: false, error: errText(e) }
  }
}

export async function updateShowCore(
  db: AdminDb,
  deps: Deps,
  input: { id: string; updateData: ShowUpdate & { title: string; slug: string }; categoryIds: string[] }
): Promise<CoreResult<{ showId?: string }>> {
  try {
    const { id, updateData, categoryIds } = input
    const conflict = await conflictError(db, updateData.title, updateData.slug, id)
    if (conflict) return { success: false, error: conflict, wrote: false }
    const { data: show, error } = await db
      .from('shows')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    if (error) return { success: false, error: error.message, wrote: false }
    await syncCategories(db, id, categoryIds)
    await deps.audit({
      adminUserId: deps.adminUserId,
      action: 'update',
      entity: 'show',
      entityId: id,
      diff: { changed: [...Object.keys(updateData), 'category_ids'], title: show.title },
    })
    return { success: true, wrote: true, data: { showId: id } }
  } catch (e) {
    return { success: false, error: errText(e) }
  }
}

export async function deleteShowCore(
  db: AdminDb,
  deps: DeleteDeps,
  id: unknown
): Promise<CoreResult<{ showId?: string }>> {
  try {
    const showId = id as string
    const { data: row } = await db.from('shows').select('title, slug').eq('id', showId).single()
    const staged: MediaDeletion[] = []
    try {
      staged.push(...(await deps.media.stage(showId)))
    } catch (e) {
      await Promise.all(staged.map((d) => d.rollback()))
      throw e
    }
    const { error } = await db.from('shows').delete().eq('id', showId)
    if (error) {
      await Promise.all(staged.map((d) => d.rollback()))
      return { success: false, error: error.message }
    }
    await Promise.all(staged.map((d) => d.commit()))
    await deps.audit({
      adminUserId: deps.adminUserId,
      action: 'delete',
      entity: 'show',
      entityId: showId,
      diff: { title: row?.title, slug: row?.slug },
    })
    return { success: true, data: { showId } }
  } catch (e) {
    return { success: false, error: errText(e) }
  }
}

type OrderRow = { id: string; title: string; sort_order: number; created_at?: string }
// Same order as the SQL (sort_order asc, created_at desc), applied in memory too.
function sortShows<T extends OrderRow>(rows: T[]): T[] {
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
): Promise<CoreResult<{ showId?: string }>> {
  try {
    const id = input.id as string
    const direction = input.direction as 'up' | 'down'
    const { data: shows, error: fetchError } = await db
      .from('shows')
      .select('id, title, sort_order, created_at')
      .eq('archived', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
    if (fetchError) return { success: false, error: fetchError.message }
    const list = sortShows(shows ?? [])
    const i = list.findIndex((s) => s.id === id)
    const j = direction === 'up' ? i - 1 : i + 1
    if (i < 0 || j < 0 || j >= list.length) return { success: false, error: 'No show to swap with' }
    const cur = list[i]!
    const adj = list[j]!
    const [a, b] = await Promise.all([
      db.from('shows').update({ sort_order: adj.sort_order }).eq('id', cur.id),
      db.from('shows').update({ sort_order: cur.sort_order }).eq('id', adj.id),
    ])
    const err = a.error ?? b.error
    if (err) return { success: false, error: err.message }
    await deps.audit({
      adminUserId: deps.adminUserId,
      action: 'update',
      entity: 'show',
      entityId: id,
      diff: { direction, swapped_with: adj.id, ordered_titles: [cur.title, adj.title] },
    })
    return { success: true, data: { showId: id } }
  } catch (e) {
    return { success: false, error: errText(e) }
  }
}
