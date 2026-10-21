'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateYouTubeUrl } from '@/lib/youtube'
import { logAudit, logAuditStrict } from '@/lib/audit'
import { runAdminAction, type AdminActionEnv } from '@/lib/admin/action-runner'
import { archiveShowCore, restoreShowCore } from '@/lib/admin/show-archive'
import type { AdminDb, AuditWriter, RestoreResult } from '@/lib/admin/ports'
import type { Database } from '@/lib/database.types'
import { adminImageDb } from '@/lib/admin/image-db'
import { finalizeImageUploadCore, type ImageUploadPorts } from '@/lib/admin/image-upload'
import {
  createShowCore,
  deleteShowCore,
  reorderShowCore,
  updateShowCore,
} from '@/lib/admin/show-writes'
import {
  categoryOrderSchema,
  episodeSchema,
  formatZodError,
  parseDirection,
  parseId,
  seasonSchema,
  type HeroVariant,
} from '@/lib/admin/schemas'
import {
  createSeasonCore,
  updateSeasonCore,
  createEpisodeCore,
  updateEpisodeCore,
} from '@/lib/admin/season-episode-writes'
import { ROW_DELETE, deleteRowAuditedCore } from '@/lib/admin/row-deletes'
import {
  archiveEpisodeCore,
  restoreEpisodeCore,
  deleteEpisodePermanentlyCore,
  reorderEpisodeCore,
} from '@/lib/admin/episode-lifecycle'
import {
  planShowScheduleCore,
  applyShowScheduleCore,
  unscheduleShowCore,
  type PlannedEpisodeSlot,
} from '@/lib/admin/show-schedule'
import { generateSlug } from '@/lib/slug'
import { createArabicFiller } from '@/lib/translate'
import { withArabicMissing } from '@/lib/admin/arabic-missing'
import { arabicMaxLengths } from '@/lib/admin/arabic-limits'
import { fillTickerArabic, type TickerItem } from '@/lib/admin/ticker'
import {
  removeHeroVideoCore,
  saveVideoCore,
  setHeroVideoUrlCore,
  type HeroVideoPorts,
} from '@/lib/admin/hero-video'
import { mp4BytesHasAudioTrack } from '@/lib/mp4-audio'
import { getPublicMediaOrigin } from '@/lib/supabase-media'
import { getWorkerEnv } from '@/server/cloudflare'
import { liveKeysForUrl, r2KeyFromUrl, r2KeysForUrl } from '@/server/r2-keys'
import { finalizeUploadedObject, type FinalizeBucket } from '@/server/upload-finalize'
import {
  stageR2Deletion,
  stageShowMedia as stageR2ShowMedia,
  type DeletableBucket,
  type ListableBucket,
  type MediaDeleteGuard,
  type StagedR2Deletion,
} from '@/server/r2-delete'
import { readMediaReferenceUrls, type ReferenceDb } from '@/server/media-references'
import { removeMediaCore } from '@/lib/admin/media-removal'
import { upsertLegalPageCore, type LegalPageRow } from '@/lib/admin/legal-pages'
import { SAVE_CONFLICT, rowVersion, updateIfUnchanged, type RowVersion } from '@/lib/admin/row-version'

/**
 * Deferred items 21-23: every R2 delete of a key that was ever live re-reads every media
 * reference (all scopes) right before deleting, through this guard. `db` must be the
 * service client so every row of every table is seen.
 */
function mediaGuard(db: AdminDb, label: string): MediaDeleteGuard {
  return {
    readReferences: () => readMediaReferenceUrls(db as unknown as ReferenceDb),
    mediaOrigin: getPublicMediaOrigin(),
    label,
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionResult<T = unknown> = {
  success: boolean
  error?: string
  data?: T
  /** Saved, but this many Arabic fields could not be auto-filled and stay empty. */
  arabicMissing?: number
}

/**
 * A save of a shows or app_config row from a loaded form (deferred item 23, residual b): it
 * takes the updated_at the form was loaded with and, on success, returns the new one so the
 * next save from the same page chains on it. A stale value: the conflict line, nothing written.
 */
type VersionedResult<T = unknown> = ActionResult<T> & { updatedAt?: string }

const withUpdatedAt = <R extends { success: boolean }>(r: R, version: RowVersion): R & { updatedAt?: string } =>
  r.success && version.next ? { ...r, updatedAt: version.next } : r

export type {
  EpisodeConflict,
  ShowRestoreConflict,
  RestoreResult,
} from '@/lib/admin/ports'

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

const adminEnv: AdminActionEnv = {
  assertAdmin,
  createDb: createAdminClient,
  audit: logAuditStrict,
  logError: (label, err) => console.error(label, err),
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
    broadcast_day: z.array(z.string()).optional().nullable(),
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

// ---------------------------------------------------------------------------
// Show Actions
// ---------------------------------------------------------------------------

export async function createShow(
  data: z.input<typeof showSchema>
): Promise<ActionResult> {
  return runAdminAction(
    adminEnv,
    async (ctx) => {
      const parsed = showSchema.parse(data)
      const { id, category_ids, ...rest } = parsed
      rest.slug = generateSlug(
        rest.slug,
        generateSlug(rest.title, id ? `show-${id.slice(0, 8)}` : undefined)
      )

      // Auto-fill blank Arabic fields from their English source (Workers AI).
      // Strict: a failed translation stores null, not English.
      const arabic = createArabicFiller(ctx.adminUserId)
      rest.title_ar = await arabic.fill(rest.title, rest.title_ar)
      rest.description_ar = await arabic.fill(rest.description, rest.description_ar)
      rest.tagline_ar = await arabic.fill(rest.tagline, rest.tagline_ar)

      const result = await createShowCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId },
        { insertData: { ...(id ? { id } : {}), ...rest }, categoryIds: category_ids }
      )
      return withArabicMissing(result, arabic.missing())
    },
    {
      fallbackError: 'Failed to create show',
      revalidate: () => bumpCatalogCache(),
    }
  )
}

export async function updateShow(
  id: string,
  data: z.input<typeof showSchema>,
  expectedUpdatedAt: string
): Promise<VersionedResult> {
  return runAdminAction(
    adminEnv,
    async (ctx) => {
      // Refuse a missing or malformed updated_at before any translation call or db read.
      const version = rowVersion(expectedUpdatedAt)
      if (!version.ok) return { success: false, error: version.error, wrote: false }
      const parsed = showSchema.parse(data)
      const { id: _parsedId, category_ids, ...updateData } = parsed
      void _parsedId

      // Defense: normalize the slug; if it strips to empty (e.g. user typed only
      // non-ASCII chars), regenerate from title; if title also empties, fall back
      // to the show's id prefix. Prevents save with a slug that would 404.
      const normalizedSlug = generateSlug(
        updateData.slug,
        generateSlug(updateData.title ?? '', `show-${String(id).slice(0, 8)}`)
      )
      if (normalizedSlug && normalizedSlug !== updateData.slug) {
        updateData.slug = normalizedSlug
      }

      // Auto-fill blank Arabic fields from their English source (Workers AI).
      const arabic = createArabicFiller(ctx.adminUserId)
      updateData.title_ar = await arabic.fill(updateData.title, updateData.title_ar)
      updateData.description_ar = await arabic.fill(
        updateData.description,
        updateData.description_ar
      )
      updateData.tagline_ar = await arabic.fill(
        updateData.tagline,
        updateData.tagline_ar
      )

      const result = await updateShowCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId },
        { id, updateData, categoryIds: category_ids, expectedUpdatedAt: version.value.expected }
      )
      return withArabicMissing(result, arabic.missing())
    },
    {
      fallbackError: 'Failed to update show',
      revalidate: () => {
        bumpCatalogCache()
        revalidatePath(`/admin/shows/${id}`)
      },
    }
  )
}

export async function archiveShow(id: string): Promise<ActionResult> {
  return runAdminAction(
    adminEnv,
    (ctx) =>
      archiveShowCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId },
        id
      ),
    {
      fallbackError: 'Failed to archive show',
      revalidate: () => {
        bumpCatalogCache()
        updateTag('episodes')
        revalidatePath('/admin/archive')
      },
    }
  )
}

export async function reorderShow(
  id: string,
  direction: 'up' | 'down'
): Promise<ActionResult> {
  return runAdminAction(
    adminEnv,
    (ctx) =>
      reorderShowCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId },
        { id, direction }
      ),
    {
      fallbackError: 'Failed to reorder show',
      revalidate: () => bumpCatalogCache(),
    }
  )
}

const revalidateRestore = () => {
  bumpCatalogCache()
  revalidatePath('/admin/archive')
  updateTag('episodes')
}

export async function restoreShow(id: string): Promise<RestoreResult> {
  return runAdminAction(
    adminEnv,
    async (ctx) => {
      const arabic = createArabicFiller(ctx.adminUserId)
      const result = await restoreShowCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId, fillArabic: arabic.fill },
        { showId: id }
      )
      return withArabicMissing(result, arabic.missing())
    },
    {
      fallbackError: 'Failed to restore show',
      revalidate: revalidateRestore,
    }
  )
}

