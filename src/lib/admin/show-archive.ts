// Archive / restore core: validate, scope, dry-run conflicts, write with compensation, audit every outcome.
// No next/* imports: cache bumps stay in the actions.ts wrapper.
import { generateSlug } from '../slug.ts'
import {
  compensationAuditDiff,
  runWithCompensation,
  type CompensationResult,
  type WriteStep,
} from './compensation.ts'
import {
  episodeFixesSchema,
  formatZodError,
  parseId,
  restoreRenameSchema,
} from './schemas.ts'
import {
  archiveSlugForShow,
  getActiveShowNamespaceConflict,
} from './show-namespace.ts'
import type {
  AdminDb,
  ArabicFill,
  AuditWriter,
  CoreResult,
  EpisodeConflict,
  RestoreResult,
} from './ports'

type Deps = { audit: AuditWriter; adminUserId: string }
type Fix = { episodeId: string; newEpisodeNumber: number }
type StepResult = { error: string | null }

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

async function writeAudit(
  deps: Deps,
  action: 'archive' | 'restore',
  showId: string,
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

/** One expected row came back from an update that was chained with .select('id'). */
function oneRow(
  res: { data: unknown; error: { message: string } | null },
  what: string
): StepResult {
  if (res.error) return { error: res.error.message }
  const n = Array.isArray(res.data) ? res.data.length : 0
  return n === 1 ? { error: null } : { error: `${what}: expected 1 row, changed ${n}.` }
}

async function failedResult(
  deps: Deps,
  action: 'archive' | 'restore',
  showId: string,
  result: CompensationResult,
  context: Record<string, unknown>
): Promise<{ error: string; wrote: boolean }> {
  if (result.ok) return { error: 'Unknown failure.', wrote: result.wrote }
  await writeAudit(deps, action, showId, compensationAuditDiff(result, context))
  return { error: result.error, wrote: result.wrote }
}

export async function archiveShowCore(
  db: AdminDb,
  deps: Deps,
  id: unknown
): Promise<CoreResult<{ showId: string }>> {
  const parsed = parseId(id, 'show')
  if (!parsed.ok) return { success: false, error: parsed.error, wrote: false }
  const showId = parsed.value

  const { data: show, error: showError } = await db
    .from('shows')
    .select('id, title, slug, archived')
    .eq('id', showId)
    .maybeSingle()
  if (showError) return { success: false, error: showError.message, wrote: false }
  if (!show) return { success: false, error: 'Show not found.', wrote: false }
  if (show.archived)
    return { success: false, error: 'Show is already archived.', wrote: false }

  const { data: eps, error: epsError } = await db
    .from('episodes')
    .select('id')
    .eq('show_id', showId)
    .eq('archived', false)
  if (epsError) return { success: false, error: epsError.message, wrote: false }
  const episodeIds = (eps ?? []).map((e) => e.id)

  const context = {
    title: show.title,
    previous_slug: show.slug,
    archived_episode_ids: episodeIds,
  }

  const steps: WriteStep[] = [
    {
      name: 'archive-show',
      run: async () =>
        oneRow(
          await db
            .from('shows')
            .update({ archived: true, slug: archiveSlugForShow(showId) })
            .eq('id', showId)
            .eq('archived', false)
            .select('id'),
          'archive show'
        ),
      undo: async () => {
        const { error } = await db
          .from('shows')
          .update({ archived: false, slug: show.slug })
          .eq('id', showId)
        return { error: error?.message ?? null }
      },
    },
  ]
  if (episodeIds.length > 0) {
    steps.push({
      name: 'archive-episodes',
      run: async () => {
        const res = await db
          .from('episodes')
          .update({ archived: true })
          .in('id', episodeIds)
          .eq('show_id', showId)
          .eq('archived', false)
          .select('id')
        if (res.error) return { error: res.error.message }
        const n = res.data?.length ?? 0
        return n === episodeIds.length
          ? { error: null }
          : { error: `archive episodes: expected ${episodeIds.length} rows, changed ${n}.` }
      },
      undo: async () => {
        const { error } = await db
          .from('episodes')
          .update({ archived: false })
          .in('id', episodeIds)
        return { error: error?.message ?? null }
      },
    })
  }
  steps.push({
    name: 'audit',
    run: () =>
      writeAudit(deps, 'archive', showId, {
        outcome: 'committed',
        ...context,
      }),
  })

  const result = await runWithCompensation(steps)
  if (!result.ok) {
    const f = await failedResult(deps, 'archive', showId, result, context)
    return { success: false, error: f.error, wrote: f.wrote, data: { showId } }
  }
  return { success: true, wrote: true, data: { showId } }
}

type EpisodeRow = {
  id: string
  title: string
  episode_number: number
  season_id: string
  show_id: string
  archived: boolean
}

export async function restoreShowCore(
  db: AdminDb,
  deps: Deps & { fillArabic: ArabicFill },
  input: { showId: unknown; rename?: unknown; fixes?: unknown }
): Promise<RestoreResult> {
  const refuse = (error: string): RestoreResult => ({
    success: false,
    error,
    wrote: false,
  })

  const idParsed = parseId(input.showId, 'show')
  if (!idParsed.ok) return refuse(idParsed.error)
  const showId = idParsed.value

  let renameTitle: string | undefined
  let renameSlug: string | undefined
  let rawFixes: Fix[] = []
  if (input.rename !== undefined) {
    const r = restoreRenameSchema.safeParse(input.rename)
    if (!r.success) return refuse(formatZodError(r.error))
    renameTitle = r.data.title
    renameSlug = r.data.slug
    rawFixes = r.data.episodeFixes ?? []
  }
  if (input.fixes !== undefined) {
    const f = episodeFixesSchema.safeParse(input.fixes)
    if (!f.success) return refuse(formatZodError(f.error))
    rawFixes = [...rawFixes, ...f.data]
    const again = episodeFixesSchema.safeParse(rawFixes)
    if (!again.success) return refuse(formatZodError(again.error))
  }

  const { data: show, error: showError } = await db
    .from('shows')
    .select('id, title, title_ar, slug, archived')
    .eq('id', showId)
    .maybeSingle()
  if (showError) return refuse(showError.message)
  if (!show) return refuse('Show not found.')
  if (!show.archived) return refuse('Only archived shows can be restored.')

  // Newest committed archive record for this show (D-05).
  const { data: record, error: recordError } = await db
    .from('admin_audit_log')
    .select('id, diff')
    .eq('action_type', 'archive')
    .eq('entity_type', 'show')
    .eq('entity_id', showId)
    .eq('diff->>outcome', 'committed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (recordError) return refuse(recordError.message)
  const recDiff = (record?.diff ?? null) as Record<string, unknown> | null
  const recordedIds = Array.isArray(recDiff?.archived_episode_ids)
    ? (recDiff.archived_episode_ids as unknown[]).filter(
        (x): x is string => typeof x === 'string'
      )
    : null
  const previousSlug =
    typeof recDiff?.previous_slug === 'string' ? recDiff.previous_slug : null
  const hasRecord = !!record && recordedIds !== null

  const { data: archivedRows, error: archivedError } = await db
    .from('episodes')
    .select('id, title, episode_number, season_id, show_id, archived')
    .eq('show_id', showId)
    .eq('archived', true)
  if (archivedError) return refuse(archivedError.message)
  const archivedEps = (archivedRows ?? []) as EpisodeRow[]

  const recordedSet = new Set(recordedIds ?? [])
  const restoreSet = hasRecord
    ? archivedEps.filter((e) => recordedSet.has(e.id))
    : archivedEps
  const restoreIds = restoreSet.map((e) => e.id)
  const restoreIdSet = new Set(restoreIds)
  const skippedIds = hasRecord
    ? [...recordedSet].filter((x) => !restoreIdSet.has(x))
    : []

  const byId = new Map(restoreSet.map((e) => [e.id, e]))
  for (const fix of rawFixes) {
    if (!byId.has(fix.episodeId))
      return refuse("Episode is not part of this show's restore.")
  }
  // Drop no-op fixes (untouched dialog sends the stored numbers).
  const fixes = rawFixes.filter(
    (fix) => byId.get(fix.episodeId)!.episode_number !== fix.newEpisodeNumber
  )

  const idShort = showId.slice(0, 8)
  const targetTitle = renameTitle && renameTitle !== show.title ? renameTitle : show.title
  const renamedFrom = targetTitle !== show.title ? show.title : null
  let fallbackSlug = show.slug
  if (hasRecord) fallbackSlug = previousSlug ?? targetTitle
  else if (show.slug === archiveSlugForShow(showId)) fallbackSlug = targetTitle
  const targetSlug = generateSlug(
    renameSlug ?? fallbackSlug,
    generateSlug(targetTitle, `show-${idShort}`)
  )

  const showConflict = await getActiveShowNamespaceConflict(db, {
    title: targetTitle,
    slug: targetSlug,
    excludeId: showId,
  })
  if (showConflict) {
    return {
      success: false,
      error: 'Resolve the show title or slug conflict before restoring.',
      showConflict,
      wrote: false,
    }
  }

  let titleAr: string | null | undefined
  if (renamedFrom !== null) {
    titleAr = await deps.fillArabic(targetTitle, null)
  }

  // Dry run on final numbers, in memory.
  const seasonIds = [...new Set(restoreSet.map((e) => e.season_id))]
  let seasonEps: EpisodeRow[] = []
  const seasonNumbers = new Map<string, number>()
  if (seasonIds.length > 0) {
    const { data: all, error: allError } = await db
      .from('episodes')
      .select('id, title, episode_number, season_id, show_id, archived')
      .in('season_id', seasonIds)
    if (allError) return refuse(allError.message)
    seasonEps = (all ?? []) as EpisodeRow[]
    const { data: seasons, error: seasonsError } = await db
      .from('seasons')
      .select('id, season_number')
      .in('id', seasonIds)
    if (seasonsError) return refuse(seasonsError.message)
    for (const s of seasons ?? []) seasonNumbers.set(s.id, s.season_number)
  }
  const fixTo = new Map(fixes.map((f) => [f.episodeId, f.newEpisodeNumber]))
  const finalNumber = (e: EpisodeRow) => fixTo.get(e.id) ?? e.episode_number
  const holders = new Map<string, EpisodeRow[]>()
  for (const e of seasonEps) {
    const key = `${e.season_id}:${finalNumber(e)}`
    holders.set(key, [...(holders.get(key) ?? []), e])
  }
  const conflicts: EpisodeConflict[] = []
  for (const e of restoreSet) {
    const n = finalNumber(e)
    const other = (holders.get(`${e.season_id}:${n}`) ?? []).find((h) => h.id !== e.id)
    if (other) {
      conflicts.push({
        episodeId: e.id,
        episodeTitle: e.title,
        episodeNumber: n,
        seasonId: e.season_id,
        seasonNumber: seasonNumbers.get(e.season_id) ?? 0,
        conflictingEpisodeTitle: other.title,
      })
    }
  }
  if (conflicts.length > 0) {
    return {
      success: false,
      error: `${conflicts.length} episode(s) have number conflicts with existing episodes.`,
      conflicts,
      wrote: false,
    }
  }

  // Temp numbers below each season's minimum so swaps never collide.
  const tempByEpisode = new Map<string, number>()
  const nextTemp = new Map<string, number>()
  for (const fix of fixes) {
    const ep = byId.get(fix.episodeId)!
    if (!nextTemp.has(ep.season_id)) {
      const nums = seasonEps
        .filter((e) => e.season_id === ep.season_id)
        .map((e) => e.episode_number)
      nextTemp.set(ep.season_id, Math.min(0, ...nums) - 1)
    }
    const t = nextTemp.get(ep.season_id)!
    tempByEpisode.set(ep.id, t)
    nextTemp.set(ep.season_id, t - 1)
  }

  const setNumber = (episodeId: string, n: number): Promise<StepResult> =>
    (async () =>
      oneRow(
        await db
          .from('episodes')
          .update({ episode_number: n })
          .eq('id', episodeId)
          .eq('show_id', showId)
          .eq('archived', true)
          .select('id'),
        'renumber episode'
      ))()

  const steps: WriteStep[] = []
  for (const fix of fixes) {
    const ep = byId.get(fix.episodeId)!
    const temp = tempByEpisode.get(ep.id)!
    steps.push({
      name: `park-episode:${ep.id}`,
      run: () => setNumber(ep.id, temp),
      undo: () => setNumber(ep.id, ep.episode_number),
    })
  }
  for (const fix of fixes) {
    const ep = byId.get(fix.episodeId)!
    const temp = tempByEpisode.get(ep.id)!
    steps.push({
      name: `renumber-episode:${ep.id}`,
      run: () => setNumber(ep.id, fix.newEpisodeNumber),
      undo: () => setNumber(ep.id, temp),
    })
  }

  const showPatch: { archived: boolean; slug: string; title?: string; title_ar?: string | null } = {
    archived: false,
    slug: targetSlug,
  }
  if (renamedFrom !== null) {
    showPatch.title = targetTitle
    showPatch.title_ar = titleAr ?? null
  }
  steps.push({
    name: 'restore-show',
    run: async () =>
      oneRow(
        await db
          .from('shows')
          .update(showPatch)
          .eq('id', showId)
          .eq('archived', true)
          .select('id'),
        'restore show'
      ),
    undo: async () => {
      const { error } = await db
        .from('shows')
        .update({
          archived: true,
          slug: show.slug,
          title: show.title,
          title_ar: show.title_ar,
        })
        .eq('id', showId)
      return { error: error?.message ?? null }
    },
  })

  if (restoreIds.length > 0) {
    steps.push({
      name: 'restore-episodes',
      run: async () => {
        const res = await db
          .from('episodes')
          .update({ archived: false })
          .in('id', restoreIds)
          .eq('show_id', showId)
          .eq('archived', true)
          .select('id')
        if (res.error) return { error: res.error.message }
        const n = res.data?.length ?? 0
        return n === restoreIds.length
          ? { error: null }
          : { error: `restore episodes: expected ${restoreIds.length} rows, changed ${n}.` }
      },
      undo: async () => {
        const { error } = await db
          .from('episodes')
          .update({ archived: true })
          .in('id', restoreIds)
        return { error: error?.message ?? null }
      },
    })
  }

  const context = {
    title: targetTitle,
    slug: targetSlug,
    previous_slug: previousSlug,
    renamed_from: renamedFrom,
    episode_fixes: fixes.map((f) => ({
      episodeId: f.episodeId,
      from: byId.get(f.episodeId)!.episode_number,
      to: f.newEpisodeNumber,
    })),
    restored_episode_ids: restoreIds,
    skipped_episode_ids: skippedIds,
    archive_record: hasRecord ? 'recorded' : 'legacy',
    archive_record_id: hasRecord ? (record?.id ?? null) : null,
  }
  steps.push({
    name: 'audit',
    run: () =>
      writeAudit(deps, 'restore', showId, { outcome: 'committed', ...context }),
  })

  const result = await runWithCompensation(steps)
  if (!result.ok) {
    const f = await failedResult(deps, 'restore', showId, result, context)
    return { success: false, error: f.error, wrote: f.wrote, data: { showId } }
  }
  return { success: true, wrote: true, data: { showId } }
}
