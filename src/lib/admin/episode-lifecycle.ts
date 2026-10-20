// Episode lifecycle cores (legacy port; hardened in the next commit).
// No next/* imports: revalidation stays in the actions.ts wrapper.
import { parseId } from './schemas.ts'
import type { AdminDb, AuditWriter, CoreResult } from './ports'

type Deps = { audit: AuditWriter; adminUserId: string }
type Data = { showId?: string }

export async function archiveEpisodeCore(
  db: AdminDb,
  _deps: Deps,
  id: unknown,
  showId: unknown
): Promise<CoreResult<Data>> {
  const { error } = await db
    .from('episodes')
    .update({ archived: true })
    .eq('id', id as string)
  if (error) return { success: false, error: error.message }
  const { count } = await db
    .from('episodes')
    .select('*', { count: 'exact', head: true })
    .eq('show_id', showId as string)
    .eq('archived', false)
  await db
    .from('shows')
    .update({ episode_count: count ?? 0 })
    .eq('id', showId as string)
  return { success: true, wrote: true, data: { showId: showId as string } }
}

export async function restoreEpisodeCore(
  db: AdminDb,
  deps: Deps,
  id: unknown
): Promise<CoreResult<Data>> {
  const parsed = parseId(id, 'episode')
  if (!parsed.ok) return { success: false, error: parsed.error }
  const { data: ep, error: fetchError } = await db
    .from('episodes')
    .select('id, show_id, title')
    .eq('id', parsed.value)
    .single()
  if (fetchError || !ep) return { success: false, error: 'Episode not found' }
  const { error } = await db
    .from('episodes')
    .update({ archived: false })
    .eq('id', parsed.value)
  if (error) return { success: false, error: error.message }
  const { count } = await db
    .from('episodes')
    .select('*', { count: 'exact', head: true })
    .eq('show_id', ep.show_id)
    .eq('archived', false)
  await db.from('shows').update({ episode_count: count ?? 0 }).eq('id', ep.show_id)
  await deps.audit({
    adminUserId: deps.adminUserId,
    action: 'restore',
    entity: 'episode',
    entityId: parsed.value,
    diff: { id: parsed.value, title: ep.title },
  })
  return { success: true, wrote: true, data: { showId: ep.show_id } }
}

export async function deleteEpisodePermanentlyCore(
  db: AdminDb,
  deps: Deps,
  id: unknown
): Promise<CoreResult<Data>> {
  const parsed = parseId(id, 'episode')
  if (!parsed.ok) return { success: false, error: parsed.error }
  const { data: ep } = await db
    .from('episodes')
    .select('title, show_id')
    .eq('id', parsed.value)
    .single()
  const { error } = await db.from('episodes').delete().eq('id', parsed.value)
  if (error) return { success: false, error: error.message }
  if (ep?.show_id) {
    const { count } = await db
      .from('episodes')
      .select('*', { count: 'exact', head: true })
      .eq('show_id', ep.show_id)
      .eq('archived', false)
    await db.from('shows').update({ episode_count: count ?? 0 }).eq('id', ep.show_id)
  }
  await deps.audit({
    adminUserId: deps.adminUserId,
    action: 'delete',
    entity: 'episode',
    entityId: parsed.value,
    diff: { id: parsed.value, title: ep?.title },
  })
  return { success: true, wrote: true, data: { showId: ep?.show_id } }
}

export async function reorderEpisodeCore(
  db: AdminDb,
  _deps: Deps,
  id: unknown,
  direction: unknown
): Promise<CoreResult<Data>> {
  const { data: current, error: fetchError } = await db
    .from('episodes')
    .select('id, episode_number, season_id, show_id')
    .eq('id', id as string)
    .single()
  if (fetchError || !current) return { success: false, error: 'Episode not found' }
  const adjacentNumber =
    direction === 'up' ? current.episode_number - 1 : current.episode_number + 1
  const { data: adjacent, error: adjError } = await db
    .from('episodes')
    .select('id, episode_number')
    .eq('season_id', current.season_id)
    .eq('episode_number', adjacentNumber)
    .single()
  if (adjError || !adjacent)
    return { success: false, error: 'No adjacent episode to swap with' }
  await db.from('episodes').update({ episode_number: -1 }).eq('id', current.id)
  await db
    .from('episodes')
    .update({ episode_number: current.episode_number })
    .eq('id', adjacent.id)
  await db
    .from('episodes')
    .update({ episode_number: adjacent.episode_number })
    .eq('id', current.id)
  return { success: true, wrote: true, data: { showId: current.show_id } }
}
