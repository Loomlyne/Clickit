'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { z } from 'zod'
import sharp from 'sharp'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateYouTubeUrl } from '@/lib/youtube'
import { logAudit } from '@/lib/audit'
import { generateSlug } from '@/lib/slug'
import { getAppConfig } from '@/lib/config'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionResult<T = unknown> = {
  success: boolean
  error?: string
  data?: T
}

export type SignedVideoUploadTarget = {
  path: string
  token: string
}

function isMp4File(file: { name?: string; type?: string }) {
  const name = file.name?.toLowerCase() ?? ''
  const type = file.type ?? ''
  return (
    type === 'video/mp4' ||
    (name.endsWith('.mp4') && (!type || type === 'application/octet-stream'))
  )
}

export type EpisodeConflict = {
  episodeId: string
  episodeTitle: string
  episodeNumber: number
  seasonId: string
  seasonNumber: number
  conflictingEpisodeTitle: string
}

export type ShowRestoreConflict = {
  title: string
  slug: string
  titleConflictTitle?: string
  slugConflictTitle?: string
}

export type RestoreResult = ActionResult & {
  conflicts?: EpisodeConflict[]
  showConflict?: ShowRestoreConflict
}

// ---------------------------------------------------------------------------
// Auth helper: defense-in-depth (D-12) — every action verifies admin
// ---------------------------------------------------------------------------

async function assertAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Always scope to id=1. Without .eq('id', 1) a hypothetical second row in
  // app_config would make .single() throw, locking every admin action.
  const { data: config } = await supabase
    .from('app_config')
    .select('admin_user_id')
    .eq('id', 1)
    .single()

  if (config?.admin_user_id !== user.id) throw new Error('Unauthorized')
  return user
}

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

// Accepts '', null, or a valid-looking URL. Matches http(s) + a host.
const optionalUrl = z
  .string()
  .optional()
  .nullable()
  .refine((v) => !v || /^https?:\/\/\S+$/.test(v), 'Must be a valid URL')

// Hero video fields must be set together or both absent. A url without a type, or a
// type without a url, is an invalid state — the viewer's fallback chain breaks.
// Additionally, when type=='youtube', the URL MUST pass hostname validation — see
// validateYouTubeUrl for why the substring regex alone is not safe for viewer-rendered iframes.
function heroVideoInvariant(
  urlKey: 'hero_video_url' | 'hero_video_mobile_url',
  typeKey: 'hero_video_type' | 'hero_video_mobile_type'
) {
  return (data: Record<string, unknown>, ctx: z.RefinementCtx) => {
    const url = data[urlKey]
    const type = data[typeKey]
    const hasUrl = !!url
    const hasType = !!type
    if (hasUrl !== hasType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [hasUrl ? typeKey : urlKey],
        message: `${urlKey} and ${typeKey} must be set together or both empty`,
      })
      return
    }
    if (hasUrl && type === 'youtube' && typeof url === 'string') {
      if (!validateYouTubeUrl(url)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [urlKey],
          message:
            'Must be a valid youtube.com or youtu.be URL with a video ID',
        })
      }
    }
  }
}

const showSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().min(1, 'Title is required'),
    title_ar: z.string().optional().nullable(),
    slug: z.string().min(1, 'Slug is required'),
    description: z.string().min(1, 'Description is required'),
    description_ar: z.string().optional().nullable(),
    tagline: z.string().optional().nullable(),
    tagline_ar: z.string().optional().nullable(),
    genre: z.string().min(1, 'Genre is required'),
    brand_color: z.enum([
      'brand-blue',
      'brand-purple',
      'brand-green',
      'brand-red',
      'brand-orange',
    ]),
    status: z.enum(['draft', 'coming-soon', 'now-streaming']),
    broadcast_day: z.string().optional().nullable(),
    broadcast_time: z.string().optional().nullable(),
    poster_url: optionalUrl,
    card_image_url: optionalUrl,
    hero_url: optionalUrl,
    logo_url: optionalUrl,
    hero_image_mobile_url: optionalUrl,
    hero_video_url: optionalUrl,
    hero_video_type: z.enum(['mp4', 'youtube']).optional().nullable(),
    hero_video_mobile_url: optionalUrl,
    hero_video_mobile_type: z.enum(['mp4', 'youtube']).optional().nullable(),
    category_ids: z.array(z.string().uuid()).default([]),
  })
  .superRefine((data, ctx) => {
    heroVideoInvariant('hero_video_url', 'hero_video_type')(data, ctx)
    heroVideoInvariant('hero_video_mobile_url', 'hero_video_mobile_type')(
      data,
      ctx
    )
  })

const categorySchema = z.object({
  name_en: z.string().trim().min(1, 'English name is required').max(80),
  name_ar: z.string().trim().min(1, 'Arabic name is required').max(80),
  slug: z.string().trim().min(1, 'Slug is required').max(80),
  icon: z.string().trim().max(40).optional().nullable(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
  sort_order: z.number().int().min(0).default(0),
})

function bumpCatalogCache() {
  revalidatePath('/admin')
  revalidatePath('/admin/categories')
  revalidatePath('/watch')
  updateTag('shows')
  updateTag('categories')
}

function swapByDirection<T>(
  rows: T[],
  currentIndex: number,
  direction: 'up' | 'down'
) {
  const adjacentIndex =
    direction === 'up' ? currentIndex - 1 : currentIndex + 1
  if (
    currentIndex < 0 ||
    adjacentIndex < 0 ||
    adjacentIndex >= rows.length
  ) {
    return null
  }

  return { current: rows[currentIndex]!, adjacent: rows[adjacentIndex]! }
}

async function syncShowCategories(
  admin: ReturnType<typeof createAdminClient>,
  showId: string,
  categoryIds: string[]
) {
  const uniqueCategoryIds = [...new Set(categoryIds)]

  const { error: deleteError } = await admin
    .from('show_categories')
    .delete()
    .eq('show_id', showId)

  if (deleteError) throw deleteError

  if (uniqueCategoryIds.length === 0) return

  const { error: insertError } = await admin.from('show_categories').insert(
    uniqueCategoryIds.map((categoryId) => ({
      show_id: showId,
      category_id: categoryId,
    }))
  )

  if (insertError) throw insertError
}

function normalizeEnglishTitle(title: string) {
  return title.trim().replace(/\s+/g, ' ').toLowerCase()
}

function archiveSlugForShow(id: string) {
  return `archived-${id.slice(0, 8)}`
}

async function findActiveTitleConflict(
  admin: ReturnType<typeof createAdminClient>,
  title: string,
  excludeId?: string
) {
  const normalized = normalizeEnglishTitle(title)
  const { data, error } = await admin
    .from('shows')
    .select('id, title, slug')
    .eq('archived', false)

  if (error) throw error

  return (data ?? []).find((show) => {
    return (
      show.id !== excludeId && normalizeEnglishTitle(show.title) === normalized
    )
  })
}

async function findActiveSlugConflict(
  admin: ReturnType<typeof createAdminClient>,
  slug: string,
  excludeId?: string
) {
  const { data, error } = await admin
    .from('shows')
    .select('id, title, slug')
    .eq('archived', false)
    .eq('slug', slug)

  if (error) throw error

  return (data ?? []).find((show) => show.id !== excludeId)
}

async function getActiveShowNamespaceConflict(
  admin: ReturnType<typeof createAdminClient>,
  input: { title: string; slug: string; excludeId?: string }
): Promise<ShowRestoreConflict | null> {
  const [titleConflict, slugConflict] = await Promise.all([
    findActiveTitleConflict(admin, input.title, input.excludeId),
    findActiveSlugConflict(admin, input.slug, input.excludeId),
  ])

  if (!titleConflict && !slugConflict) return null

  return {
    title: input.title,
    slug: input.slug,
    titleConflictTitle: titleConflict?.title,
    slugConflictTitle: slugConflict?.title,
  }
}

const seasonSchema = z.object({
  show_id: z.string().uuid(),
  title: z.string().min(1, 'Title is required'),
  title_ar: z.string().optional().nullable(),
  season_number: z.number().int().positive(),
})

const episodeSchema = z.object({
  show_id: z.string().uuid(),
  season_id: z.string().uuid(),
  title: z.string().min(1, 'Title is required'),
  title_ar: z.string().optional().nullable(),
  description: z.string().min(1, 'Description is required'),
  description_ar: z.string().optional().nullable(),
  episode_number: z.number().int().positive(),
  youtube_video_id: z.string().optional().nullable(),
  duration: z.number().int().positive().optional().nullable(),
  status: z.enum(['draft', 'coming-soon', 'published']),
})

// ---------------------------------------------------------------------------
// Show Actions
// ---------------------------------------------------------------------------

export async function createShow(
  data: z.input<typeof showSchema>
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const parsed = showSchema.parse(data)
    const admin = createAdminClient()

    const { id, category_ids, ...rest } = parsed
    rest.slug = generateSlug(
      rest.slug,
      generateSlug(rest.title, id ? `show-${id.slice(0, 8)}` : undefined)
    )

    const conflict = await getActiveShowNamespaceConflict(admin, {
      title: rest.title,
      slug: rest.slug,
    })
    if (conflict?.titleConflictTitle) {
      return {
        success: false,
        error: `An active show already uses the title "${rest.title}".`,
      }
    }
    if (conflict?.slugConflictTitle) {
      return {
        success: false,
        error: `An active show already uses the slug "${rest.slug}".`,
      }
    }

    const { data: lastShow } = await admin
      .from('shows')
      .select('sort_order')
      .eq('archived', false)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const insertData = {
      ...(id ? { id } : {}),
      ...rest,
      sort_order: (lastShow?.sort_order ?? -1) + 1,
    }

    const { data: show, error } = await admin
      .from('shows')
      .insert(insertData)
      .select()
      .single()

    if (error) return { success: false, error: error.message }

    await syncShowCategories(admin, show.id, category_ids)

    await logAudit({
      adminUserId: user.id,
      action: 'create',
      entity: 'show',
      entityId: show.id,
      diff: {
        data: {
          title: show.title,
          slug: show.slug,
          status: show.status,
          category_ids,
        },
      },
    })

    bumpCatalogCache()
    return { success: true, data: show }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create show',
    }
  }
}