export async function resolveConflictsAndRestore(
  showId: string,
  fixes: { episodeId: string; newEpisodeNumber: number }[]
): Promise<RestoreResult> {
  return runAdminAction(
    adminEnv,
    async (ctx) => {
      const arabic = createArabicFiller(ctx.adminUserId)
      const result = await restoreShowCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId, fillArabic: arabic.fill },
        { showId, fixes }
      )
      return withArabicMissing(result, arabic.missing())
    },
    {
      fallbackError: 'Failed to resolve conflicts',
      revalidate: revalidateRestore,
    }
  )
}

export async function resolveRestoreConflictsAndRestore(
  showId: string,
  data: {
    title?: string
    slug?: string
    episodeFixes?: { episodeId: string; newEpisodeNumber: number }[]
  }
): Promise<RestoreResult> {
  const rename: { title?: string; slug?: string } = {}
  if (data?.title) rename.title = data.title
  if (data?.slug) rename.slug = data.slug
  return runAdminAction(
    adminEnv,
    async (ctx) => {
      const arabic = createArabicFiller(ctx.adminUserId)
      const result = await restoreShowCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId, fillArabic: arabic.fill },
        {
          showId,
          rename: Object.keys(rename).length > 0 ? rename : undefined,
          fixes: data?.episodeFixes,
        }
      )
      return withArabicMissing(result, arabic.missing())
    },
    {
      fallbackError: 'Failed to resolve conflicts',
      revalidate: revalidateRestore,
    }
  )
}

// List and delete every R2 object under <bucket>/shows/{id}/ in both buckets (artwork,
// logo, cast portraits, hero videos). Listing (not hard-coded names) works for legacy
// stable-path rows and versioned rows (hero-{timestamp}.webp). R2 only: Supabase Storage
// originals are never deleted here (MEDIA-07). Commit runs after the show row is gone and
// keeps any file another show, the site settings or a profile still uses.
async function stageShowMedia(showId: string, db: AdminDb): Promise<StagedR2Deletion[]> {
  const bucket = (await getWorkerEnv()).MEDIA as unknown as ListableBucket
  return stageR2ShowMedia(bucket, showId, mediaGuard(db, '[deleteShowPermanently]'))
}

export async function deleteShowPermanently(id: string): Promise<ActionResult> {
  return runAdminAction(
    adminEnv,
    (ctx) =>
      deleteShowCore(
        ctx.db,
        {
          audit: ctx.audit,
          adminUserId: ctx.adminUserId,
          media: {
            stage: async (showId) =>
              (await stageShowMedia(showId, ctx.db)).map((deletion) => ({
                commit: async () => {
                  const ok = await deletion.commit()
                  if (!ok) console.error('[deleteShowPermanently] media cleanup failed')
                  return ok
                },
                rollback: async () => {
                  await deletion.rollback()
                },
              })),
          },
        },
        id
      ),
    {
      fallbackError: 'Failed to delete show',
      revalidate: () => {
        revalidatePath('/admin/archive')
        bumpCatalogCache()
        updateTag('episodes')
      },
    }
  )
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

/** Lands only while the row still holds the updated_at the editor opened (review item 8, PR #29). */
export async function updateCategory(
  id: string,
  data: z.input<typeof categorySchema>,
  expectedUpdatedAt: string
): Promise<VersionedResult> {
  try {
    const user = await assertAdmin()
    const idParsed = parseId(id, 'category')
    if (!idParsed.ok) return { success: false, error: idParsed.error }
    id = idParsed.value
    const version = rowVersion(expectedUpdatedAt)
    if (!version.ok) return { success: false, error: version.error }
    // sort_order stays optional so an omitted value is not written as 0.
    const parsed = categorySchema
      .extend({ sort_order: z.number().int().min(0).optional() })
      .parse(data)
    const admin = createAdminClient()

    const { error, row } = await updateIfUnchanged(admin, 'categories', id, parsed, version.value, '*')
    if (error || !row) return { success: false, error: error ?? 'Category not found.' }
    const category = row as unknown as Database['public']['Tables']['categories']['Row']

    await logAudit({
      adminUserId: user.id,
      action: 'update',
      entity: 'category',
      entityId: id,
      diff: { changed: Object.keys(parsed), slug: category.slug },
    })

    bumpCatalogCache()
    return withUpdatedAt({ success: true, data: category }, version.value)
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
    const idParsed = parseId(id, 'category')
    if (!idParsed.ok) return { success: false, error: idParsed.error }
    id = idParsed.value
    const admin = createAdminClient()

    const { data: category, error: lookupError } = await admin
      .from('categories')
      .select('name_en, slug')
      .eq('id', id)
      .maybeSingle()

    if (lookupError) return { success: false, error: lookupError.message }
    if (!category) return { success: false, error: 'Category not found.' }

    const { data: deleted, error } = await admin
      .from('categories')
      .delete()
      .eq('id', id)
      .select('id')

    if (error) return { success: false, error: error.message }
    if (!deleted || deleted.length === 0)
      return { success: false, error: 'Category not found.' }

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
    const orderParsed = categoryOrderSchema.safeParse(categoryIds)
    if (!orderParsed.success)
      return { success: false, error: formatZodError(orderParsed.error) }
    categoryIds = orderParsed.data
    const admin = createAdminClient()

    // Each row comes back with its new updated_at so the page's editors keep a fresh version
    // (an edit after a reorder is our own change, not a conflict; review item 8, PR #29).
    const results = await Promise.all(
      categoryIds.map((id, index) =>
        admin
          .from('categories')
          .update({ sort_order: index })
          .eq('id', id)
          .select('id, sort_order, updated_at')
      )
    )
    const error = results.find((result) => result.error)?.error
    if (error) return { success: false, error: error.message }
    const versions = results.flatMap((result) => result.data ?? [])

    await logAudit({
      adminUserId: user.id,
      action: 'update',
      entity: 'category',
      diff: { ordered_ids: categoryIds },
    })

    bumpCatalogCache()
    return { success: true, data: versions }
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

type ShowScoped = { data?: { showId?: string } }

/**
 * Revalidate a show's admin page. The show id comes from the core result (the
 * stored row); the client value is only a fallback when the core threw, and it
 * is only used when it is a valid UUID. Returns whether a page was revalidated.
 */
function revalidateShowPage(
  result: ShowScoped | undefined,
  clientShowId?: unknown
): boolean {
  const parsed = parseId(result?.data?.showId ?? clientShowId, 'show')
  if (!parsed.ok) return false
  revalidatePath(`/admin/shows/${parsed.value}`)
  return true
}

export async function createSeason(
  data: z.input<typeof seasonSchema>
): Promise<ActionResult> {
  return runAdminAction(
    adminEnv,
    async (ctx) => {
      const arabic = createArabicFiller(ctx.adminUserId)
      const result = await createSeasonCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId, fillArabic: arabic.fill },
        data
      )
      return withArabicMissing(result, arabic.missing())
    },
    {
      fallbackError: 'Failed to create season',
      revalidate: (result) => {
        if (!revalidateShowPage(result, data?.show_id)) bumpCatalogCache()
        updateTag('shows')
      },
    }
  )
}

export async function updateSeason(
  id: string,
  data: Partial<z.input<typeof seasonSchema>>,
  expectedUpdatedAt: string
): Promise<VersionedResult> {
  return runAdminAction(
    adminEnv,
    async (ctx) => {
      const arabic = createArabicFiller(ctx.adminUserId)
      // Checked against the drawer's updated_at before any AI call (review item 8, PR #29).
      const result = await updateSeasonCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId, fillArabic: arabic.fill },
        id,
        data,
        expectedUpdatedAt
      )
      return withArabicMissing(result, arabic.missing())
    },
    {
      fallbackError: 'Failed to update season',
      revalidate: (result) => {
        if (!revalidateShowPage(result, data?.show_id)) bumpCatalogCache()
        updateTag('shows')
      },
    }
  )
}

// deleteSeason is not exported: no admin screen deletes a season, and an exported
// server action is callable by any admin client. deleteSeasonCore stays archive-first.

// ---------------------------------------------------------------------------
// Episode Actions
// ---------------------------------------------------------------------------

export async function createEpisode(
  data: z.input<typeof episodeSchema>
): Promise<ActionResult> {
  return runAdminAction(
    adminEnv,
    async (ctx) => {
      const arabic = createArabicFiller(ctx.adminUserId)
      const result = await createEpisodeCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId, fillArabic: arabic.fill },
        data
      )
      return withArabicMissing(result, arabic.missing())
    },
    {
      fallbackError: 'Failed to create episode',
      revalidate: (result) => {
        revalidateShowPage(result, data?.show_id)
        bumpCatalogCache()
        updateTag('episodes')
      },
    }
  )
}

