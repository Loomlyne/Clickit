// Season and episode write cores (legacy port; fixed in the next commit).
import { episodeSchema, seasonSchema } from './schemas.ts'
import type { AdminDb, ArabicFill, AuditWriter, CoreResult } from './ports'

type Deps = { audit: AuditWriter; adminUserId: string; fillArabic: ArabicFill }
type Obj = Record<string, unknown>

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))

export async function createSeasonCore(db: AdminDb, deps: Deps, data: unknown): Promise<CoreResult> {
  try {
    const parsed = seasonSchema.parse(data)
    parsed.title_ar = await deps.fillArabic(parsed.title, parsed.title_ar)
    const { data: season, error } = await db.from('seasons').insert(parsed as never).select().single()
    if (error) return { success: false, error: error.message }
    const { count } = await db.from('seasons').select('*', { count: 'exact', head: true }).eq('show_id', parsed.show_id)
    await db.from('shows').update({ season_count: count ?? 0 }).eq('id', parsed.show_id)
    return { success: true, data: season }
  } catch (err) {
    return { success: false, error: msg(err) }
  }
}

export async function updateSeasonCore(db: AdminDb, deps: Deps, id: unknown, data: unknown): Promise<CoreResult> {
  try {
    const patch = data as Obj
    if (patch.title && !String(patch.title_ar ?? '').trim()) {
      patch.title_ar = await deps.fillArabic(String(patch.title), null)
    }
    const { data: season, error } = await db.from('seasons').update(patch as never).eq('id', id as string).select().single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: season }
  } catch (err) {
    return { success: false, error: msg(err) }
  }
}

export async function deleteSeasonCore(db: AdminDb, deps: Deps, id: unknown, showId: unknown): Promise<CoreResult> {
  void deps
  try {
    const { error } = await db.from('seasons').delete().eq('id', id as string)
    if (error) return { success: false, error: error.message }
    const { count } = await db.from('seasons').select('*', { count: 'exact', head: true }).eq('show_id', showId as string)
    await db.from('shows').update({ season_count: count ?? 0 }).eq('id', showId as string)
    const { count: epCount } = await db.from('episodes').select('*', { count: 'exact', head: true }).eq('show_id', showId as string)
    await db.from('shows').update({ episode_count: epCount ?? 0 }).eq('id', showId as string)
    return { success: true }
  } catch (err) {
    return { success: false, error: msg(err) }
  }
}

export async function createEpisodeCore(db: AdminDb, deps: Deps, data: unknown): Promise<CoreResult> {
  try {
    const parsed = episodeSchema.parse(data)
    parsed.title_ar = await deps.fillArabic(parsed.title, parsed.title_ar)
    parsed.description_ar = await deps.fillArabic(parsed.description, parsed.description_ar)
    const { data: archivedConflict } = await db.from('episodes').select('id')
      .eq('season_id', parsed.season_id).eq('episode_number', parsed.episode_number).eq('archived', true).maybeSingle()
    if (archivedConflict) {
      const { data: maxRow } = await db.from('episodes').select('episode_number')
        .eq('season_id', parsed.season_id).order('episode_number', { ascending: false }).limit(1).single()
      await db.from('episodes').update({ episode_number: (maxRow?.episode_number ?? 0) + 1 }).eq('id', archivedConflict.id)
    }
    const { data: visible } = await db.from('episodes').select('id')
      .eq('season_id', parsed.season_id).eq('episode_number', parsed.episode_number).eq('archived', false).maybeSingle()
    if (visible) {
      return { success: false, error: `Episode number ${parsed.episode_number} already exists in this season. Choose a different number.` }
    }
    const { data: episode, error } = await db.from('episodes').insert(parsed as never).select().single()
    if (error) {
      if (error.code === '23505') {
        return { success: false, error: `Episode number ${parsed.episode_number} already exists in this season. Choose a different number.` }
      }
      return { success: false, error: error.message }
    }
    const { count: sc } = await db.from('episodes').select('*', { count: 'exact', head: true }).eq('season_id', parsed.season_id)
    await db.from('seasons').update({ episode_count: sc ?? 0 }).eq('id', parsed.season_id)
    const { count: hc } = await db.from('episodes').select('*', { count: 'exact', head: true }).eq('show_id', parsed.show_id)
    await db.from('shows').update({ episode_count: hc ?? 0 }).eq('id', parsed.show_id)
    return { success: true, data: episode }
  } catch (err) {
    return { success: false, error: msg(err) }
  }
}

export async function updateEpisodeCore(db: AdminDb, deps: Deps, id: unknown, data: unknown): Promise<CoreResult> {
  try {
    const patch = data as Obj
    if (patch.title && !String(patch.title_ar ?? '').trim()) {
      patch.title_ar = await deps.fillArabic(String(patch.title), null)
    }
    if (patch.description && !String(patch.description_ar ?? '').trim()) {
      patch.description_ar = await deps.fillArabic(String(patch.description), null)
    }
    if (patch.episode_number !== undefined) {
      const { data: current } = await db.from('episodes').select('season_id').eq('id', id as string).single()
      if (current) {
        const { data: existing } = await db.from('episodes').select('id')
          .eq('season_id', current.season_id).eq('episode_number', patch.episode_number as number).neq('id', id as string).maybeSingle()
        if (existing) {
          return { success: false, error: `Episode number ${patch.episode_number} already exists in this season. Choose a different number.` }
        }
      }
    }
    const { data: episode, error } = await db.from('episodes').update(patch as never).eq('id', id as string).select().single()
    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'This episode number already exists in this season. Choose a different number.' }
      }
      return { success: false, error: error.message }
    }
    return { success: true, data: episode }
  } catch (err) {
    return { success: false, error: msg(err) }
  }
}