export async function updateShow(
  id: string,
  data: z.input<typeof showSchema>
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const parsed = showSchema.parse(data)
    const admin = createAdminClient()

    const { id: _parsedId, category_ids, ...updateData } = parsed
    void _parsedId

    // Defense: normalize the slug; if it strips to empty (e.g. user typed only
    // non-ASCII chars), regenerate from title; if title also empties, fall back
    // to the show's id prefix. Prevents save with a slug that would 404.
    const normalizedSlug = generateSlug(
      updateData.slug,
      generateSlug(updateData.title ?? '', `show-${id.slice(0, 8)}`)
    )
    if (normalizedSlug && normalizedSlug !== updateData.slug) {
      updateData.slug = normalizedSlug
    }

    const conflict = await getActiveShowNamespaceConflict(admin, {
      title: updateData.title,
      slug: updateData.slug,
      excludeId: id,
    })
    if (conflict?.titleConflictTitle) {
      return {
        success: false,
        error: `An active show already uses the title "${updateData.title}".`,
      }
    }
    if (conflict?.slugConflictTitle) {
      return {
        success: false,
        error: `An active show already uses the slug "${updateData.slug}".`,
      }
    }

    const { data: show, error } = await admin
      .from('shows')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }

    await syncShowCategories(admin, id, category_ids)

    await logAudit({
      adminUserId: user.id,
      action: 'update',
      entity: 'show',
      entityId: id,
      diff: {
        changed: [...Object.keys(updateData), 'category_ids'],
        title: show.title,
      },
    })

    bumpCatalogCache()
    revalidatePath(`/admin/shows/${id}`)
    return { success: true, data: show }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update show',
    }
  }
}

export async function archiveShow(id: string): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const admin = createAdminClient()

    const { error: showError } = await admin
      .from('shows')
      .update({ archived: true, slug: archiveSlugForShow(id) })
      .eq('id', id)

    if (showError) return { success: false, error: showError.message }

    // Also archive all episodes for this show
    await admin.from('episodes').update({ archived: true }).eq('show_id', id)

    await logAudit({
      adminUserId: user.id,
      action: 'archive',
      entity: 'show',
      entityId: id,
    })

    bumpCatalogCache()
    updateTag('episodes')
    return { success: true }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to archive show',
    }
  }
}

export async function reorderShow(
  id: string,
  direction: 'up' | 'down'
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const admin = createAdminClient()

    const { data: shows, error: fetchError } = await admin
      .from('shows')
      .select('id, title, sort_order')
      .eq('archived', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (fetchError) return { success: false, error: fetchError.message }

    const currentIndex = (shows ?? []).findIndex((show) => show.id === id)
    const pair = swapByDirection(shows ?? [], currentIndex, direction)
    if (!pair) return { success: false, error: 'No show to swap with' }

    const [first, second] = await Promise.all([
      admin
        .from('shows')
        .update({ sort_order: pair.adjacent.sort_order })
        .eq('id', pair.current.id),
      admin
        .from('shows')
        .update({ sort_order: pair.current.sort_order })
        .eq('id', pair.adjacent.id),
    ])

    const error = first.error ?? second.error
    if (error) return { success: false, error: error.message }

    await logAudit({
      adminUserId: user.id,
      action: 'update',
      entity: 'show',
      entityId: id,
      diff: {
        direction,
        swapped_with: pair.adjacent.id,
        ordered_titles: [pair.current.title, pair.adjacent.title],
      },
    })

    bumpCatalogCache()
    return { success: true }
  } catch (err) {
    console.error('[admin/shows] reorder failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reorder show',
    }
  }
}