export async function updateEpisode(
  id: string,
  data: Partial<z.input<typeof episodeSchema>>,
  expectedUpdatedAt: string
): Promise<VersionedResult> {
  return runAdminAction(
    adminEnv,
    async (ctx) => {
      const arabic = createArabicFiller(ctx.adminUserId)
      // Checked against the drawer's updated_at before any AI call (review item 8, PR #29).
      const result = await updateEpisodeCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId, fillArabic: arabic.fill },
        id,
        data,
        expectedUpdatedAt
      )
      return withArabicMissing(result, arabic.missing())
    },
    {
      fallbackError: 'Failed to update episode',
      revalidate: (result) => {
        if (!revalidateShowPage(result, data?.show_id)) bumpCatalogCache()
        updateTag('episodes')
      },
    }
  )
}

export async function archiveEpisode(
  id: string,
  showId: string
): Promise<ActionResult> {
  return runAdminAction(
    adminEnv,
    (ctx) =>
      archiveEpisodeCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId },
        id,
        showId
      ),
    {
      fallbackError: 'Failed to archive episode',
      revalidate: (result) => {
        revalidateShowPage(result, showId)
        bumpCatalogCache()
        updateTag('episodes')
      },
    }
  )
}

export async function restoreEpisode(id: string): Promise<ActionResult> {
  return runAdminAction(
    adminEnv,
    (ctx) =>
      restoreEpisodeCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId },
        id
      ),
    {
      fallbackError: 'Failed to restore episode',
      revalidate: (result) => {
        revalidatePath('/admin/archive')
        revalidateShowPage(result)
        bumpCatalogCache()
        updateTag('episodes')
      },
    }
  )
}

export async function deleteEpisodePermanently(
  id: string
): Promise<ActionResult> {
  return runAdminAction(
    adminEnv,
    (ctx) =>
      deleteEpisodePermanentlyCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId },
        id
      ),
    {
      fallbackError: 'Failed to delete episode',
      revalidate: (result) => {
        revalidatePath('/admin/archive')
        revalidateShowPage(result)
        bumpCatalogCache()
        updateTag('episodes')
      },
    }
  )
}

export async function reorderEpisode(
  episodeId: string,
  direction: 'up' | 'down'
): Promise<ActionResult> {
  return runAdminAction(
    adminEnv,
    (ctx) =>
      reorderEpisodeCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId },
        episodeId,
        direction
      ),
    {
      fallbackError: 'Failed to reorder episode',
      revalidate: (result) => {
        if (!revalidateShowPage(result)) bumpCatalogCache()
        updateTag('episodes')
      },
    }
  )
}

// ---------------------------------------------------------------------------
// Bulk episode scheduling
// ---------------------------------------------------------------------------

export type { PlannedEpisodeSlot } from '@/lib/admin/show-schedule'

/**
 * Preview a bulk schedule without writing anything. Drives the confirmation
 * dialog so the admin sees every generated air date before committing.
 */
export async function previewShowSchedule(
  showId: string
): Promise<ActionResult<PlannedEpisodeSlot[]>> {
  try {
    await assertAdmin()
    const parsed = parseId(showId, 'show')
    if (!parsed.ok) return { success: false, error: parsed.error }
    const result = await planShowScheduleCore(
      createAdminClient(),
      parsed.value,
      new Date()
    )
    if (!result.ok) return { success: false, error: result.error }
    return { success: true, data: result.plan }
  } catch (err) {
    console.error('[admin/actions] schedule preview failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to build schedule',
    }
  }
}

/**
 * Apply the bulk schedule: every eligible episode becomes `coming-soon` with a
 * `publish_at`, so the existing auto-publish machinery takes it live at that
 * minute (see lib/scheduling.isEpisodeLive and the publish-scheduled cron).
 */
export async function applyShowSchedule(
  showId: string
): Promise<ActionResult<{ scheduled?: number }>> {
  return runAdminAction(
    adminEnv,
    (ctx) =>
      applyShowScheduleCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId, now: new Date() },
        showId
      ),
    {
      fallbackError: 'Failed to schedule episodes',
      revalidate: (result) => {
        revalidateShowPage(result, showId)
        updateTag('episodes')
        updateTag('shows')
      },
    }
  )
}

/**
 * Undo a bulk schedule. Only reverts the slots the scheduler wrote and nobody
 * changed since; anything already published stays published.
 */
export async function unscheduleShowEpisodes(
  showId: string
): Promise<ActionResult<{ cleared?: number }>> {
  return runAdminAction(
    adminEnv,
    (ctx) =>
      unscheduleShowCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId, now: new Date() },
        showId
      ),
    {
      fallbackError: 'Failed to unschedule episodes',
      revalidate: (result) => {
        revalidateShowPage(result, showId)
        updateTag('episodes')
        updateTag('shows')
      },
    }
  )
}

// ---------------------------------------------------------------------------
// Artwork Upload / Delete
// ---------------------------------------------------------------------------

const ARTWORK_UPLOAD_SLOTS = [
  'poster',
  'card',
  'hero',
  'hero-mobile',
  'logo',
] as const

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Note: an earlier deleteArtwork() server action was removed here. Post-versioning
// the UI uses form-state clearing (null-out the URL on Save) instead of an
// imperative storage delete — the orphaned versioned files are collected by the
// /api/cron/cleanup-media sweep. The old deleteArtwork built a stable path
// (shows/{id}/{slot}.{ext}) which stopped matching real filenames after the
// versioning migration, so keeping it around was a silent-failure trap.

// ---------------------------------------------------------------------------
// Hero Video Management
// ---------------------------------------------------------------------------

/**
 * R2-backed ports for the video core (plan 02-16): the app Worker's MEDIA binding for
 * head, a 4 MiB range read and delete. Nothing here reads a whole video, and nothing
 * deletes a Supabase Storage original: only keys behind our own media origin qualify.
 */
async function videoPorts(db: AdminDb, appConfigVersion?: RowVersion): Promise<HeroVideoPorts> {
  const env = await getWorkerEnv()
  const bucket = env.MEDIA as unknown as FinalizeBucket
  const mediaOrigin = getPublicMediaOrigin()
  return {
    db,
    mediaOrigin,
    appConfigVersion,
    finalize: async (input) => {
      const r = await finalizeUploadedObject({
        kind: input.kind,
        slot: input.slot,
        showId: input.showId,
        userId: input.userId,
        key: input.key,
        variantKeys: [],
        bucket,
      })
      if (r.ok) return { ok: true, key: r.key }
      return { ok: false, error: r.error, ...(r.cleanupFailed ? { cleanupFailed: true as const } : {}) }
    },
    head: async (key) => {
      const head = await bucket.head(key)
      return head ? { size: head.size } : null
    },
    readHead: async (key, maxBytes) => {
      const object = await bucket.get(key, { range: { offset: 0, length: maxBytes } })
      return object ? new Uint8Array(await object.arrayBuffer()) : null
    },
    media: {
      delete: (keys) => bucket.delete(keys),
      // Nothing is deleted before commit, so rollback has nothing to restore. Commit re-reads
      // every reference and keeps a key still used anywhere (deferred items 21-23).
      stageDeletion: async (keys) => stageR2Deletion(bucket, keys, mediaGuard(db, '[video]')),
    },
    hasAudioTrack: mp4BytesHasAudioTrack,
    previousR2Keys: (url) => r2KeysForUrl(url, mediaOrigin),
    storagePathFromUrl: (url) => r2KeyFromUrl(url, mediaOrigin) ?? getPublicStoragePath(url, 'site-assets'),
  }
}

