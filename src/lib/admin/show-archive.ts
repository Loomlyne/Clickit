// Archive / restore core. Task 1 state: verbatim port of the legacy actions.ts behaviour.
import { generateSlug } from '../slug.ts'
import {
  archiveSlugForShow,
  getActiveShowNamespaceConflict,
} from './show-namespace.ts'
import type {
  ActionResult,
  AdminDb,
  ArabicFill,
  AuditWriter,
  EpisodeConflict,
  RestoreResult,
} from './ports'

type Fix = { episodeId: string; newEpisodeNumber: number }
type Deps = { audit: AuditWriter; adminUserId: string }

export async function archiveShowCore(
  db: AdminDb,
  deps: Deps,
  id: unknown
): Promise<ActionResult> {
  const showId = id as string
  const { error } = await db
    .from('shows')
    .update({ archived: true, slug: archiveSlugForShow(showId) })
    .eq('id', showId)
  if (error) return { success: false, error: error.message }

  await db.from('episodes').update({ archived: true }).eq('show_id', showId)

  await deps.audit({
    adminUserId: deps.adminUserId,
    action: 'archive',
    entity: 'show',
    entityId: showId,
  })
  return { success: true }
}

export async function restoreShowCore(
  db: AdminDb,
  deps: Deps & { fillArabic: ArabicFill },
  input: { showId: unknown; rename?: unknown; fixes?: unknown }
): Promise<RestoreResult> {
  const id = input.showId as string
  const rename = (input.rename ?? {}) as {
    title?: string
    slug?: string
    episodeFixes?: Fix[]
  }
  const fixes: Fix[] = [
    ...(rename.episodeFixes ?? []),
    ...((input.fixes as Fix[] | undefined) ?? []),
  ]

  if (fixes.length > 0) {
    const results = await Promise.all(
      fixes.map((fix) =>
        db
          .from('episodes')
          .update({ episode_number: fix.newEpisodeNumber })
          .eq('id', fix.episodeId)
      )
    )
    const firstError = results.find((r) => r.error)?.error
    if (firstError) {
      return {
        success: false,
        error: `Failed to update episode: ${firstError.message}`,
      }
    }
  }

  const { data: show, error: showFetchError } = await db
    .from('shows')
    .select('id, title, slug')
    .eq('id', id)
    .single()
  if (showFetchError) return { success: false, error: showFetchError.message }

  const title = (rename.title ?? show.title).trim()
  const generatedSlug = generateSlug(title, `show-${id.slice(0, 8)}`)
  const restoreSlug = rename.slug
    ? generateSlug(rename.slug, generatedSlug)
    : show.slug === archiveSlugForShow(id)
      ? generatedSlug
      : generateSlug(show.slug, generatedSlug)

  const showConflict = await getActiveShowNamespaceConflict(db, {
    title,
    slug: restoreSlug,
    excludeId: id,
  })
  if (showConflict) {
    return {
      success: false,
      error: 'Resolve the show title or slug conflict before restoring.',
      showConflict,
    }
  }

  const { data: archivedEpisodes } = await db
    .from('episodes')
    .select('id, title, episode_number, season_id')
    .eq('show_id', id)
    .eq('archived', true)

  if (archivedEpisodes && archivedEpisodes.length > 0) {
    const { data: seasons } = await db
      .from('seasons')
      .select('id, season_number')
      .eq('show_id', id)
    const seasonMap = new Map(seasons?.map((s) => [s.id, s.season_number]) ?? [])
    const involved = [...new Set(archivedEpisodes.map((ep) => ep.season_id))]
    const { data: visible } = await db
      .from('episodes')
      .select('season_id, episode_number, title')
      .in('season_id', involved)
      .eq('archived', false)
    const blockerByKey = new Map<string, string>()
    for (const ve of visible ?? []) {
      blockerByKey.set(`${ve.season_id}:${ve.episode_number}`, ve.title)
    }
    const conflicts: EpisodeConflict[] = []
    for (const ep of archivedEpisodes) {
      const blocker = blockerByKey.get(`${ep.season_id}:${ep.episode_number}`)
      if (blocker) {
        conflicts.push({
          episodeId: ep.id,
          episodeTitle: ep.title,
          episodeNumber: ep.episode_number,
          seasonId: ep.season_id,
          seasonNumber: seasonMap.get(ep.season_id) ?? 0,
          conflictingEpisodeTitle: blocker,
        })
      }
    }
    if (conflicts.length > 0) {
      return {
        success: false,
        error: `${conflicts.length} episode(s) have number conflicts with existing episodes.`,
        conflicts,
      }
    }
  }

  const { error: showError } = await db
    .from('shows')
    .update({ archived: false, slug: restoreSlug, title })
    .eq('id', id)
  if (showError) return { success: false, error: showError.message }

  await db.from('episodes').update({ archived: false }).eq('show_id', id)

  await deps.audit({
    adminUserId: deps.adminUserId,
    action: 'restore',
    entity: 'show',
    entityId: id,
  })
  return { success: true }
}