// Internal implementation. Callers must have already run assertAdmin() —
// split out so resolveConflictsAndRestore() doesn't pay the auth roundtrip
// twice (once for itself, once through a nested restoreShow call).
async function _restoreShow(
  admin: ReturnType<typeof createAdminClient>,
  id: string
): Promise<RestoreResult> {
  const { data: show, error: showFetchError } = await admin
    .from('shows')
    .select('id, title, slug')
    .eq('id', id)
    .single()

  if (showFetchError) return { success: false, error: showFetchError.message }

  const generatedSlug = generateSlug(show.title, `show-${id.slice(0, 8)}`)
  const restoreSlug =
    show.slug === archiveSlugForShow(id)
      ? generatedSlug
      : generateSlug(show.slug, generatedSlug)
  const showConflict = await getActiveShowNamespaceConflict(admin, {
    title: show.title,
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

  // Check for episode number conflicts before restoring
  const { data: archivedEpisodes } = await admin
    .from('episodes')
    .select('id, title, episode_number, season_id')
    .eq('show_id', id)
    .eq('archived', true)

  if (archivedEpisodes && archivedEpisodes.length > 0) {
    // Get seasons for this show to include season_number in conflict info
    const { data: seasons } = await admin
      .from('seasons')
      .select('id, season_number')
      .eq('show_id', id)

    const seasonMap = new Map(
      seasons?.map((s) => [s.id, s.season_number]) ?? []
    )

    // Batch-fetch all visible episodes for the seasons involved in one round
    // trip. The previous implementation ran one query per archived episode,
    // so restoring a show with 20 episodes meant 20 sequential DB calls.
    const involvedSeasonIds = [
      ...new Set(archivedEpisodes.map((ep) => ep.season_id)),
    ]
    const { data: visibleEpisodes } = await admin
      .from('episodes')
      .select('season_id, episode_number, title')
      .in('season_id', involvedSeasonIds)
      .eq('archived', false)

    // Lookup key: "{seasonId}:{episodeNumber}" → title of the blocker
    const blockerByKey = new Map<string, string>()
    for (const ve of visibleEpisodes ?? []) {
      blockerByKey.set(`${ve.season_id}:${ve.episode_number}`, ve.title)
    }

    const conflicts: EpisodeConflict[] = []
    for (const ep of archivedEpisodes) {
      const blockerTitle = blockerByKey.get(
        `${ep.season_id}:${ep.episode_number}`
      )
      if (blockerTitle) {
        conflicts.push({
          episodeId: ep.id,
          episodeTitle: ep.title,
          episodeNumber: ep.episode_number,
          seasonId: ep.season_id,
          seasonNumber: seasonMap.get(ep.season_id) ?? 0,
          conflictingEpisodeTitle: blockerTitle,
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

  // No conflicts — proceed with restore
  const { error: showError } = await admin
    .from('shows')
    .update({ archived: false, slug: restoreSlug })
    .eq('id', id)

  if (showError) return { success: false, error: showError.message }

  await admin.from('episodes').update({ archived: false }).eq('show_id', id)

  bumpCatalogCache()
  revalidatePath('/admin/archive')
  updateTag('episodes')
  return { success: true }
}

export async function restoreShow(id: string): Promise<RestoreResult> {
  try {
    const user = await assertAdmin()
    const admin = createAdminClient()
    const result = await _restoreShow(admin, id)
    if (result.success) {
      await logAudit({
        adminUserId: user.id,
        action: 'restore',
        entity: 'show',
        entityId: id,
      })
    }
    return result
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to restore show',
    }
  }
}

export async function resolveConflictsAndRestore(
  showId: string,
  fixes: { episodeId: string; newEpisodeNumber: number }[]
): Promise<RestoreResult> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    // Apply the number fixes to archived episodes in parallel — admin action,
    // small N, safe to batch concurrently.
    const results = await Promise.all(
      fixes.map((fix) =>
        admin
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

    // Re-run restore with conflict check (skipping redundant assertAdmin —
    // we already authenticated this caller).
    return await _restoreShow(admin, showId)
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to resolve conflicts',
    }
  }
}

export async function resolveRestoreConflictsAndRestore(
  showId: string,
  data: {
    title?: string
    slug?: string
    episodeFixes?: { episodeId: string; newEpisodeNumber: number }[]
  }
): Promise<RestoreResult> {
  try {
    const user = await assertAdmin()
    const admin = createAdminClient()

    if (data.title || data.slug) {
      const { data: currentShow, error: fetchError } = await admin
        .from('shows')
        .select('title, slug')
        .eq('id', showId)
        .single()

      if (fetchError) return { success: false, error: fetchError.message }

      const title = (data.title ?? currentShow.title).trim()
      const slug = generateSlug(
        data.slug ?? currentShow.slug,
        generateSlug(title, `show-${showId.slice(0, 8)}`)
      )

      if (!title) return { success: false, error: 'Title is required.' }
      if (!slug) return { success: false, error: 'Slug is required.' }

      const showConflict = await getActiveShowNamespaceConflict(admin, {
        title,
        slug,
        excludeId: showId,
      })
      if (showConflict) {
        return {
          success: false,
          error: 'Resolve the show title or slug conflict before restoring.',
          showConflict,
        }
      }

      const { error: updateError } = await admin
        .from('shows')
        .update({ title, slug })
        .eq('id', showId)

      if (updateError) return { success: false, error: updateError.message }
    }

    const fixes = data.episodeFixes ?? []
    if (fixes.length > 0) {
      const results = await Promise.all(
        fixes.map((fix) =>
          admin
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

    const result = await _restoreShow(admin, showId)
    if (result.success) {
      await logAudit({
        adminUserId: user.id,
        action: 'restore',
        entity: 'show',
        entityId: showId,
      })
    }
    return result
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to resolve conflicts',
    }
  }
}

export async function deleteShowPermanently(id: string): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const admin = createAdminClient()

    // Capture show title BEFORE deletion so the audit row has recognizable
    // context (after DELETE the id is all we'd know).
    const { data: showRow } = await admin
      .from('shows')
      .select('title, slug')
      .eq('id', id)
      .single()

    // List and delete every file under shows/{id}/ in both buckets.
    // Before versioning landed the stable paths were predictable
    // (shows/{id}/poster.webp etc.) so hard-coded removes worked. After the
    // versioning migration (hero-{timestamp}.webp) the hard-coded list stopped
    // matching real filenames and permanent delete became a silent no-op. The
    // listing approach works for both legacy stable-path rows and versioned
    // rows — whatever is in the folder gets deleted.
    async function purgeShowFolder(bucket: string) {
      const { data: files } = await admin.storage
        .from(bucket)
        .list(`shows/${id}`, { limit: 1000 })
      if (!files || files.length === 0) return
      const paths = files
        .filter((f) => f.name && !f.id) // defensive: skip folder entries
        .map((f) => `shows/${id}/${f.name}`)
      if (paths.length > 0) {
        await admin.storage.from(bucket).remove(paths)
      }
    }
    await Promise.all([
      purgeShowFolder('show-artwork'), // poster, hero, hero-mobile, logo
      purgeShowFolder('site-assets'), // hero videos
    ])

    // Then delete DB record — CASCADE handles seasons/episodes
    const { error } = await admin.from('shows').delete().eq('id', id)

    if (error) return { success: false, error: error.message }

    await logAudit({
      adminUserId: user.id,
      action: 'delete',
      entity: 'show',
      entityId: id,
      diff: { title: showRow?.title, slug: showRow?.slug },
    })

    revalidatePath('/admin/archive')
    bumpCatalogCache()
    updateTag('episodes')
    return { success: true }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete show',
    }
  }
}

// ---------------------------------------------------------------------------
// Category Actions
// ---------------------------------------------------------------------------

export async function createCategory(
  data: z.input<typeof categorySchema>
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const parsed = categorySchema.parse(data)
    const admin = createAdminClient()

    const { data: category, error } = await admin
      .from('categories')
      .insert(parsed)
      .select()
      .single()

    if (error) return { success: false, error: error.message }

    await logAudit({
      adminUserId: user.id,
      action: 'create',
      entity: 'category',
      entityId: category.id,
      diff: { data: { name_en: category.name_en, slug: category.slug } },
    })

    bumpCatalogCache()
    return { success: true, data: category }
  } catch (err) {
    console.error('[admin/categories] create failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create category',
    }
  }
}

export async function updateCategory(
  id: string,
  data: z.input<typeof categorySchema>
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const parsed = categorySchema.parse(data)
    const admin = createAdminClient()

    const { data: category, error } = await admin
      .from('categories')
      .update(parsed)
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }

    await logAudit({
      adminUserId: user.id,
      action: 'update',
      entity: 'category',
      entityId: id,
      diff: { changed: Object.keys(parsed), slug: category.slug },
    })

    bumpCatalogCache()
    return { success: true, data: category }
  } catch (err) {
    console.error('[admin/categories] update failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update category',
    }
  }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const admin = createAdminClient()

    const { data: category } = await admin
      .from('categories')
      .select('name_en, slug')
      .eq('id', id)
      .single()

    const { error } = await admin.from('categories').delete().eq('id', id)

    if (error) return { success: false, error: error.message }

    await logAudit({
      adminUserId: user.id,
      action: 'delete',
      entity: 'category',
      entityId: id,
      diff: { name_en: category?.name_en, slug: category?.slug },
    })

    bumpCatalogCache()
    return { success: true }
  } catch (err) {
    console.error('[admin/categories] delete failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete category',
    }
  }
}

export async function reorderCategories(
  categoryIds: string[]
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const admin = createAdminClient()

    const results = await Promise.all(
      categoryIds.map((id, index) =>
        admin.from('categories').update({ sort_order: index }).eq('id', id)
      )
    )
    const error = results.find((result) => result.error)?.error
    if (error) return { success: false, error: error.message }

    await logAudit({
      adminUserId: user.id,
      action: 'update',
      entity: 'category',
      diff: { ordered_ids: categoryIds },
    })

    bumpCatalogCache()
    return { success: true }
  } catch (err) {
    console.error('[admin/categories] reorder failed', err)
    return {
      success: false,
      error:
        err instanceof Error ? err.message : 'Failed to reorder categories',
    }
  }
}

// ---------------------------------------------------------------------------
// Season Actions
// ---------------------------------------------------------------------------

export async function createSeason(
  data: z.input<typeof seasonSchema>
): Promise<ActionResult> {
  try {
    await assertAdmin()
    const parsed = seasonSchema.parse(data)
    const admin = createAdminClient()

    const { data: season, error } = await admin
      .from('seasons')
      .insert(parsed)
      .select()
      .single()

    if (error) return { success: false, error: error.message }

    // Update show season_count
    const { count } = await admin
      .from('seasons')
      .select('*', { count: 'exact', head: true })
      .eq('show_id', parsed.show_id)

    await admin
      .from('shows')
      .update({ season_count: count ?? 0 })
      .eq('id', parsed.show_id)

    revalidatePath(`/admin/shows/${parsed.show_id}`)
    updateTag('shows')
    return { success: true, data: season }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create season',
    }
  }
}