export async function setHeroVideoUrl(
  youtubeUrl: string,
  variant: HeroVariant,
  expectedUpdatedAt: string
): Promise<VersionedResult> {
  // The runner checks admin first; validation runs inside it so a non-admin
  // learns nothing about what a valid URL looks like.
  return runAdminAction(
    adminEnv,
    async (ctx) => {
      const version = rowVersion(expectedUpdatedAt)
      if (!version.ok) return { success: false, error: version.error, wrote: false }
      const trimmed = typeof youtubeUrl === 'string' ? youtubeUrl.trim() : ''
      if (!trimmed) return { success: false, error: 'URL is required', wrote: false }

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
          wrote: false,
        }
      }

      // Store canonical form so viewers always get a predictable embed URL.
      const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`
      const r = await setHeroVideoUrlCore(
        await videoPorts(ctx.db, version.value),
        { audit: ctx.audit, adminUserId: ctx.adminUserId },
        { canonicalUrl, variant }
      )
      if (r.mediaCleanupFailed) console.error('[setHeroVideoUrl] media cleanup failed')
      return withUpdatedAt(r, version.value)
    },
    {
      fallbackError: 'Failed to save URL',
      revalidate: () => {
        updateTag('site-config')
        revalidatePath('/')
      },
    }
  )
}

export async function removeHeroVideo(
  variant: HeroVariant,
  expectedUpdatedAt: string
): Promise<VersionedResult> {
  return runAdminAction(
    adminEnv,
    async (ctx) => {
      const version = rowVersion(expectedUpdatedAt)
      if (!version.ok) return { success: false, error: version.error, wrote: false }
      const r = await removeHeroVideoCore(
        await videoPorts(ctx.db, version.value),
        { audit: ctx.audit, adminUserId: ctx.adminUserId },
        { variant }
      )
      if (r.mediaCleanupFailed) console.error('[removeHeroVideo] media cleanup failed')
      return withUpdatedAt(r, version.value)
    },
    {
      fallbackError: 'Failed to remove video',
      revalidate: () => {
        updateTag('site-config')
        revalidatePath('/')
      },
    }
  )
}

export async function setHeroVideoMuted(
  muted: boolean,
  expectedUpdatedAt: string
): Promise<VersionedResult> {
  try {
    await assertAdmin()
    const version = rowVersion(expectedUpdatedAt)
    if (!version.ok) return { success: false, error: version.error }
    if (typeof muted !== 'boolean') return { success: false, error: 'Invalid audio setting' }
    const { error } = await updateIfUnchanged(
      createAdminClient(),
      'app_config',
      1,
      { hero_video_muted: muted },
      version.value
    )
    if (error) return { success: false, error }

    updateTag('site-config')
    revalidatePath('/')

    return { success: true, updatedAt: version.value.next ?? undefined }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update audio setting',
    }
  }
}

// ---------------------------------------------------------------------------
// Preloader Video Management
// ---------------------------------------------------------------------------

export async function removePreloaderVideo(expectedUpdatedAt: string): Promise<VersionedResult> {
  try {
    await assertAdmin()
    const version = rowVersion(expectedUpdatedAt)
    if (!version.ok) return { success: false, error: version.error }
    const admin = createAdminClient()
    // Compare-and-swap clear, then the R2 object goes only if nothing else uses it (R2 only:
    // a preloader that still points at a Supabase original keeps that file, MEDIA-07).
    const result = await removeMediaCore(
      {
        db: admin,
        media: (await getWorkerEnv()).MEDIA as unknown as DeletableBucket,
        mediaOrigin: getPublicMediaOrigin(),
        version: version.value,
      },
      {
        kind: 'clear-column',
        table: 'app_config',
        id: 1,
        column: 'preloader_video_url',
        notFound: 'Could not load site config',
      },
      '[removePreloaderVideo]'
    )
    if (!result.success) return { success: false, error: result.error }

    updateTag('site-config')
    revalidatePath('/', 'layout')

    return { success: true, updatedAt: version.value.next ?? undefined }
  } catch (err) {
    console.error('[removePreloaderVideo] failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove video',
    }
  }
}

// ---------------------------------------------------------------------------
// Per-Show Hero Video Management
// ---------------------------------------------------------------------------

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
    const idParsed = parseId(showId, 'show')
    if (!idParsed.ok) return { success: false, error: idParsed.error }
    showId = idParsed.value
    const admin = createAdminClient()

    // Get current featured state
    const { data: show, error: fetchErr } = await admin
      .from('shows')
      .select('featured')
      .eq('id', showId)
      .single()

    if (fetchErr || !show) throw new Error('Show not found')

    const newFeatured = !show.featured

    // Compare-and-swap on the value just read: two clicks at once flip it exactly once.
    const { data: flipped, error } = await admin
      .from('shows')
      .update({ featured: !show.featured })
      .eq('id', showId)
      .eq('featured', show.featured)
      .select('id')

    if (error) throw error
    if (!flipped || flipped.length === 0) return { success: false, error: SAVE_CONFLICT }

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
  site_description_ar: z.string().trim().max(300).nullable(),
  site_tagline: z.string().trim().min(1, 'Tagline is required').max(120),
  site_tagline_ar: z.string().trim().max(120).nullable(),
})
// Each *_ar field's max: an AI fill longer than it is dropped (review item 7, PR #29).
const siteMetadataArMax = arabicMaxLengths(siteMetadataSchema)

const authPageSchema = z.object({
  auth_heading: z.string().trim().max(120).nullable(),
  auth_heading_ar: z.string().trim().max(120).nullable(),
  auth_subheading: z.string().trim().max(300).nullable(),
  auth_subheading_ar: z.string().trim().max(300).nullable(),
  auth_quote: z.string().trim().max(400).nullable(),
  auth_quote_ar: z.string().trim().max(400).nullable(),
  auth_quote_attribution: z.string().trim().max(120).nullable(),
  auth_quote_attribution_ar: z.string().trim().max(120).nullable(),
  auth_allow_skip: z.boolean(),
})
const authPageArMax = arabicMaxLengths(authPageSchema)

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
  live_stream_label: z
    .string()
    .max(40)
    .nullish()
    .transform((v) => (!v || v.trim() === '' ? null : v.trim())),
  live_stream_label_ar: z
    .string()
    .max(40)
    .nullish()
    .transform((v) => (!v || v.trim() === '' ? null : v.trim())),
})

const footerSchema = z.object({
  tagline: z.string().max(300),
  taglineAr: z.string().max(300).default(''),
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
const footerArMax = arabicMaxLengths(footerSchema)

const hrefOrEmpty = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) =>
      v === '' ||
      (v.startsWith('/') &&
        !v.startsWith('//') &&
        !v.includes('\\')) ||
      /^https?:\/\//i.test(v),
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
  google_analytics_id: z
    .string()
    .trim()
    .max(40)
    .nullable()
    .refine(
      (v) => v === null || v === '' || /^G-[A-Z0-9]{4,20}$/.test(v),
      'Invalid Google Analytics ID'
    ),
  meta_pixel_id: z
    .string()
    .trim()
    .max(40)
    .nullable()
    .refine(
      (v) => v === null || v === '' || /^[0-9]{6,20}$/.test(v),
      'Invalid Meta Pixel ID'
    ),
  /** Omit to leave the stored key unchanged; null clears it. */
  youtube_api_key: z.string().trim().max(100).nullable().optional(),
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
  tag_ar: z.string().trim().max(24).optional(),
  text_ar: z.string().trim().max(240).optional(),
  tag2_ar: z.string().trim().max(24).optional(),
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

// Busts the page cache for every page that renders FAQs so edits apply
// on the very next request after save.
function bumpFaqCache() {
  revalidatePath('/', 'layout')
}

// Busts the page cache for every public legal page so edits apply immediately.
// Pass the saved slug to also revalidate /legal/[slug] for that page.
function bumpLegalCache(slug?: string) {
  revalidatePath('/privacy', 'page')
  revalidatePath('/terms', 'page')
  if (slug) revalidatePath(`/legal/${slug}`, 'page')
  revalidatePath('/', 'layout')
}

/**
 * Log a settings-tab save to the audit log. Every updateX() below calls this
 * with the column(s) it touched so the audit dashboard can show "admin
 * changed footer_content, tagline, social.x" instead of a generic
 * "config_update" row.
 */
async function auditConfigUpdate(
  adminUserId: string,
  changedKeys: string[],
  extra: Record<string, unknown> = {}
) {
  await logAudit({
    adminUserId,
    action: 'config_update',
    entity: 'app_config',
    diff: { keys: changedKeys, ...extra },
  })
}

/**
 * Write one settings section of the app_config row (deferred item 23, residual b): only while
 * the row still holds the updated_at the settings page loaded (or our own last save produced).
 * 0 rows is the conflict line and nothing is written; success leaves the new value in
 * `version.next`.
 */
function saveConfigSection(patch: Record<string, unknown>, version: RowVersion) {
  return updateIfUnchanged(createAdminClient(), 'app_config', 1, patch, version)
}

export async function updateLiveStreamUrl(
  input: z.input<typeof liveStreamUrlSchema>,
  expectedUpdatedAt: string
): Promise<VersionedResult> {
  try {
    const user = await assertAdmin()
    const version = rowVersion(expectedUpdatedAt)
    if (!version.ok) return { success: false, error: version.error }
    const parsed = liveStreamUrlSchema.parse(input)
    const { error } = await saveConfigSection(
      {
        live_stream_url: parsed.live_stream_url,
        live_stream_label: parsed.live_stream_label,
        live_stream_label_ar: parsed.live_stream_label_ar,
      },
      version.value
    )
    if (error) return { success: false, error }
    await auditConfigUpdate(user.id, [
      'live_stream_url',
      'live_stream_label',
      'live_stream_label_ar',
    ])
    bumpSiteConfigCache()
    return { success: true, updatedAt: version.value.next ?? undefined }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save',
    }
  }
}

export async function updateSiteMetadata(
  input: z.input<typeof siteMetadataSchema>,
  expectedUpdatedAt: string
): Promise<VersionedResult> {
  try {
    const user = await assertAdmin()
    const version = rowVersion(expectedUpdatedAt)
    if (!version.ok) return { success: false, error: version.error }
    const parsed = siteMetadataSchema.parse(input)

    // Auto-fill blank Arabic fields from their English source (Workers AI).
    const arabic = createArabicFiller(user.id)
    parsed.site_description_ar = await arabic.fill(
      parsed.site_description,
      parsed.site_description_ar,
      siteMetadataArMax.site_description_ar
    )
    parsed.site_tagline_ar = await arabic.fill(
      parsed.site_tagline,
      parsed.site_tagline_ar,
      siteMetadataArMax.site_tagline_ar
    )

    const { error } = await saveConfigSection(parsed, version.value)
    if (error) return { success: false, error }
    await auditConfigUpdate(user.id, Object.keys(parsed))
    bumpSiteConfigCache()
    return withArabicMissing(
      { success: true, updatedAt: version.value.next ?? undefined },
      arabic.missing()
    )
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save',
    }
  }
}

export async function updateAuthPageConfig(
  input: z.input<typeof authPageSchema>,
  expectedUpdatedAt: string
): Promise<VersionedResult> {
  try {
    const user = await assertAdmin()
    const version = rowVersion(expectedUpdatedAt)
    if (!version.ok) return { success: false, error: version.error }
    const parsed = authPageSchema.parse(input)

    // Auto-fill blank Arabic copy from the English source (Workers AI).
    const arabic = createArabicFiller(user.id)
    parsed.auth_heading_ar = await arabic.fill(
      parsed.auth_heading,
      parsed.auth_heading_ar,
      authPageArMax.auth_heading_ar
    )
    parsed.auth_subheading_ar = await arabic.fill(
      parsed.auth_subheading,
      parsed.auth_subheading_ar,
      authPageArMax.auth_subheading_ar
    )
    parsed.auth_quote_ar = await arabic.fill(
      parsed.auth_quote,
      parsed.auth_quote_ar,
      authPageArMax.auth_quote_ar
    )
    parsed.auth_quote_attribution_ar = await arabic.fill(
      parsed.auth_quote_attribution,
      parsed.auth_quote_attribution_ar,
      authPageArMax.auth_quote_attribution_ar
    )

    const { error } = await saveConfigSection(parsed, version.value)
    if (error) return { success: false, error }
    await auditConfigUpdate(user.id, Object.keys(parsed))
    bumpSiteConfigCache()
    return withArabicMissing(
      { success: true, updatedAt: version.value.next ?? undefined },
      arabic.missing()
    )
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save',
    }
  }
}

export async function updateFooterContent(
  input: z.input<typeof footerSchema>,
  expectedUpdatedAt: string
): Promise<VersionedResult> {
  try {
    const user = await assertAdmin()
    const version = rowVersion(expectedUpdatedAt)
    if (!version.ok) return { success: false, error: version.error }
    const parsed = footerSchema.parse(input)

    // Auto-fill blank Arabic tagline from English (Workers AI).
    const arabic = createArabicFiller(user.id)
    parsed.taglineAr = (await arabic.fill(parsed.tagline, parsed.taglineAr, footerArMax.taglineAr)) ?? ''

    // The social icon urls ride in this jsonb: a stale footer form can no longer write back
    // an icon url another save already replaced.
    const { error } = await saveConfigSection({ footer_content: parsed }, version.value)
    if (error) return { success: false, error }
    await auditConfigUpdate(user.id, ['footer_content'])
    bumpSiteConfigCache()
    return withArabicMissing(
      { success: true, updatedAt: version.value.next ?? undefined },
      arabic.missing()
    )
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save',
    }
  }
}

const portfolioContentSchema = z.object({
  hero_description: z.string().trim().max(500).nullable(),
  hero_description_ar: z.string().trim().max(500).nullable(),
  portfolio_heading: z.string().trim().max(200).nullable(),
  portfolio_heading_ar: z.string().trim().max(200).nullable(),
})
const portfolioArMax = arabicMaxLengths(portfolioContentSchema)

export async function updatePortfolioContent(
  input: z.input<typeof portfolioContentSchema>,
  expectedUpdatedAt: string
): Promise<VersionedResult> {
  try {
    const user = await assertAdmin()
    const version = rowVersion(expectedUpdatedAt)
    if (!version.ok) return { success: false, error: version.error }
    const parsed = portfolioContentSchema.parse(input)

    // Auto-fill blank Arabic fields from their English source (Workers AI).
    const arabic = createArabicFiller(user.id)
    parsed.hero_description_ar = await arabic.fill(
      parsed.hero_description,
      parsed.hero_description_ar,
      portfolioArMax.hero_description_ar
    )
    parsed.portfolio_heading_ar = await arabic.fill(
      parsed.portfolio_heading,
      parsed.portfolio_heading_ar,
      portfolioArMax.portfolio_heading_ar
    )

    const updatePayload = {
      hero_description: parsed.hero_description,
      hero_description_ar: parsed.hero_description_ar,
      portfolio_heading: parsed.portfolio_heading,
      portfolio_heading_ar: parsed.portfolio_heading_ar,
    }
    const { error } = await saveConfigSection(updatePayload, version.value)

    if (error) return { success: false, error }
    await auditConfigUpdate(user.id, [
      'hero_description',
      'hero_description_ar',
      'portfolio_heading',
      'portfolio_heading_ar',
    ])
    bumpSiteConfigCache()
    return withArabicMissing(
      { success: true, updatedAt: version.value.next ?? undefined },
      arabic.missing()
    )
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save',
    }
  }
}

export async function updateContactRecipient(
  input: { contactEmail: string },
  expectedUpdatedAt: string
): Promise<VersionedResult> {
  try {
    const user = await assertAdmin()
    const version = rowVersion(expectedUpdatedAt)
    if (!version.ok) return { success: false, error: version.error }
    const admin = createAdminClient()

    // Read footer_content fresh (not cached getAppConfig, which defaults to
    // social: [] on a read miss). Fail closed so a transient read failure can
    // never overwrite admin-managed fields like social links.
    const { data: cfgRow, error: readErr } = await admin
      .from('app_config')
      .select('footer_content')
      .eq('id', 1)
      .single<{ footer_content: unknown }>()
    if (readErr || !cfgRow) {
      return {
        success: false,
        error: readErr?.message ?? 'Could not read current footer content',
      }
    }
    const currentFooter =
      cfgRow.footer_content && typeof cfgRow.footer_content === 'object'
        ? (cfgRow.footer_content as Record<string, unknown>)
        : {}

    const parsed = footerSchema.parse({
      ...currentFooter,
      contactEmail: input.contactEmail,
    })
    // Lands only while the row still holds the updated_at the inbox page loaded, so the footer
    // read above is the one we merge into (no other save in between).
    const { error } = await updateIfUnchanged(admin, 'app_config', 1, { footer_content: parsed }, version.value)
    if (error) return { success: false, error }
    await auditConfigUpdate(user.id, ['footer_content.contactEmail'])
    bumpSiteConfigCache()
    revalidatePath('/admin/inbox')
    return { success: true, updatedAt: version.value.next ?? undefined }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save',
    }
  }
}

export async function updateCtaCopy(
  input: z.input<typeof ctaCopySchema>,
  expectedUpdatedAt: string
): Promise<VersionedResult> {
  try {
    const user = await assertAdmin()
    const version = rowVersion(expectedUpdatedAt)
    if (!version.ok) return { success: false, error: version.error }
    const parsed = ctaCopySchema.parse(input)
    const { error } = await saveConfigSection({ cta_copy: parsed }, version.value)
    if (error) return { success: false, error }
    await auditConfigUpdate(user.id, ['cta_copy'])
    bumpSiteConfigCache()
    return { success: true, updatedAt: version.value.next ?? undefined }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save',
    }
  }
}

export async function updateGenreConfig(
  input: z.input<typeof genreConfigSchema>,
  expectedUpdatedAt: string
): Promise<VersionedResult> {
  try {
    const user = await assertAdmin()
    const version = rowVersion(expectedUpdatedAt)
    if (!version.ok) return { success: false, error: version.error }
    const parsed = genreConfigSchema.parse(input)
    const { error } = await saveConfigSection({ genre_config: parsed }, version.value)
    if (error) return { success: false, error }
    await auditConfigUpdate(user.id, ['genre_config'])
    bumpSiteConfigCache()
    return { success: true, updatedAt: version.value.next ?? undefined }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save',
    }
  }
}

export async function updateIntegrations(
  input: z.input<typeof integrationsSchema>,
  expectedUpdatedAt: string
): Promise<VersionedResult> {
  try {
    const user = await assertAdmin()
    const version = rowVersion(expectedUpdatedAt)
    if (!version.ok) return { success: false, error: version.error }
    const parsed = integrationsSchema.parse(input)
    // Empty strings from form inputs → null so DB stays clean
    const cleaned: Record<string, string | null> = {
      google_analytics_id: parsed.google_analytics_id?.trim() || null,
      meta_pixel_id: parsed.meta_pixel_id?.trim() || null,
    }
    if (parsed.youtube_api_key !== undefined) {
      cleaned.youtube_api_key = parsed.youtube_api_key?.trim() || null
    }
    const { error } = await saveConfigSection(cleaned, version.value)
    if (error) return { success: false, error }
    // Log which integration keys were touched without leaking the secret values.
    const keysTouched = Object.entries(cleaned)
      .filter(([, v]) => v !== null)
      .map(([k]) => k)
    await auditConfigUpdate(
      user.id,
      keysTouched.length ? keysTouched : ['integrations_cleared']
    )
    bumpSiteConfigCache()
    return { success: true, updatedAt: version.value.next ?? undefined }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save',
    }
  }
}

export async function updateFeatureFlags(
  input: z.input<typeof featureFlagsSchema>,
  expectedUpdatedAt: string
): Promise<VersionedResult> {
  try {
    const user = await assertAdmin()
    const version = rowVersion(expectedUpdatedAt)
    if (!version.ok) return { success: false, error: version.error }
    const parsed = featureFlagsSchema.parse(input)
    const { error } = await saveConfigSection({ feature_flags: parsed }, version.value)
    if (error) return { success: false, error }
    await auditConfigUpdate(user.id, ['feature_flags'])
    bumpSiteConfigCache()
    return { success: true, updatedAt: version.value.next ?? undefined }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save',
    }
  }
}

export async function updateTopTicker(
  input: z.input<typeof topTickerSchema>,
  expectedUpdatedAt: string
): Promise<VersionedResult<{ untranslated: number }>> {
  try {
    const user = await assertAdmin()
    const version = rowVersion(expectedUpdatedAt)
    if (!version.ok) return { success: false, error: version.error }
    const parsed = topTickerSchema.parse(input)
    const trimmed: TickerItem[] = parsed.items
      .map((row) => ({
        tag: row.tag.trim(),
        text: row.text.trim(),
        ...(row.tag2?.trim() && { tag2: row.tag2.trim() }),
        ...(row.tag_ar?.trim() && { tag_ar: row.tag_ar.trim() }),
        ...(row.text_ar?.trim() && { text_ar: row.text_ar.trim() }),
        ...(row.tag2_ar?.trim() && { tag2_ar: row.tag2_ar.trim() }),
      }))
      .filter((row) => row.tag.length > 0 || row.text.length > 0 || (row.tag2 ?? '').length > 0)

    // Auto-fill blank Arabic fields (strict, per-admin rate limit): never English in an Arabic slot.
    const arabic = createArabicFiller(user.id)
    const { items, untranslated } = await fillTickerArabic(trimmed, arabic.fillBatch, arabicMaxLengths(topTickerItemSchema))

    if (parsed.enabled && items.length === 0) {
      return {
        success: false,
        error: 'Add at least one ticker line, or turn the ticker off.',
      }
    }

    const payload = { enabled: parsed.enabled, items }
    const { error } = await saveConfigSection({ top_ticker: payload }, version.value)
    if (error) return { success: false, error }
    await auditConfigUpdate(user.id, ['top_ticker'], { untranslated })
    bumpSiteConfigCache()
    return { success: true, data: { untranslated }, updatedAt: version.value.next ?? undefined }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save',
    }
  }
}

// Maps each upload kind to the app_config column it writes.
const SITE_IMAGE_COLUMN = {
  og: 'og_image_url',
  favicon: 'favicon_url',
  'favicon-dark': 'favicon_dark_url',
  auth: 'auth_image_url',
} as const

type SiteImageKind = keyof typeof SITE_IMAGE_COLUMN

// Own keys only: `in` would accept inherited names such as 'toString' or '__proto__'.
// (Object.hasOwn semantics; tsconfig lib predates ES2022, so the prototype form is used.)
function isSiteImageKind(kind: unknown): kind is SiteImageKind {
  return typeof kind === 'string' && Object.prototype.hasOwnProperty.call(SITE_IMAGE_COLUMN, kind)
}

export async function removeSiteImage(
  kind: SiteImageKind,
  expectedUpdatedAt: string
): Promise<VersionedResult> {
  try {
    await assertAdmin()
    if (!isSiteImageKind(kind)) return { success: false, error: 'Invalid kind' }
    const version = rowVersion(expectedUpdatedAt)
    if (!version.ok) return { success: false, error: version.error }
    const admin = createAdminClient()
    // Compare-and-swap clear, then the R2 object goes only if no other live value (another
    // site image, a show, a profile...) still uses it. R2 only; a Supabase original is never
    // deleted (MEDIA-07).
    const result = await removeMediaCore(
      {
        db: admin,
        media: (await getWorkerEnv()).MEDIA as unknown as DeletableBucket,
        mediaOrigin: getPublicMediaOrigin(),
        version: version.value,
      },
      {
        kind: 'clear-column',
        table: 'app_config',
        id: 1,
        column: SITE_IMAGE_COLUMN[kind],
        notFound: 'Could not load site config',
      },
      '[removeSiteImage]'
    )
    if (!result.success) return { success: false, error: result.error }

    bumpSiteConfigCache()
    return { success: true, updatedAt: version.value.next ?? undefined }
  } catch (err) {
    console.error('[admin/actions] mutation failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove',
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

    const { data: lastShort } = await admin
      .from('shorts')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: short, error } = await admin
      .from('shorts')
      .insert({ ...parsed, sort_order: (lastShort?.sort_order ?? -1) + 1 })
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

/** Lands only while the row still holds the updated_at the drawer opened (review item 8, PR #29). */
export async function updateShort(
  id: string,
  data: z.input<typeof shortSchema>,
  expectedUpdatedAt: string
): Promise<VersionedResult> {
  try {
    const user = await assertAdmin()
    const idParsed = parseId(id, 'short')
    if (!idParsed.ok) return { success: false, error: idParsed.error }
    id = idParsed.value
    const version = rowVersion(expectedUpdatedAt)
    if (!version.ok) return { success: false, error: version.error }
    const parsed = shortSchema.parse(data)
    const admin = createAdminClient()

    const { error, row } = await updateIfUnchanged(admin, 'shorts', id, parsed, version.value, '*')
    if (error || !row) return { success: false, error: error ?? 'Short not found.' }
    const short = row as unknown as Database['public']['Tables']['shorts']['Row']

    await logAudit({
      adminUserId: user.id,
      action: 'update',
      entity: 'short',
      entityId: short.id,
      diff: { data: { title: short.title } },
    })

    revalidatePath('/admin/shorts')
    updateTag('shorts')
    return withUpdatedAt({ success: true, data: short }, version.value)
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
    const idParsed = parseId(id, 'short')
    if (!idParsed.ok) return { success: false, error: idParsed.error }
    id = idParsed.value
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
    const idParsed = parseId(id, 'short')
    if (!idParsed.ok) return { success: false, error: idParsed.error }
    id = idParsed.value
    const dirParsed = parseDirection(direction)
    if (!dirParsed.ok) return { success: false, error: dirParsed.error }
    direction = dirParsed.value
    const admin = createAdminClient()

    const { data: shorts, error: fetchError } = await admin
      .from('shorts')
      .select('id, title, sort_order')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (fetchError) return { success: false, error: fetchError.message }

    const ordered = [...(shorts ?? [])]
    const currentIndex = ordered.findIndex((short) => short.id === id)
    if (currentIndex === -1) return { success: false, error: 'Short not found' }
    const adjacentIndex =
      direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (adjacentIndex < 0 || adjacentIndex >= ordered.length) {
      return { success: false, error: 'No short to swap with' }
    }

    // Swap the two rows in the array, then normalize every short's sort_order
    // to its sequential index. This avoids the all-zeros collision that made
    // a two-item value swap a no-op, and keeps sort_orders clean going forward.
    const moving = ordered[currentIndex]!
    ordered[currentIndex] = ordered[adjacentIndex]!
    ordered[adjacentIndex] = moving

    const results = await Promise.all(
      ordered.map((short, index) =>
        admin.from('shorts').update({ sort_order: index }).eq('id', short.id)
      )
    )
    const error = results.find((result) => result.error)?.error
    if (error) return { success: false, error: error.message }

    await logAudit({
      adminUserId: user.id,
      action: 'update',
      entity: 'short',
      entityId: id,
      diff: {
        direction,
        ordered_ids: ordered.map((short) => short.id),
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
  return runAdminAction(
    adminEnv,
    (ctx) => deleteRowAuditedCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId }, ROW_DELETE.short, id),
    {
      fallbackError: 'Failed to delete short',
      revalidate: () => {
        revalidatePath('/admin/shorts')
        updateTag('shorts')
      },
    }
  )
}

// ---------------------------------------------------------------------------
// Reviews Moderation Actions
// ---------------------------------------------------------------------------

export async function deleteReview(id: string): Promise<ActionResult> {
  return runAdminAction(
    adminEnv,
    (ctx) => deleteRowAuditedCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId }, ROW_DELETE.review, id),
    {
      fallbackError: 'Failed to delete review',
      revalidate: () => {
        revalidatePath('/admin/reviews')
      },
    }
  )
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

function getPublicStoragePath(url: string | null, bucket: string) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const prefix = '/storage/v1/object/public/' + bucket + '/'
    if (!parsed.pathname.startsWith(prefix)) return null
    const path = decodeURIComponent(parsed.pathname.slice(prefix.length))
    return path && !path.startsWith('/') && !path.split('/').includes('..')
      ? path
      : null
  } catch {
    return null
  }
}

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

// ---------------------------------------------------------------------------
// Direct-to-R2 image finalize (plan 02-15). The browser has already PUT the object
// (and optional WebP variants) to R2 with a presigned URL; these actions take only
// the key, verify it (size, kind/owner prefix, magic bytes), write ONE target,
// audit strictly, then delete the previous R2 object. No file body ever arrives.
// The old FormData upload* actions above stay until plan 02-19 removes them.
// ---------------------------------------------------------------------------

const finalizeKeySchema = z.object({
  key: z.string().min(1).max(300),
  variantKeys: z.array(z.string().max(400)).max(3).default([]),
})

const ARTWORK_COLUMN = {
  poster: 'poster_url',
  card: 'card_image_url',
  hero: 'hero_url',
  'hero-mobile': 'hero_image_mobile_url',
  logo: 'logo_url',
} as const satisfies Record<(typeof ARTWORK_UPLOAD_SLOTS)[number], string>

// Live scopes (Phase 01.1 review): a re-sent key live in ANY of these is refused before finalize.
const ARTWORK_COLUMNS = Object.values(ARTWORK_COLUMN)
const SITE_IMAGE_COLUMNS = Object.values(SITE_IMAGE_COLUMN)

async function adminImagePorts(
  db: AdminDb,
  audit: AuditWriter,
  appConfigVersion?: RowVersion
): Promise<ImageUploadPorts> {
  const env = await getWorkerEnv()
  const bucket = env.MEDIA as unknown as FinalizeBucket
  const mediaOrigin = getPublicMediaOrigin()
  return {
    finalize: (input) =>
      finalizeUploadedObject({
        kind: input.kind as Parameters<typeof finalizeUploadedObject>[0]['kind'],
        slot: input.slot,
        showId: input.showId,
        userId: input.userId,
        key: input.key,
        variantKeys: input.variantKeys,
        liveKeys: input.liveKeys,
        bucket,
      }),
    db: adminImageDb(db, appConfigVersion),
    media: { delete: (keys) => bucket.delete(keys) },
    audit,
    mediaOrigin,
    previousR2Keys: (url) => r2KeysForUrl(url, mediaOrigin),
    liveKeys: (url) => liveKeysForUrl(url, mediaOrigin),
    // Every scope, read fresh before finalize and again right before each delete.
    references: () => readMediaReferenceUrls(db as unknown as ReferenceDb),
  }
}

const finalizeArtworkSchema = finalizeKeySchema.extend({
  showId: z.string().regex(UUID_RE, 'Invalid showId or slot'),
  slot: z.enum(ARTWORK_UPLOAD_SLOTS, { message: 'Invalid showId or slot' }),
  /**
   * Default true: the slot column of this show is written. A form that holds the
   * new url in its own state until Save (as the artwork drawer does today) passes false.
   */
  commit: z.boolean().default(true),
})

export async function finalizeArtworkUpload(
  input: z.input<typeof finalizeArtworkSchema>
): Promise<ActionResult<string> & { mediaCleanupFailed?: boolean }> {
  return runAdminAction(
    adminEnv,
    async (ctx) => {
      const parsed = finalizeArtworkSchema.safeParse(input)
      if (!parsed.success) {
        return { success: false, error: formatZodError(parsed.error), wrote: false }
      }
      const { showId, slot, key, variantKeys, commit } = parsed.data
      return finalizeImageUploadCore(await adminImagePorts(ctx.db, ctx.audit), {
        kind: 'artwork',
        slot,
        showId,
        key,
        variantKeys,
        userId: ctx.adminUserId,
        target: commit ? { type: 'show-artwork', showId, column: ARTWORK_COLUMN[slot] } : null,
        live: { type: 'show-artwork', showId, columns: ARTWORK_COLUMNS },
      })
    },
    { fallbackError: 'Upload failed', revalidate: (r) => (r?.wrote ? bumpCatalogCache() : undefined) }
  )
}

const finalizeSiteImageSchema = finalizeKeySchema.extend({
  kind: z.enum(['og', 'favicon', 'favicon-dark', 'auth'], { message: 'Invalid kind' }),
})

export async function finalizeSiteImageUpload(
  input: z.input<typeof finalizeSiteImageSchema> & { expectedUpdatedAt: string }
): Promise<VersionedResult<string> & { mediaCleanupFailed?: boolean }> {
  return runAdminAction(
    adminEnv,
    async (ctx) => {
      const parsed = finalizeSiteImageSchema.safeParse(input)
      if (!parsed.success) {
        return { success: false, error: formatZodError(parsed.error), wrote: false }
      }
      // The settings page's app_config updated_at (deferred item 23, residual b); input is an
      // object here (the schema parse above refused anything else).
      const version = rowVersion(input.expectedUpdatedAt)
      if (!version.ok) return { success: false, error: version.error, wrote: false }
      const { kind, key, variantKeys } = parsed.data
      const r = await finalizeImageUploadCore(await adminImagePorts(ctx.db, ctx.audit, version.value), {
        kind: 'site-image',
        slot: kind,
        key,
        variantKeys,
        userId: ctx.adminUserId,
        target: { type: 'app-config', column: SITE_IMAGE_COLUMN[kind] },
        live: { type: 'app-config', columns: SITE_IMAGE_COLUMNS },
      })
      return withUpdatedAt(r, version.value)
    },
    { fallbackError: 'Upload failed', revalidate: (r) => (r?.wrote ? bumpSiteConfigCache() : undefined) }
  )
}

// A social icon url lives in the footer form until the footer is saved (as today),
// so this finalize verifies and audits the object but changes no database row.
export async function finalizeSocialIconUpload(
  input: z.input<typeof finalizeKeySchema>
): Promise<ActionResult<string> & { mediaCleanupFailed?: boolean }> {
  return runAdminAction(
    adminEnv,
    async (ctx) => {
      const parsed = finalizeKeySchema.safeParse(input)
      if (!parsed.success) {
        return { success: false, error: formatZodError(parsed.error), wrote: false }
      }
      const { key, variantKeys } = parsed.data
      return finalizeImageUploadCore(await adminImagePorts(ctx.db, ctx.audit), {
        kind: 'social-icon',
        slot: null,
        key,
        variantKeys,
        userId: ctx.adminUserId,
        target: null,
        live: { type: 'social-icons' },
      })
    },
    { fallbackError: 'Upload failed', revalidate: () => undefined }
  )
}

const finalizeCastImageSchema = finalizeKeySchema.extend({
  showId: z.string().regex(UUID_RE, 'Invalid show id'),
  /** Absent while the cast member does not exist yet: the url is returned and saved with the member. */
  castId: z.string().regex(UUID_RE, 'Invalid cast member id').optional(),
})

export async function finalizeCastImageUpload(
  input: z.input<typeof finalizeCastImageSchema>
): Promise<ActionResult<string> & { mediaCleanupFailed?: boolean }> {
  return runAdminAction(
    adminEnv,
    async (ctx) => {
      const parsed = finalizeCastImageSchema.safeParse(input)
      if (!parsed.success) {
        return { success: false, error: formatZodError(parsed.error), wrote: false }
      }
      const { showId, castId, key, variantKeys } = parsed.data
      return finalizeImageUploadCore(await adminImagePorts(ctx.db, ctx.audit), {
        kind: 'cast-image',
        slot: null,
        showId,
        key,
        variantKeys,
        userId: ctx.adminUserId,
        target: castId ? { type: 'cast', castId, showId } : null,
        live: { type: 'show-cast', showId },
      })
    },
    {
      fallbackError: 'Failed to upload cast image',
      revalidate: (r) => (r?.wrote ? bumpCatalogCache() : undefined),
    }
  )
}

// ---------------------------------------------------------------------------
// Video finalize actions (plan 02-16): the browser PUT the MP4 to R2 with a presigned
// URL; these check it and write the target. No video bytes pass through an action.
// ---------------------------------------------------------------------------

const finalizeVideoKeySchema = z.object({ key: z.string().min(1).max(300) })

const finalizeHeroVideoSchema = finalizeVideoKeySchema.extend({
  variant: z.enum(['desktop', 'mobile'], { message: 'Invalid hero variant.' }),
})

export async function finalizeHeroVideoUpload(
  input: z.input<typeof finalizeHeroVideoSchema> & { expectedUpdatedAt: string }
): Promise<VersionedResult<string> & { mediaCleanupFailed?: boolean }> {
  return runAdminAction(
    adminEnv,
    async (ctx) => {
      const parsed = finalizeHeroVideoSchema.safeParse(input)
      if (!parsed.success) {
        return { success: false, error: formatZodError(parsed.error), wrote: false }
      }
      // The settings page's app_config updated_at (deferred item 23, residual b); input is an
      // object here (the schema parse above refused anything else).
      const version = rowVersion(input.expectedUpdatedAt)
      if (!version.ok) return { success: false, error: version.error, wrote: false }
      const { variant, key } = parsed.data
      const r = await saveVideoCore(
        await videoPorts(ctx.db, version.value),
        { audit: ctx.audit, adminUserId: ctx.adminUserId },
        { key, target: variant === 'mobile' ? 'hero-mobile' : 'hero-desktop' }
      )
      if (r.mediaCleanupFailed) console.error('[finalizeHeroVideoUpload] media cleanup failed')
      return withUpdatedAt(r, version.value)
    },
    {
      fallbackError: 'Upload failed',
      revalidate: (r) => {
        if (!r?.wrote) return
        updateTag('site-config')
        revalidatePath('/')
        revalidatePath('/portfolio')
      },
    }
  )
}

export async function finalizePreloaderVideoUpload(
  input: z.input<typeof finalizeVideoKeySchema> & { expectedUpdatedAt: string }
): Promise<VersionedResult<string> & { mediaCleanupFailed?: boolean }> {
  return runAdminAction(
    adminEnv,
    async (ctx) => {
      const parsed = finalizeVideoKeySchema.safeParse(input)
      if (!parsed.success) {
        return { success: false, error: formatZodError(parsed.error), wrote: false }
      }
      // The settings page's app_config updated_at (deferred item 23, residual b); input is an
      // object here (the schema parse above refused anything else).
      const version = rowVersion(input.expectedUpdatedAt)
      if (!version.ok) return { success: false, error: version.error, wrote: false }
      const r = await saveVideoCore(
        await videoPorts(ctx.db, version.value),
        { audit: ctx.audit, adminUserId: ctx.adminUserId },
        { key: parsed.data.key, target: 'preloader' }
      )
      if (r.mediaCleanupFailed) console.error('[finalizePreloaderVideoUpload] media cleanup failed')
      return withUpdatedAt(r, version.value)
    },
    {
      fallbackError: 'Upload failed',
      revalidate: (r) => {
        if (!r?.wrote) return
        updateTag('site-config')
        revalidatePath('/', 'layout')
      },
    }
  )
}

const finalizeShowVideoSchema = finalizeHeroVideoSchema.extend({
  showId: z.string().regex(UUID_RE, 'Invalid show id.'),
  /**
   * Default true: the show's hero video columns are written. A form that holds the new url
   * in its own state until Save (as the show drawer does today) passes false.
   */
  commit: z.boolean().default(true),
})

export async function finalizeShowVideoUpload(
  input: z.input<typeof finalizeShowVideoSchema>
): Promise<ActionResult<string> & { mediaCleanupFailed?: boolean }> {
  return runAdminAction(
    adminEnv,
    async (ctx) => {
      const parsed = finalizeShowVideoSchema.safeParse(input)
      if (!parsed.success) {
        return { success: false, error: formatZodError(parsed.error), wrote: false }
      }
      const { showId, variant, key, commit } = parsed.data
      const r = await saveVideoCore(
        await videoPorts(ctx.db),
        { audit: ctx.audit, adminUserId: ctx.adminUserId },
        { key, target: 'show', showId, variant, commit }
      )
      if (r.mediaCleanupFailed) console.error('[finalizeShowVideoUpload] media cleanup failed')
      return r
    },
    {
      fallbackError: 'Upload failed',
      revalidate: (r) => {
        if (!r?.wrote) return
        bumpCatalogCache()
      },
    }
  )
}

export async function deleteCastMember(id: string): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const idParsed = parseId(id, 'cast member')
    if (!idParsed.ok) return { success: false, error: idParsed.error }
    id = idParsed.value
    const admin = createAdminClient()

    // The row is deleted only while its image is still the one read (compare-and-swap); the
    // portrait goes only if no other member, show or setting still uses it. R2 only; a
    // Supabase original is never deleted (MEDIA-07).
    const result = await removeMediaCore(
      {
        db: admin,
        media: (await getWorkerEnv()).MEDIA as unknown as DeletableBucket,
        mediaOrigin: getPublicMediaOrigin(),
      },
      { kind: 'delete-row', table: 'show_cast', id, column: 'image_url', notFound: 'Cast member not found' },
      '[deleteCastMember]'
    )
    if (!result.success) return { success: false, error: result.error }

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

/** Admin editor row: published and draft Arabic plus the review flag (item 12, PR #29). */
export type LegalPage = LegalPageRow

export async function getLegalPages(): Promise<LegalPage[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('legal_pages')
    .select('id, slug, title, content, title_ar, content_ar, title_ar_draft, content_ar_draft, ar_reviewed, sort_order, updated_at')
    .order('sort_order', { ascending: true })
  return (data ?? []) as LegalPage[]
}

/**
 * Legal pages Arabic = "AI draft, admin approves" (Koss 2026-10-21): a blank Arabic field is
 * drafted by the AI into the draft columns; only a save with "Arabic reviewed" ticked
 * publishes it (upsertLegalPageCore). An update takes the editor's updated_at (item 8).
 */
export async function upsertLegalPage(
  raw: unknown,
  expectedUpdatedAt?: string
): Promise<VersionedResult<LegalPage>> {
  try {
    const user = await assertAdmin()
    const supabase = await createClient()
    const arabic = createArabicFiller(user.id)
    const result = await upsertLegalPageCore(
      supabase as unknown as AdminDb,
      { fill: arabic.fill },
      raw,
      expectedUpdatedAt
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'Failed to save legal page' }
    }
    bumpLegalCache(result.data.slug)
    return withArabicMissing(
      { success: true, data: result.data, updatedAt: result.updatedAt },
      arabic.missing()
    )
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
  return runAdminAction(
    adminEnv,
    (ctx) => deleteRowAuditedCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId }, ROW_DELETE.legalPage, id),
    { fallbackError: 'Failed to delete legal page', revalidate: () => bumpLegalCache() }
  )
}

// ---------------------------------------------------------------------------
// FAQ Actions
// ---------------------------------------------------------------------------

export type Faq = {
  id: string
  question: string
  answer: string
  question_ar: string | null
  answer_ar: string | null
  sort_order: number
  updated_at: string
}

const faqSchema = z.object({
  id: z.string().uuid().optional(),
  question: z.string().min(1, 'Question is required').max(500),
  answer: z.string().min(1, 'Answer is required'),
  question_ar: z.string().max(500).optional().nullable(),
  answer_ar: z.string().optional().nullable(),
  sort_order: z.number().int().min(0).default(0),
})
const faqArMax = arabicMaxLengths(faqSchema)

export async function getFaqs(): Promise<Faq[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('faqs')
    .select('id, question, answer, question_ar, answer_ar, sort_order, updated_at')
    .order('sort_order', { ascending: true })
  return (data ?? []) as Faq[]
}

/** An update takes the editor's updated_at (review item 8, PR #29); a create does not. */
export async function upsertFaq(
  raw: unknown,
  expectedUpdatedAt?: string
): Promise<VersionedResult<Faq>> {
  try {
    const user = await assertAdmin()
    const parsed = faqSchema.safeParse(raw)
    if (!parsed.success)
      return { success: false, error: parsed.error.issues[0].message }

    const supabase = await createClient()
    const { id, ...fields } = parsed.data
    const version = id ? rowVersion(expectedUpdatedAt) : null
    if (version && !version.ok) return { success: false, error: version.error }
    if (version?.ok) {
      // A stale editor: refuse before any AI call (the UPDATE below is the atomic check).
      const { data: cur, error: curError } = await supabase
        .from('faqs')
        .select('updated_at')
        .eq('id', id as string)
        .maybeSingle()
      if (curError) return { success: false, error: curError.message }
      if (!cur) return { success: false, error: 'FAQ not found.' }
      if (cur.updated_at !== version.value.expected) return { success: false, error: SAVE_CONFLICT }
    }

    // Auto-fill blank Arabic fields from their English source (Workers AI).
    const arabic = createArabicFiller(user.id)
    fields.question_ar = await arabic.fill(fields.question, fields.question_ar, faqArMax.question_ar)
    fields.answer_ar = await arabic.fill(fields.answer, fields.answer_ar)

    if (id && version?.ok) {
      const { error, row } = await updateIfUnchanged(
        supabase as unknown as AdminDb,
        'faqs',
        id,
        fields,
        version.value,
        '*'
      )
      if (error || !row) return { success: false, error: error ?? 'FAQ not found.' }
      bumpFaqCache()
      return withArabicMissing(
        withUpdatedAt({ success: true, data: row as unknown as Faq }, version.value),
        arabic.missing()
      )
    } else {
      const { data, error } = await supabase
        .from('faqs')
        .insert(fields)
        .select()
        .single()
      if (error) return { success: false, error: error.message }
      bumpFaqCache()
      return withArabicMissing({ success: true, data: data as Faq }, arabic.missing())
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
  return runAdminAction(
    adminEnv,
    (ctx) => deleteRowAuditedCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId }, ROW_DELETE.faq, id),
    { fallbackError: 'Failed to delete FAQ', revalidate: () => bumpFaqCache() }
  )
}