export async function updateSeason(
  id: string,
  data: Partial<z.input<typeof seasonSchema>>
): Promise<ActionResult> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    const { data: season, error } = await admin
      .from('seasons')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }

    if (season) {
      revalidatePath(`/admin/shows/${season.show_id}`)
      updateTag('shows')
    }
    return { success: true, data: season }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update season',
    }
  }
}

export async function deleteSeason(
  id: string,
  showId: string
): Promise<ActionResult> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    // Delete season — CASCADE deletes episodes
    const { error } = await admin.from('seasons').delete().eq('id', id)

    if (error) return { success: false, error: error.message }

    // Update show season_count
    const { count } = await admin
      .from('seasons')
      .select('*', { count: 'exact', head: true })
      .eq('show_id', showId)

    await admin
      .from('shows')
      .update({ season_count: count ?? 0 })
      .eq('id', showId)

    // Update show episode_count
    const { count: epCount } = await admin
      .from('episodes')
      .select('*', { count: 'exact', head: true })
      .eq('show_id', showId)

    await admin
      .from('shows')
      .update({ episode_count: epCount ?? 0 })
      .eq('id', showId)

    revalidatePath(`/admin/shows/${showId}`)
    updateTag('shows')
    updateTag('episodes')
    return { success: true }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete season',
    }
  }
}

// ---------------------------------------------------------------------------
// Episode Actions
// ---------------------------------------------------------------------------

export async function createEpisode(
  data: z.input<typeof episodeSchema>
): Promise<ActionResult> {
  try {
    await assertAdmin()
    const parsed = episodeSchema.parse(data)
    const admin = createAdminClient()

    // If an archived episode occupies this number, bump it out of the way
    const { data: archivedConflict } = await admin
      .from('episodes')
      .select('id')
      .eq('season_id', parsed.season_id)
      .eq('episode_number', parsed.episode_number)
      .eq('archived', true)
      .maybeSingle()

    if (archivedConflict) {
      // Find the max episode_number in this season across all episodes
      const { data: maxRow } = await admin
        .from('episodes')
        .select('episode_number')
        .eq('season_id', parsed.season_id)
        .order('episode_number', { ascending: false })
        .limit(1)
        .single()

      await admin
        .from('episodes')
        .update({ episode_number: (maxRow?.episode_number ?? 0) + 1 })
        .eq('id', archivedConflict.id)
    }

    // Pre-check: reject if a non-archived episode already occupies this number
    const { data: visibleConflict } = await admin
      .from('episodes')
      .select('id')
      .eq('season_id', parsed.season_id)
      .eq('episode_number', parsed.episode_number)
      .eq('archived', false)
      .maybeSingle()

    if (visibleConflict) {
      return {
        success: false,
        error: `Episode number ${parsed.episode_number} already exists in this season. Choose a different number.`,
      }
    }

    const { data: episode, error } = await admin
      .from('episodes')
      .insert(parsed)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return {
          success: false,
          error: `Episode number ${parsed.episode_number} already exists in this season. Choose a different number.`,
        }
      }
      return { success: false, error: error.message }
    }

    // Update season episode_count
    const { count: seasonEpCount } = await admin
      .from('episodes')
      .select('*', { count: 'exact', head: true })
      .eq('season_id', parsed.season_id)

    await admin
      .from('seasons')
      .update({ episode_count: seasonEpCount ?? 0 })
      .eq('id', parsed.season_id)

    // Update show episode_count
    const { count: showEpCount } = await admin
      .from('episodes')
      .select('*', { count: 'exact', head: true })
      .eq('show_id', parsed.show_id)

    await admin
      .from('shows')
      .update({ episode_count: showEpCount ?? 0 })
      .eq('id', parsed.show_id)

    revalidatePath(`/admin/shows/${parsed.show_id}`)
    updateTag('episodes')
    return { success: true, data: episode }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create episode',
    }
  }
}

export async function updateEpisode(
  id: string,
  data: Partial<z.input<typeof episodeSchema>>
): Promise<ActionResult> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    // Pre-check: if episode_number is changing, ensure no collision in the same season
    if (data.episode_number !== undefined) {
      const { data: current } = await admin
        .from('episodes')
        .select('season_id')
        .eq('id', id)
        .single()

      if (current) {
        const { data: existing } = await admin
          .from('episodes')
          .select('id')
          .eq('season_id', current.season_id)
          .eq('episode_number', data.episode_number)
          .neq('id', id)
          .maybeSingle()

        if (existing) {
          return {
            success: false,
            error: `Episode number ${data.episode_number} already exists in this season. Choose a different number.`,
          }
        }
      }
    }

    const { data: episode, error } = await admin
      .from('episodes')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return {
          success: false,
          error:
            'This episode number already exists in this season. Choose a different number.',
        }
      }
      return { success: false, error: error.message }
    }

    if (episode) {
      revalidatePath(`/admin/shows/${episode.show_id}`)
      updateTag('episodes')
    }
    return { success: true, data: episode }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update episode',
    }
  }
}

export async function archiveEpisode(
  id: string,
  showId: string
): Promise<ActionResult> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    const { error } = await admin
      .from('episodes')
      .update({ archived: true })
      .eq('id', id)

    if (error) return { success: false, error: error.message }

    // Update show episode_count (count non-archived episodes)
    const { count } = await admin
      .from('episodes')
      .select('*', { count: 'exact', head: true })
      .eq('show_id', showId)
      .eq('archived', false)

    await admin
      .from('shows')
      .update({ episode_count: count ?? 0 })
      .eq('id', showId)

    revalidatePath(`/admin/shows/${showId}`)
    updateTag('episodes')
    return { success: true }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to archive episode',
    }
  }
}

export async function reorderEpisode(
  episodeId: string,
  direction: 'up' | 'down'
): Promise<ActionResult> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    // Get current episode
    const { data: current, error: fetchError } = await admin
      .from('episodes')
      .select('id, episode_number, season_id, show_id')
      .eq('id', episodeId)
      .single()

    if (fetchError || !current) {
      return { success: false, error: 'Episode not found' }
    }

    // Find adjacent episode
    const adjacentNumber =
      direction === 'up'
        ? current.episode_number - 1
        : current.episode_number + 1

    const { data: adjacent, error: adjError } = await admin
      .from('episodes')
      .select('id, episode_number')
      .eq('season_id', current.season_id)
      .eq('episode_number', adjacentNumber)
      .single()

    if (adjError || !adjacent) {
      return { success: false, error: 'No adjacent episode to swap with' }
    }

    // Three-step swap to avoid unique constraint violation
    // Step 1: Set current episode_number to temporary value (-1)
    await admin
      .from('episodes')
      .update({ episode_number: -1 })
      .eq('id', current.id)

    // Step 2: Set adjacent to current's number
    await admin
      .from('episodes')
      .update({ episode_number: current.episode_number })
      .eq('id', adjacent.id)

    // Step 3: Set current to adjacent's number
    await admin
      .from('episodes')
      .update({ episode_number: adjacent.episode_number })
      .eq('id', current.id)

    revalidatePath(`/admin/shows/${current.show_id}`)
    updateTag('episodes')
    return { success: true }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reorder episode',
    }
  }
}

// ---------------------------------------------------------------------------
// Artwork Upload / Delete
// ---------------------------------------------------------------------------

export async function uploadArtwork(
  formData: FormData
): Promise<ActionResult<string>> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    const file = formData.get('file') as File | null
    const showId = formData.get('showId') as string | null
    const slot = formData.get('slot') as string | null

    if (!file || !showId || !slot) {
      console.warn('[uploadArtwork] missing args', {
        hasFile: !!file,
        showId,
        slot,
      })
      return { success: false, error: 'Missing file, showId, or slot' }
    }

    const ALLOWED_MIME = ['image/webp', 'image/png', 'image/jpeg']
    if (!ALLOWED_MIME.includes(file.type)) {
      console.warn('[uploadArtwork] bad mime rejected', {
        showId,
        slot,
        mime: file.type,
      })
      return {
        success: false,
        error: 'File must be a WebP, PNG, or JPEG image',
      }
    }
    if (file.size > 10 * 1024 * 1024) {
      console.warn('[uploadArtwork] oversize rejected', {
        showId,
        slot,
        sizeMB: Math.round(file.size / 1024 / 1024),
      })
      return { success: false, error: 'Image must be under 10MB' }
    }

    // All slots use versioned paths so uploads never overwrite the live DB-referenced
    // asset in-place. Form state holds the new URL; DB commit happens on Save.
    // Clicking Cancel on the drawer keeps the DB pointing at the still-existing old
    // file, so the live viewer is never shown a half-saved state. Orphans from saves
    // (where the DB moves to the new URL and the old file is abandoned) are cleaned
    // up by the scheduled sweep (see /api/cron/cleanup-media).
    const ext = slot === 'logo' ? 'png' : 'webp'

    // Transcode non-matching inputs to the storage format. For logo slot we keep PNG
    // (preserves transparency and is the convention). For hero/poster slots we convert
    // JPEG/PNG to WebP so the .webp extension accurately describes the bytes. If the
    // upload is already in the target format we pass the bytes through unchanged.
    let uploadBody: Buffer | File = file
    let uploadContentType = file.type
    const targetMime = ext === 'png' ? 'image/png' : 'image/webp'
    if (file.type !== targetMime) {
      const input = Buffer.from(await file.arrayBuffer())
      const pipeline = sharp(input)
      const transcoded =
        ext === 'png'
          ? await pipeline.png().toBuffer()
          : await pipeline.webp({ quality: 88 }).toBuffer()
      uploadBody = transcoded
      uploadContentType = targetMime
    }

    const path = `shows/${showId}/${slot}-${Date.now()}.${ext}`

    const { error } = await admin.storage
      .from('show-artwork')
      .upload(path, uploadBody, {
        upsert: false,
        contentType: uploadContentType,
        cacheControl: '3600',
      })

    if (error) return { success: false, error: error.message }

    const { data: urlData } = admin.storage
      .from('show-artwork')
      .getPublicUrl(path)

    return { success: true, data: urlData.publicUrl }
  } catch (err) {
    console.error('[uploadArtwork] failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upload failed',
    }
  }
}

// Note: an earlier deleteArtwork() server action was removed here. Post-versioning
// the UI uses form-state clearing (null-out the URL on Save) instead of an
// imperative storage delete — the orphaned versioned files are collected by the
// /api/cron/cleanup-media sweep. The old deleteArtwork built a stable path
// (shows/{id}/{slot}.{ext}) which stopped matching real filenames after the
// versioning migration, so keeping it around was a silent-failure trap.

// ---------------------------------------------------------------------------
// Hero Video Management
// ---------------------------------------------------------------------------

export async function createHeroVideoUpload(file: {
  name: string
  size: number
  type: string
}): Promise<ActionResult<SignedVideoUploadTarget>> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    if (!isMp4File(file)) {
      return { success: false, error: 'File must be an MP4 video' }
    }

    if (file.size > 50 * 1024 * 1024) {
      return { success: false, error: 'Video must be under 50MB' }
    }

    const path = 'hero/video.mp4'
    const { data, error } = await admin.storage
      .from('site-assets')
      .createSignedUploadUrl(path, { upsert: true })

    if (error) return { success: false, error: error.message }

    return { success: true, data: { path: data.path, token: data.token } }
  } catch (err) {
    console.error('[createHeroVideoUpload] failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upload failed',
    }
  }
}

export async function saveHeroVideoUpload(
  path: string
): Promise<ActionResult<string>> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    if (path !== 'hero/video.mp4') {
      return { success: false, error: 'Invalid upload path' }
    }

    const { data: urlData } = admin.storage
      .from('site-assets')
      .getPublicUrl(path)

    const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`

    const { error } = await admin
      .from('app_config')
      .update({ hero_video_url: publicUrl, hero_video_type: 'mp4' })
      .eq('id', 1)

    if (error) return { success: false, error: error.message }

    updateTag('site-config')
    revalidatePath('/')
    return { success: true, data: publicUrl }
  } catch (err) {
    console.error('[saveHeroVideoUpload] failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upload failed',
    }
  }
}

export async function setHeroVideoUrl(
  youtubeUrl: string
): Promise<ActionResult> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    const trimmed = youtubeUrl.trim()
    if (!trimmed) return { success: false, error: 'URL is required' }

    // SECURITY: validate hostname is a real YouTube domain before storage.
    // The extractYouTubeId regex alone matches the literal substring `youtu.be/`
    // anywhere in the URL, which would let an admin save `https://attacker.com/youtu.be/xxxxxxxxxxx`
    // and have every viewer load an attacker iframe. validateYouTubeUrl parses with
    // new URL() and enforces an allowlist of YouTube hostnames.
    const videoId = validateYouTubeUrl(trimmed)
    if (!videoId) {
      return {
        success: false,
        error:
          'Invalid YouTube URL. Must be a youtube.com or youtu.be link with a valid video ID.',
      }
    }

    // Store canonical form so viewers always get a predictable embed URL.
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`

    const { error } = await admin
      .from('app_config')
      .update({ hero_video_url: canonicalUrl, hero_video_type: 'youtube' })
      .eq('id', 1)

    if (error) {
      console.error('[setHeroVideoUrl] db update failed', {
        videoId,
        error: error.message,
      })
      return { success: false, error: error.message }
    }

    updateTag('site-config')
    revalidatePath('/')
    return { success: true }
  } catch (err) {
    console.error('[setHeroVideoUrl] failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save URL',
    }
  }
}

export async function removeHeroVideo(): Promise<ActionResult> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    // Try to remove MP4 from storage (ignore errors if not found)
    await admin.storage.from('site-assets').remove(['hero/video.mp4'])

    const { error } = await admin
      .from('app_config')
      .update({ hero_video_url: null, hero_video_type: null })
      .eq('id', 1)

    if (error) return { success: false, error: error.message }

    updateTag('site-config')
    revalidatePath('/')
    return { success: true }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove video',
    }
  }
}

// ---------------------------------------------------------------------------
// Per-Show Hero Video Management
// ---------------------------------------------------------------------------

// Uploads MP4 to storage and returns the public URL. Does NOT write to DB —
// the URL is persisted when the parent form is saved (same pattern as artwork).
export async function createShowVideoUpload(file: {
  name: string
  size: number
  type: string
  showId: string
  variant: 'desktop' | 'mobile'
}): Promise<ActionResult<SignedVideoUploadTarget>> {
  try {
    await assertAdmin()
    const admin = createAdminClient()
    const { name, size, type, showId, variant } = file

    if (!showId) {
      return { success: false, error: 'Missing showId' }
    }

    if (variant !== 'desktop' && variant !== 'mobile') {
      return { success: false, error: 'Invalid variant' }
    }

    if (!isMp4File({ name, type })) {
      return { success: false, error: 'File must be an MP4 video' }
    }

    if (size > 50 * 1024 * 1024) {
      return { success: false, error: 'Video must be under 50MB' }
    }

    const path = `shows/${showId}/hero-${variant}-${Date.now()}.mp4`
    const { data, error } = await admin.storage
      .from('site-assets')
      .createSignedUploadUrl(path)

    if (error) return { success: false, error: error.message }

    return { success: true, data: { path: data.path, token: data.token } }
  } catch (err) {
    console.error('[createShowVideoUpload] failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upload failed',
    }
  }
}

export async function saveShowVideoUpload(
  path: string
): Promise<ActionResult<string>> {
  try {
    await assertAdmin()

    if (!/^shows\/[^/]+\/hero-(desktop|mobile)-\d+\.mp4$/.test(path)) {
      return { success: false, error: 'Invalid upload path' }
    }

    const admin = createAdminClient()
    const { data: urlData } = admin.storage
      .from('site-assets')
      .getPublicUrl(path)
    return { success: true, data: urlData.publicUrl }
  } catch (err) {
    console.error('[saveShowVideoUpload] failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upload failed',
    }
  }
}

// Note: an earlier deleteShowVideoFile() server action was removed here. Same
// reasoning as deleteArtwork — post-versioning the UI uses form-state clearing
// and the cron sweep collects orphaned MP4s. The old implementation built the
// pre-versioning path (shows/{id}/hero-{variant}.mp4) which no longer matches
// real uploads (hero-{variant}-{timestamp}.mp4), so it silently did nothing.

// ---------------------------------------------------------------------------
// FEATURED TOGGLE
// ---------------------------------------------------------------------------

export async function toggleFeatured(showId: string) {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    // Get current featured state
    const { data: show, error: fetchErr } = await admin
      .from('shows')
      .select('featured')
      .eq('id', showId)
      .single()

    if (fetchErr || !show) throw new Error('Show not found')

    const newFeatured = !show.featured

    const { error } = await admin
      .from('shows')
      .update({ featured: newFeatured })
      .eq('id', showId)

    if (error) throw error

    revalidatePath('/admin')
    revalidatePath('/')
    updateTag('shows')
    return { success: true, featured: newFeatured }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to toggle featured',
    }
  }
}

// ---------------------------------------------------------------------------
// Site Settings — admin-only edits of app_config
//
// All actions: assertAdmin() → validate (zod) → update app_config →
// updateTag('site-config') → revalidatePath('/').
// Mirrors the hero video action shape above.
// ---------------------------------------------------------------------------

const urlOrEmpty = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === '' || /^https?:\/\//i.test(v),
    'Must be empty or a valid URL (http/https)'
  )

const siteMetadataSchema = z.object({
  site_title: z.string().trim().min(1, 'Title is required').max(120),
  site_description: z.string().trim().max(300).nullable(),
  site_tagline: z.string().trim().min(1, 'Tagline is required').max(120),
  hero_description: z.string().trim().max(500).nullable(),
})

const liveStreamUrlSchema = z.object({
  live_stream_url: z
    .string()
    .max(500)
    .nullish()
    .transform((v) => (!v || v.trim() === '' ? null : v.trim()))
    .refine(
      (v) => v === null || validateYouTubeUrl(v) !== null,
      'Must be empty or a valid YouTube URL'
    ),
})

const footerSchema = z.object({
  tagline: z.string().max(300),
  stat: z.string().max(80),
  contactEmail: z
    .string()
    .trim()
    .max(120)
    .refine(
      (v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      'Invalid email'
    ),
  social: z
    .array(
      z.object({
        platform: z.string().max(40),
        url: urlOrEmpty,
        iconUrl: urlOrEmpty,
      })
    )
    .max(20),
  legal: z.object({
    privacy: urlOrEmpty,
    terms: urlOrEmpty,
    cookies: urlOrEmpty,
  }),
})

const hrefOrEmpty = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === '' || v.startsWith('/') || /^https?:\/\//i.test(v),
    'Must be empty, a path (/foo), or a URL'
  )

const ctaStageSchema = z.object({
  label: z.string().max(60),
  headline: z.string().max(120),
  headlineB: z.string().max(120),
  body: z.string().max(300),
  primaryLabel: z.string().max(60),
  primaryHref: hrefOrEmpty,
  secondaryLabel: z.string().max(60),
  secondaryHref: hrefOrEmpty,
})

const ctaCopySchema = z.object({
  zero: ctaStageSchema,
  growing: ctaStageSchema,
  full: ctaStageSchema,
})

const integrationsSchema = z.object({
  google_analytics_id: z.string().trim().max(40).nullable(),
  meta_pixel_id: z.string().trim().max(40).nullable(),
  youtube_api_key: z.string().trim().max(100).nullable(),
})

const featureFlagsSchema = z.object({
  showGenresGrid: z.boolean(),
  showCtaBanner: z.boolean(),
  showFaq: z.boolean(),
  comingSoonMode: z.boolean(),
})

const topTickerItemSchema = z.object({
  tag: z.string().trim().max(24),
  text: z.string().trim().max(240),
  tag2: z.string().trim().max(24).optional(),
})

const topTickerSchema = z.object({
  enabled: z.boolean(),
  items: z.array(topTickerItemSchema).max(12),
})

const genreConfigSchema = z.record(
  z.string(),
  z.object({
    color: z.string().max(40).optional(),
    order: z.number().int().optional(),
    hidden: z.boolean().optional(),
  })
)

// Shared post-update side effects
function bumpSiteConfigCache() {
  updateTag('site-config')
  revalidatePath('/', 'layout')
}

/**
 * Log a settings-tab save to the audit log. Every updateX() below calls this
 * with the column(s) it touched so the audit dashboard can show "admin
 * changed footer_content, tagline, social.x" instead of a generic
 * "config_update" row.
 */
async function auditConfigUpdate(adminUserId: string, changedKeys: string[]) {
  await logAudit({
    adminUserId,
    action: 'config_update',
    entity: 'app_config',
    diff: { keys: changedKeys },
  })
}

export async function updateLiveStreamUrl(
  input: z.input<typeof liveStreamUrlSchema>
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const parsed = liveStreamUrlSchema.parse(input)
    const admin = createAdminClient()
    const { error } = await admin
      .from('app_config')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ live_stream_url: parsed.live_stream_url } as any)
      .eq('id', 1)
    if (error) return { success: false, error: error.message }
    await auditConfigUpdate(user.id, ['live_stream_url'])
    bumpSiteConfigCache()
    return { success: true }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save',
    }
  }
}

export async function updateSiteMetadata(
  input: z.input<typeof siteMetadataSchema>
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const parsed = siteMetadataSchema.parse(input)
    const admin = createAdminClient()
    const { error } = await admin
      .from('app_config')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(parsed as any)
      .eq('id', 1)
    if (error) return { success: false, error: error.message }
    await auditConfigUpdate(user.id, Object.keys(parsed))
    bumpSiteConfigCache()
    return { success: true }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save',
    }
  }
}

export async function updateFooterContent(
  input: z.input<typeof footerSchema>
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const parsed = footerSchema.parse(input)
    const admin = createAdminClient()
    const { error } = await admin
      .from('app_config')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ footer_content: parsed } as any)
      .eq('id', 1)
    if (error) return { success: false, error: error.message }
    await auditConfigUpdate(user.id, ['footer_content'])
    bumpSiteConfigCache()
    return { success: true }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save',
    }
  }
}

export async function updateContactRecipient(
  input: { contactEmail: string }
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const current = await getAppConfig()
    const parsed = footerSchema.parse({
      ...current.footer,
      contactEmail: input.contactEmail,
    })
    const admin = createAdminClient()
    const { error } = await admin
      .from('app_config')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ footer_content: parsed } as any)
      .eq('id', 1)
    if (error) return { success: false, error: error.message }
    await auditConfigUpdate(user.id, ['footer_content.contactEmail'])
    bumpSiteConfigCache()
    revalidatePath('/admin/inbox')
    return { success: true }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save',
    }
  }
}

export async function updateCtaCopy(
  input: z.input<typeof ctaCopySchema>
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const parsed = ctaCopySchema.parse(input)
    const admin = createAdminClient()
    const { error } = await admin
      .from('app_config')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ cta_copy: parsed } as any)
      .eq('id', 1)
    if (error) return { success: false, error: error.message }
    await auditConfigUpdate(user.id, ['cta_copy'])
    bumpSiteConfigCache()
    return { success: true }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save',
    }
  }
}

export async function updateGenreConfig(
  input: z.input<typeof genreConfigSchema>
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const parsed = genreConfigSchema.parse(input)
    const admin = createAdminClient()
    const { error } = await admin
      .from('app_config')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ genre_config: parsed } as any)
      .eq('id', 1)
    if (error) return { success: false, error: error.message }
    await auditConfigUpdate(user.id, ['genre_config'])
    bumpSiteConfigCache()
    return { success: true }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save',
    }
  }
}

export async function updateIntegrations(
  input: z.input<typeof integrationsSchema>
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const parsed = integrationsSchema.parse(input)
    // Empty strings from form inputs → null so DB stays clean
    const cleaned = {
      google_analytics_id: parsed.google_analytics_id?.trim() || null,
      meta_pixel_id: parsed.meta_pixel_id?.trim() || null,
      youtube_api_key: parsed.youtube_api_key?.trim() || null,
    }
    const admin = createAdminClient()
    const { error } = await admin
      .from('app_config')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(cleaned as any)
      .eq('id', 1)
    if (error) return { success: false, error: error.message }
    // Log which integration keys were touched without leaking the secret values.
    const keysTouched = Object.entries(cleaned)
      .filter(([, v]) => v !== null)
      .map(([k]) => k)
    await auditConfigUpdate(
      user.id,
      keysTouched.length ? keysTouched : ['integrations_cleared']
    )
    bumpSiteConfigCache()
    return { success: true }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save',
    }
  }
}

export async function updateFeatureFlags(
  input: z.input<typeof featureFlagsSchema>
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const parsed = featureFlagsSchema.parse(input)
    const admin = createAdminClient()
    const { error } = await admin
      .from('app_config')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ feature_flags: parsed } as any)
      .eq('id', 1)
    if (error) return { success: false, error: error.message }
    await auditConfigUpdate(user.id, ['feature_flags'])
    bumpSiteConfigCache()
    return { success: true }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save',
    }
  }
}

export async function updateTopTicker(
  input: z.input<typeof topTickerSchema>
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const parsed = topTickerSchema.parse(input)
    const items = parsed.items
      .map((row) => ({
        tag: row.tag.trim(),
        text: row.text.trim(),
        ...(row.tag2?.trim() && { tag2: row.tag2.trim() }),
      }))
      .filter((row) => row.tag.length > 0 || row.text.length > 0 || (row.tag2 ?? '').length > 0)

    if (parsed.enabled && items.length === 0) {
      return {
        success: false,
        error: 'Add at least one ticker line, or turn the ticker off.',
      }
    }

    const payload = { enabled: parsed.enabled, items }
    const admin = createAdminClient()
    const { error } = await admin
      .from('app_config')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ top_ticker: payload } as any)
      .eq('id', 1)
    if (error) return { success: false, error: error.message }
    await auditConfigUpdate(user.id, ['top_ticker'])
    bumpSiteConfigCache()
    return { success: true }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save',
    }
  }
}

// Neutralize active content in SVG uploads before they land in the public
// site-assets bucket. SVGs served from storage can execute inline <script>,
// event-handler attributes, or javascript: URLs when opened directly — this
// strips those common stored-XSS vectors. Non-SVG uploads never call this.
function sanitizeSvgUpload(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|xlink:href)\s*=\s*["']\s*javascript:[^"']*["']/gi, '')
}

// Upload OG image or favicon to site-assets bucket.
// Returns the public URL and writes it to the matching app_config column.
export async function uploadSiteImage(
  formData: FormData
): Promise<ActionResult<string>> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    const file = formData.get('file') as File | null
    const kind = formData.get('kind') as 'og' | 'favicon' | null
    if (!file) return { success: false, error: 'No file provided' }
    if (!kind || !['og', 'favicon'].includes(kind)) {
      return { success: false, error: 'Invalid kind' }
    }
    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: 'Image must be under 5MB' }
    }

    // Infer extension from mime type — favicons can be .ico or .png
    const mime = file.type
    const extMap: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'image/x-icon': 'ico',
    }
    const ext = extMap[mime]
    if (!ext)
      return { success: false, error: `Unsupported image type: ${mime}` }

    const path =
      kind === 'og' ? `settings/og.${ext}` : `settings/favicon.${ext}`

    let body: Blob = file
    if (mime === 'image/svg+xml') {
      body = new Blob([sanitizeSvgUpload(await file.text())], { type: mime })
    }

    const { error: uploadError } = await admin.storage
      .from('site-assets')
      .upload(path, body, {
        upsert: true,
        contentType: mime,
        cacheControl: '3600',
      })

    if (uploadError) return { success: false, error: uploadError.message }

    const { data: urlData } = admin.storage
      .from('site-assets')
      .getPublicUrl(path)
    // Cache-bust the URL so browsers always pick up the latest upload
    const bustedUrl = `${urlData.publicUrl}?v=${Date.now()}`

    const column = kind === 'og' ? 'og_image_url' : 'favicon_url'
    const { error: dbError } = await admin
      .from('app_config')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ [column]: bustedUrl } as any)
      .eq('id', 1)

    if (dbError) return { success: false, error: dbError.message }

    bumpSiteConfigCache()
    return { success: true, data: bustedUrl }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upload failed',
    }
  }
}

export async function removeSiteImage(
  kind: 'og' | 'favicon'
): Promise<ActionResult> {
  try {
    await assertAdmin()
    const admin = createAdminClient()
    const column = kind === 'og' ? 'og_image_url' : 'favicon_url'
    const { error } = await admin
      .from('app_config')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ [column]: null } as any)
      .eq('id', 1)
    if (error) return { success: false, error: error.message }
    bumpSiteConfigCache()
    return { success: true }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove',
    }
  }
}

export async function uploadSocialIcon(
  formData: FormData
): Promise<ActionResult<string>> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    const file = formData.get('file') as File | null
    if (!file) return { success: false, error: 'No file provided' }
    if (file.size > 2 * 1024 * 1024) {
      return { success: false, error: 'Icon must be under 2MB' }
    }

    const extMap: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
    }
    const ext = extMap[file.type]
    if (!ext) return { success: false, error: `Unsupported type: ${file.type}` }

    const path = `settings/social-icons/${Date.now()}.${ext}`
    let body: Blob = file
    if (file.type === 'image/svg+xml') {
      body = new Blob([sanitizeSvgUpload(await file.text())], { type: file.type })
    }
    const { error: uploadError } = await admin.storage
      .from('site-assets')
      .upload(path, body, { upsert: false, contentType: file.type, cacheControl: '31536000' })

    if (uploadError) return { success: false, error: uploadError.message }

    const { data: urlData } = admin.storage.from('site-assets').getPublicUrl(path)
    return { success: true, data: urlData.publicUrl }
  } catch (err) {
    console.error('[admin/actions] uploadSocialIcon failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upload failed',
    }
  }
}

// Nuclear cache-bust button for the Advanced tab.
// Invalidates all content tags so the landing and detail pages re-fetch fresh.
export async function revalidateAllCache(): Promise<ActionResult> {
  try {
    await assertAdmin()
    updateTag('shows')
    updateTag('episodes')
    updateTag('seasons')
    updateTag('shorts')
    updateTag('site-config')
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to revalidate',
    }
  }
}

// ---------------------------------------------------------------------------
// Shorts (Quick Bites) Actions
// ---------------------------------------------------------------------------

const shortSchema = z.object({
  youtube_video_id: z.string().min(1, 'YouTube video ID is required'),
  title: z.string().min(1, 'Title is required'),
  channel_name: z.string().optional().nullable(),
  thumbnail_url: optionalUrl,
  duration_seconds: z.number().int().positive().optional().nullable(),
  genre: z.string().optional().nullable(),
  sort_order: z.number().int().default(0),
  expires_at: z.string().optional().nullable(),
})

export async function createShort(
  data: z.input<typeof shortSchema>
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const parsed = shortSchema.parse(data)
    const admin = createAdminClient()

    const { data: short, error } = await admin
      .from('shorts')
      .insert(parsed)
      .select()
      .single()

    if (error) return { success: false, error: error.message }

    await logAudit({
      adminUserId: user.id,
      action: 'create',
      entity: 'short',
      entityId: short.id,
      diff: {
        data: { title: short.title, youtube_video_id: short.youtube_video_id },
      },
    })

    revalidatePath('/admin/shorts')
    updateTag('shorts')
    return { success: true, data: short }
  } catch (err) {
    console.error('[admin/shorts] create failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create short',
    }
  }
}

export async function updateShort(
  id: string,
  data: z.input<typeof shortSchema>
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const parsed = shortSchema.parse(data)
    const admin = createAdminClient()

    const { data: short, error } = await admin
      .from('shorts')
      .update(parsed)
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }

    await logAudit({
      adminUserId: user.id,
      action: 'update',
      entity: 'short',
      entityId: short.id,
      diff: { data: { title: short.title } },
    })

    revalidatePath('/admin/shorts')
    updateTag('shorts')
    return { success: true, data: short }
  } catch (err) {
    console.error('[admin/shorts] update failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update short',
    }
  }
}

export async function toggleShortFeatured(
  id: string,
  featured: boolean
): Promise<ActionResult> {
  try {
    await assertAdmin()
    const admin = createAdminClient()
    const { error } = await admin
      .from('shorts')
      .update({ is_featured: featured } as never)
      .eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/shorts')
    updateTag('shorts')
    return { success: true }
  } catch (err) {
    console.error('[admin/shorts] toggle featured failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed',
    }
  }
}

export async function reorderShort(
  id: string,
  direction: 'up' | 'down'
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const admin = createAdminClient()

    const { data: shorts, error: fetchError } = await admin
      .from('shorts')
      .select('id, title, sort_order')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (fetchError) return { success: false, error: fetchError.message }

    const currentIndex = (shorts ?? []).findIndex((short) => short.id === id)
    const pair = swapByDirection(shorts ?? [], currentIndex, direction)
    if (!pair) return { success: false, error: 'No short to swap with' }
    const adjacentIndex =
      direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const currentSortOrder = pair.current.sort_order ?? currentIndex
    const adjacentSortOrder = pair.adjacent.sort_order ?? adjacentIndex

    const [first, second] = await Promise.all([
      admin
        .from('shorts')
        .update({ sort_order: adjacentSortOrder })
        .eq('id', pair.current.id),
      admin
        .from('shorts')
        .update({ sort_order: currentSortOrder })
        .eq('id', pair.adjacent.id),
    ])

    const error = first.error ?? second.error
    if (error) return { success: false, error: error.message }

    await logAudit({
      adminUserId: user.id,
      action: 'update',
      entity: 'short',
      entityId: id,
      diff: {
        direction,
        swapped_with: pair.adjacent.id,
        ordered_titles: [pair.current.title, pair.adjacent.title],
      },
    })

    revalidatePath('/admin/shorts')
    updateTag('shorts')
    return { success: true }
  } catch (err) {
    console.error('[admin/shorts] reorder failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reorder short',
    }
  }
}

export async function deleteShort(id: string): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const admin = createAdminClient()

    const { error } = await admin.from('shorts').delete().eq('id', id)

    if (error) return { success: false, error: error.message }

    await logAudit({
      adminUserId: user.id,
      action: 'delete',
      entity: 'short',
      entityId: id,
    })

    revalidatePath('/admin/shorts')
    updateTag('shorts')
    return { success: true }
  } catch (err) {
    console.error('[admin/shorts] delete failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete short',
    }
  }
}

// ---------------------------------------------------------------------------
// Reviews Moderation Actions
// ---------------------------------------------------------------------------

export async function deleteReview(id: string): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const admin = createAdminClient()

    const { error } = await admin.from('reviews').delete().eq('id', id)

    if (error) return { success: false, error: error.message }

    await logAudit({
      adminUserId: user.id,
      action: 'delete',
      entity: 'review',
      entityId: id,
    })

    revalidatePath('/admin/reviews')
    return { success: true }
  } catch (err) {
    console.error('[admin/reviews] delete failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete review',
    }
  }
}

// ---------------------------------------------------------------------------
// Cast Actions
// ---------------------------------------------------------------------------

const castSchema = z.object({
  show_id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  role: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  sort_order: z.number().int().optional(),
})

export async function addCastMember(
  data: z.input<typeof castSchema>
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const parsed = castSchema.parse(data)
    const admin = createAdminClient()

    const { data: cast, error } = await admin
      .from('show_cast')
      .insert({ ...parsed, sort_order: parsed.sort_order ?? 0 })
      .select()
      .single()

    if (error) return { success: false, error: error.message }

    await logAudit({
      adminUserId: user.id,
      action: 'create',
      entity: 'cast',
      entityId: cast.id,
      diff: { data: { name: cast.name, show_id: cast.show_id } },
    })

    revalidatePath('/admin')
    updateTag('shows')
    return { success: true, data: cast }
  } catch (err) {
    console.error('[admin/cast] create failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add cast',
    }
  }
}

export async function uploadCastImage(
  formData: FormData
): Promise<ActionResult<string>> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    const file = formData.get('file') as File | null
    const showId = formData.get('showId') as string | null

    if (!file || file.size === 0) {
      return { success: false, error: 'No file provided' }
    }
    if (!showId) {
      return { success: false, error: 'Show ID is required' }
    }
    if (file.size > 2 * 1024 * 1024) {
      return { success: false, error: 'Image must be under 2MB' }
    }

    const extMap: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
    }
    const ext = extMap[file.type]
    if (!ext) {
      return {
        success: false,
        error: 'Only PNG, JPEG, or WebP images are allowed',
      }
    }

    const path = `shows/${showId}/cast/${Date.now()}.${ext}`

    const { error: uploadError } = await admin.storage
      .from('show-artwork')
      .upload(path, file, {
        upsert: false,
        contentType: file.type,
        cacheControl: '3600',
      })

    if (uploadError) return { success: false, error: uploadError.message }

    const { data: urlData } = admin.storage
      .from('show-artwork')
      .getPublicUrl(path)
    return { success: true, data: `${urlData.publicUrl}?v=${Date.now()}` }
  } catch (err) {
    console.error('[admin/cast] upload failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to upload cast image',
    }
  }
}

export async function deleteCastMember(id: string): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const admin = createAdminClient()

    const { error } = await admin.from('show_cast').delete().eq('id', id)

    if (error) return { success: false, error: error.message }

    await logAudit({
      adminUserId: user.id,
      action: 'delete',
      entity: 'cast',
      entityId: id,
    })

    revalidatePath('/admin')
    updateTag('shows')
    return { success: true }
  } catch (err) {
    console.error('[admin/cast] delete failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete cast',
    }
  }
}

// ---------------------------------------------------------------------------
// Legal Pages Actions
// ---------------------------------------------------------------------------

export type LegalPage = {
  id: string
  slug: string
  title: string
  content: string
  sort_order: number
  updated_at: string
}

const legalPageSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, hyphens only'),
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string(),
  sort_order: z.number().int().min(0).default(0),
})

export async function getLegalPages(): Promise<LegalPage[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('legal_pages')
    .select('id, slug, title, content, sort_order, updated_at')
    .order('sort_order', { ascending: true })
  return (data ?? []) as LegalPage[]
}

export async function upsertLegalPage(
  raw: unknown
): Promise<ActionResult<LegalPage>> {
  try {
    await assertAdmin()
    const parsed = legalPageSchema.safeParse(raw)
    if (!parsed.success)
      return { success: false, error: parsed.error.issues[0].message }

    const supabase = await createClient()
    const { id, ...fields } = parsed.data

    if (id) {
      const { data, error } = await supabase
        .from('legal_pages')
        .update(fields)
        .eq('id', id)
        .select()
        .single()
      if (error) return { success: false, error: error.message }
      revalidatePath('/', 'layout')
      return { success: true, data: data as LegalPage }
    } else {
      const { data, error } = await supabase
        .from('legal_pages')
        .insert(fields)
        .select()
        .single()
      if (error) return { success: false, error: error.message }
      revalidatePath('/', 'layout')
      return { success: true, data: data as LegalPage }
    }
  } catch (err) {
    console.error('[admin/legal] upsert failed', err)
    return {
      success: false,
      error:
        err instanceof Error ? err.message : 'Failed to save legal page',
    }
  }
}

export async function deleteLegalPage(id: string): Promise<ActionResult> {
  try {
    await assertAdmin()
    const supabase = await createClient()
    const { error } = await supabase
      .from('legal_pages')
      .delete()
      .eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err) {
    console.error('[admin/legal] delete failed', err)
    return {
      success: false,
      error:
        err instanceof Error ? err.message : 'Failed to delete legal page',
    }
  }
}

// ---------------------------------------------------------------------------
// FAQ Actions
// ---------------------------------------------------------------------------

export type Faq = {
  id: string
  question: string
  answer: string
  sort_order: number
}

const faqSchema = z.object({
  id: z.string().uuid().optional(),
  question: z.string().min(1, 'Question is required').max(500),
  answer: z.string().min(1, 'Answer is required'),
  sort_order: z.number().int().min(0).default(0),
})

export async function getFaqs(): Promise<Faq[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('faqs')
    .select('id, question, answer, sort_order')
    .order('sort_order', { ascending: true })
  return (data ?? []) as Faq[]
}

export async function upsertFaq(raw: unknown): Promise<ActionResult<Faq>> {
  try {
    await assertAdmin()
    const parsed = faqSchema.safeParse(raw)
    if (!parsed.success)
      return { success: false, error: parsed.error.issues[0].message }

    const supabase = await createClient()
    const { id, ...fields } = parsed.data

    if (id) {
      const { data, error } = await supabase
        .from('faqs')
        .update(fields)
        .eq('id', id)
        .select()
        .single()
      if (error) return { success: false, error: error.message }
      revalidatePath('/', 'layout')
      return { success: true, data: data as Faq }
    } else {
      const { data, error } = await supabase
        .from('faqs')
        .insert(fields)
        .select()
        .single()
      if (error) return { success: false, error: error.message }
      revalidatePath('/', 'layout')
      return { success: true, data: data as Faq }
    }
  } catch (err) {
    console.error('[admin/faq] upsert failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save FAQ',
    }
  }
}

export async function deleteFaq(id: string): Promise<ActionResult> {
  try {
    await assertAdmin()
    const supabase = await createClient()
    const { error } = await supabase.from('faqs').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err) {
    console.error('[admin/faq] delete failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete FAQ',
    }
  }
}
