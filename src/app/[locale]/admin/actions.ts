'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { z } from 'zod'
import sharp from 'sharp'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateYouTubeUrl } from '@/lib/youtube'
import { logAudit, logAuditStrict } from '@/lib/audit'
import { runAdminAction, type AdminActionEnv } from '@/lib/admin/action-runner'
import { archiveShowCore, restoreShowCore } from '@/lib/admin/show-archive'
import type { RestoreResult } from '@/lib/admin/ports'
import {
  createShowCore,
  deleteShowCore,
  reorderShowCore,
  updateShowCore,
} from '@/lib/admin/show-writes'
import {
  categoryOrderSchema,
  commitImportSchema,
  episodeSchema,
  formatZodError,
  parseHeroVariant,
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
import {
  PRELOADER_VIDEO_LIMIT,
  SHOW_VIDEO_LIMIT,
  savePreloaderVideoCore,
  saveShowVideoCore,
} from '@/lib/admin/video-uploads'
import { ROW_DELETE, deleteRowAuditedCore } from '@/lib/admin/row-deletes'
import {
  archiveEpisodeCore,
  restoreEpisodeCore,
  deleteEpisodePermanentlyCore,
  reorderEpisodeCore,
  renumberSeasonCore,
} from '@/lib/admin/episode-lifecycle'
import {
  commitImportCore,
  previewPlaylistPageCore,
  type ImportData,
  type PreviewPage,
  type YouTubeCoreResult,
} from '@/lib/admin/youtube-import'
import {
  verifyMessage,
  verifyVideoCore,
  type DuplicateParams,
  type VerifyOptions,
  type VerifyOutcome,
  type YouTubeMeta,
} from '@/lib/admin/youtube-verify'
import type { AdminDb } from '@/lib/admin/ports'
import type { YouTubeErrorCode } from '@/lib/youtube-errors'
import { getServerYouTubeClient } from '@/server/youtube-service'
import {
  planShowScheduleCore,
  applyShowScheduleCore,
  unscheduleShowCore,
  type PlannedEpisodeSlot,
} from '@/lib/admin/show-schedule'
import { generateSlug } from '@/lib/slug'
import { fillArabic, translateBatchToArabicStrict } from '@/lib/translate'
import { fillTickerArabic, type TickerItem } from '@/lib/admin/ticker'
import {
  SITE_IMAGE_MIME_EXT,
  SOCIAL_ICON_MIME_EXT,
  checkHeroVideoSize,
  checkImageUpload,
} from '@/lib/admin/media-guards'
import {
  createHeroVideoPath,
  removeHeroVideoCore,
  saveHeroVideoCore,
  setHeroVideoUrlCore,
  type HeroVideoPorts,
} from '@/lib/admin/hero-video'
import { mp4BytesHasAudioTrack } from '@/lib/mp4-audio'
import {
  assertPublicMediaWriteReady,
  mirrorPublicMediaObject,
  prepareMirroredPublicMediaDeletion,
  R2MediaRollbackError,
} from '@/lib/r2-media'
import type { MirroredPublicMediaDeletion } from '@/lib/r2-media'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionResult<T = unknown> = {
  success: boolean
  error?: string
  data?: T
}

async function stageMirroredPublicMediaDeletion(
  admin: ReturnType<typeof createAdminClient>,
  bucket: 'show-artwork' | 'site-assets' | 'avatars',
  paths: string[]
): Promise<MirroredPublicMediaDeletion> {
  const r2Deletion = await prepareMirroredPublicMediaDeletion(bucket, paths)
  return {
    commit: async () => {
      const { error } = await admin.storage.from(bucket).remove(paths)
      if (error) {
        await r2Deletion.rollback()
        return false
      }
      return r2Deletion.commit()
    },
    rollback: r2Deletion.rollback,
  }
}

async function removeMirroredPublicMedia(
  admin: ReturnType<typeof createAdminClient>,
  bucket: 'show-artwork' | 'site-assets' | 'avatars',
  paths: string[]
) {
  const deletion = await stageMirroredPublicMediaDeletion(admin, bucket, paths)
  return deletion.commit()
}

async function cleanupMirroredPublicMedia(
  admin: ReturnType<typeof createAdminClient>,
  bucket: 'show-artwork' | 'site-assets' | 'avatars',
  paths: string[],
  label: string
) {
  try {
    if (!(await removeMirroredPublicMedia(admin, bucket, paths))) {
      console.error(`${label} media cleanup failed`)
    }
  } catch (error) {
    console.error(`${label} media cleanup failed`, error)
  }
}

async function mirrorUploadedPublicMedia(
  admin: ReturnType<typeof createAdminClient>,
  input: Parameters<typeof mirrorPublicMediaObject>[0]
) {
  try {
    await mirrorPublicMediaObject(input)
  } catch (error) {
    if (error instanceof R2MediaRollbackError) throw error
    const { error: removeError } = await admin.storage
      .from(input.bucket)
      .remove([input.key])
    if (removeError) {
      console.error('[mirrorUploadedPublicMedia] source cleanup failed', removeError)
    }
    throw error
  }
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

// TODO(phase-5): swap this for requireAdmin() (admins table + TOTP); every YouTube action uses only this function
const requireAdminForYouTube = (): Promise<{ id: string }> => assertAdmin()

const youtubeAdminEnv: AdminActionEnv = { ...adminEnv, assertAdmin: requireAdminForYouTube }

/** A YouTube refusal the UI translates with YOUTUBE_ERROR_MESSAGE_KEYS. */
type YouTubeRefusal = { code: YouTubeErrorCode; params?: DuplicateParams }

/** Phase 6 action result: data on success, data.code (and params) on a refusal. */
export type YouTubeActionResult<T> =
  | { success: true; data: T; error?: undefined; wrote?: boolean }
  | { success: false; error: string; data?: YouTubeRefusal; wrote?: boolean }

/** Moves a core's top-level YouTube code into data.code for the UI. */
function toYouTubeResult<T>(r: YouTubeCoreResult<T>, fallbackError: string): YouTubeActionResult<T> {
  if (r.success) return { success: true, data: r.data as T, wrote: r.wrote }
  return {
    success: false,
    error: r.error ?? fallbackError,
    wrote: r.wrote,
    ...(r.code ? { data: { code: r.code } } : {}),
  }
}

/**
 * The server video check handed to the episode cores (YT-03). The Vault key is
 * read only when a link actually needs checking; a missing key is passed as a
 * null client, so the core answers key_missing (fail closed).
 */
function serverVideoVerifier(db: AdminDb, excludeEpisodeId?: string) {
  return async (raw: string, opts: VerifyOptions): Promise<VerifyOutcome> => {
    const yt = await getServerYouTubeClient()
    return verifyVideoCore(db, 'missing' in yt ? null : yt.client, raw, {
      ...opts,
      excludeEpisodeId: opts.excludeEpisodeId ?? excludeEpisodeId,
    })
  }
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

      // Auto-fill blank Arabic fields from their English source (DeepL).
      // fillArabic is strict: a failed translation stores null, not English.
      rest.title_ar = await fillArabic(rest.title, rest.title_ar)
      rest.description_ar = await fillArabic(rest.description, rest.description_ar)
      rest.tagline_ar = await fillArabic(rest.tagline, rest.tagline_ar)

      return createShowCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId },
        { insertData: { ...(id ? { id } : {}), ...rest }, categoryIds: category_ids }
      )
    },
    {
      fallbackError: 'Failed to create show',
      revalidate: () => bumpCatalogCache(),
    }
  )
}

export async function updateShow(
  id: string,
  data: z.input<typeof showSchema>
): Promise<ActionResult> {
  return runAdminAction(
    adminEnv,
    async (ctx) => {
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

      // Auto-fill blank Arabic fields from their English source (DeepL).
      updateData.title_ar = await fillArabic(updateData.title, updateData.title_ar)
      updateData.description_ar = await fillArabic(
        updateData.description,
        updateData.description_ar
      )
      updateData.tagline_ar = await fillArabic(
        updateData.tagline,
        updateData.tagline_ar
      )

      return updateShowCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId },
        { id, updateData, categoryIds: category_ids }
      )
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
    (ctx) =>
      restoreShowCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId, fillArabic },
        { showId: id }
      ),
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
    (ctx) =>
      restoreShowCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId, fillArabic },
        { showId, fixes }
      ),
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
    (ctx) =>
      restoreShowCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId, fillArabic },
        {
          showId,
          rename: Object.keys(rename).length > 0 ? rename : undefined,
          fixes: data?.episodeFixes,
        }
      ),
    {
      fallbackError: 'Failed to resolve conflicts',
      revalidate: revalidateRestore,
    }
  )
}

// List and delete every file under shows/{id}/ in both buckets. Listing (not
// hard-coded names) works for legacy stable-path rows and versioned rows
// (hero-{timestamp}.webp): whatever is in the folder gets staged for deletion.
async function stageShowMedia(
  admin: ReturnType<typeof createAdminClient>,
  showId: string
): Promise<MirroredPublicMediaDeletion[]> {
  const staged: MirroredPublicMediaDeletion[] = []

  async function listShowFolderFiles(bucket: string, prefix: string) {
    const paths: string[] = []
    let offset = 0

    for (;;) {
      const { data, error: listError } = await admin.storage
        .from(bucket)
        .list(prefix, { limit: 1000, offset })
      if (listError) throw new Error('Could not list show media')

      const entries = data ?? []
      for (const entry of entries) {
        if (!entry.name) continue
        const path = prefix + '/' + entry.name
        if (entry.id) {
          paths.push(path)
        } else {
          paths.push(...(await listShowFolderFiles(bucket, path)))
        }
      }

      if (entries.length < 1000) return paths
      offset += entries.length
    }
  }

  async function purgeShowFolder(bucket: 'show-artwork' | 'site-assets') {
    const paths = await listShowFolderFiles(bucket, ['shows', showId].join('/'))
    if (paths.length === 0) return
    staged.push(await stageMirroredPublicMediaDeletion(admin, bucket, paths))
  }

  try {
    await purgeShowFolder('show-artwork') // poster, hero, hero-mobile, logo
    await purgeShowFolder('site-assets') // hero videos
  } catch (mediaError) {
    await Promise.all(staged.map((deletion) => deletion.rollback()))
    throw mediaError
  }
  return staged
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
              (await stageShowMedia(ctx.db, showId)).map((deletion) => ({
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

export async function updateCategory(
  id: string,
  data: z.input<typeof categorySchema>
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const idParsed = parseId(id, 'category')
    if (!idParsed.ok) return { success: false, error: idParsed.error }
    id = idParsed.value
    // sort_order stays optional so an omitted value is not written as 0.
    const parsed = categorySchema
      .extend({ sort_order: z.number().int().min(0).optional() })
      .parse(data)
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
    (ctx) =>
      createSeasonCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId, fillArabic },
        data
      ),
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
  data: Partial<z.input<typeof seasonSchema>>
): Promise<ActionResult> {
  return runAdminAction(
    adminEnv,
    (ctx) =>
      updateSeasonCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId, fillArabic },
        id,
        data
      ),
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
    (ctx) =>
      createEpisodeCore(
        ctx.db,
        {
          audit: ctx.audit,
          adminUserId: ctx.adminUserId,
          fillArabic,
          verifyVideo: serverVideoVerifier(ctx.db),
        },
        data
      ),
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
  data: Partial<z.input<typeof episodeSchema>>
): Promise<ActionResult> {
  return runAdminAction(
    adminEnv,
    (ctx) =>
      updateEpisodeCore(
        ctx.db,
        {
          audit: ctx.audit,
          adminUserId: ctx.adminUserId,
          fillArabic,
          verifyVideo: serverVideoVerifier(ctx.db, id),
        },
        id,
        data
      ),
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

/**
 * Renumber a season's episodes 1 to N in their current order (one SQL call,
 * all or nothing). Archived episodes keep their place in the order.
 */
export async function renumberSeason(
  showId: string,
  seasonId: string
): Promise<ActionResult<{ showId?: string; map?: unknown }>> {
  return runAdminAction(
    youtubeAdminEnv,
    (ctx) =>
      renumberSeasonCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId },
        showId,
        seasonId
      ),
    {
      fallbackError: 'Failed to renumber episodes',
      revalidate: (r) => {
        if (!revalidateShowPage(r, showId)) bumpCatalogCache()
        updateTag('episodes')
      },
    }
  )
}

// ---------------------------------------------------------------------------
// YouTube import and single-link fetch (Phase 6)
// ---------------------------------------------------------------------------

export type { PreviewPage, PreviewRow, ImportData } from '@/lib/admin/youtube-import'
export type { YouTubeMeta } from '@/lib/admin/youtube-verify'

/**
 * Read one preview page of a playlist (at most 4 pages of 50). Writes nothing.
 * The client sends the link or the playlist id and page token; the core
 * re-parses everything.
 */
export async function previewPlaylistPage(input: {
  showId: string
  url?: string
  playlistId?: string
  pageToken?: string
  page: number
}): Promise<YouTubeActionResult<PreviewPage>> {
  try {
    await requireAdminForYouTube()
    const yt = await getServerYouTubeClient()
    if ('missing' in yt) {
      return { success: false, error: 'The YouTube key is not set.', data: { code: 'key_missing' } }
    }
    const result = await previewPlaylistPageCore(createAdminClient(), yt.client, input)
    return toYouTubeResult(result, 'Failed to read the playlist')
  } catch (err) {
    // The error only: never the input link (D-20, T-06-51).
    console.error('[admin/actions] playlist preview failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to read the playlist',
    }
  }
}

/**
 * Import the ticked videos as draft episodes. The server re-fetches every id
 * from YouTube and refuses the whole import if anything changed since the preview.
 */
export async function commitImport(input: {
  showId: string
  playlistId: string
  videoIds: string[]
  target: z.input<typeof commitImportSchema>['target']
}): Promise<YouTubeActionResult<ImportData>> {
  return runAdminAction(
    youtubeAdminEnv,
    async (ctx): Promise<YouTubeActionResult<ImportData>> => {
      const yt = await getServerYouTubeClient()
      if ('missing' in yt) {
        return {
          success: false,
          wrote: false,
          error: 'The YouTube key is not set.',
          data: { code: 'key_missing' },
        }
      }
      const result = await commitImportCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId, youtube: yt.client, now: new Date() },
        input
      )
      return toYouTubeResult(result, 'Import failed')
    },
    {
      fallbackError: 'Import failed',
      revalidate: (r) => {
        revalidateShowPage(r?.success ? r : undefined, input?.showId)
        updateTag('episodes')
        updateTag('shows')
      },
    }
  )
}

/**
 * Check one video link and return its YouTube metadata (title, description,
 * channel, thumbnail, length). Writes nothing. Replaces GET /api/youtube-meta.
 * Shorts pass forShort: true (no duplicate check against episodes).
 */
export async function fetchYouTubeMeta(
  url: string,
  opts?: { forShort?: boolean }
): Promise<YouTubeActionResult<YouTubeMeta>> {
  try {
    await requireAdminForYouTube()
    const yt = await getServerYouTubeClient()
    const outcome = await verifyVideoCore(
      createAdminClient(),
      'missing' in yt ? null : yt.client,
      url,
      { checkDuplicate: !opts?.forShort }
    )
    if (outcome.ok) return { success: true, data: outcome.meta }
    return {
      success: false,
      error: verifyMessage(outcome),
      data: outcome.params
        ? { code: outcome.code, params: outcome.params }
        : { code: outcome.code },
    }
  } catch (err) {
    console.error('[admin/actions] youtube meta fetch failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to check the video',
    }
  }
}

// ---------------------------------------------------------------------------
// Bulk episode scheduling
// ---------------------------------------------------------------------------

export type { PlannedEpisodeSlot } from '@/lib/admin/show-schedule'

/** The import selects at most this many episodes (IMPORT_MAX_ITEMS). */
const MAX_SCHEDULE_SELECTION = 200

/**
 * Shape check for an optional episode selection from the client. Each id is
 * parsed by planShowScheduleCore; this only refuses non-arrays and oversize lists.
 */
function parseEpisodeSelection(
  raw: unknown
): { ok: true; value: string[] | undefined } | { ok: false; error: string } {
  if (raw === undefined) return { ok: true, value: undefined }
  if (
    !Array.isArray(raw) ||
    raw.length === 0 ||
    raw.length > MAX_SCHEDULE_SELECTION ||
    !raw.every((v) => typeof v === 'string')
  ) {
    return { ok: false, error: 'Some selected episodes cannot be scheduled.' }
  }
  return { ok: true, value: raw as string[] }
}

/**
 * Preview a bulk schedule without writing anything. Drives the confirmation
 * dialog so the admin sees every generated air date before committing.
 */
export async function previewShowSchedule(
  showId: string,
  episodeIds?: string[]
): Promise<ActionResult<PlannedEpisodeSlot[]>> {
  try {
    await assertAdmin()
    const parsed = parseId(showId, 'show')
    if (!parsed.ok) return { success: false, error: parsed.error }
    const selection = parseEpisodeSelection(episodeIds)
    if (!selection.ok) return { success: false, error: selection.error }
    const result = await planShowScheduleCore(
      createAdminClient(),
      parsed.value,
      new Date(),
      selection.value
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
  showId: string,
  episodeIds?: string[]
): Promise<ActionResult<{ scheduled?: number }>> {
  return runAdminAction(
    adminEnv,
    async (ctx) => {
      const deps = { audit: ctx.audit, adminUserId: ctx.adminUserId, now: new Date() }
      if (episodeIds === undefined) return applyShowScheduleCore(ctx.db, deps, showId)
      // A chosen subset (the import success state, D-07): plan it here and hand
      // the plan over; the core's slot-conflict and changed-row checks still run.
      const parsed = parseId(showId, 'show')
      if (!parsed.ok) return { success: false, error: parsed.error, wrote: false }
      const selection = parseEpisodeSelection(episodeIds)
      if (!selection.ok) return { success: false, error: selection.error, wrote: false }
      const plan = await planShowScheduleCore(ctx.db, parsed.value, deps.now, selection.value)
      if (!plan.ok) return { success: false, error: plan.error, wrote: false }
      return applyShowScheduleCore(ctx.db, { ...deps, planOverride: plan.plan }, parsed.value)
    },
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

export async function uploadArtwork(
  formData: FormData
): Promise<ActionResult<string>> {
  try {
    await assertAdmin()
    assertPublicMediaWriteReady()
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

    if (
      !UUID_RE.test(showId) ||
      showId.includes('/') ||
      showId.includes('..') ||
      slot.includes('/') ||
      slot.includes('..') ||
      !ARTWORK_UPLOAD_SLOTS.includes(
        slot as (typeof ARTWORK_UPLOAD_SLOTS)[number]
      )
    ) {
      return { success: false, error: 'Invalid showId or slot' }
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
        cacheControl: '31536000',
      })

    if (error) return { success: false, error: error.message }

    await mirrorUploadedPublicMedia(admin, {
      bucket: 'show-artwork',
      key: path,
      body: uploadBody,
      contentType: uploadContentType,
      cacheControl: '31536000',
    })

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

function heroPorts(admin: ReturnType<typeof createAdminClient>): HeroVideoPorts {
  const bucket = admin.storage.from('site-assets')
  return {
    db: admin,
    storage: {
      info: (path) => bucket.info(path),
      download: (path) => bucket.download(path),
      remove: (paths) => bucket.remove(paths),
      publicUrl: (path) => bucket.getPublicUrl(path).data.publicUrl,
    },
    media: {
      mirrorUpload: (path, blob) =>
        mirrorUploadedPublicMedia(admin, {
          bucket: 'site-assets',
          key: path,
          body: blob,
          contentType: 'video/mp4',
          cacheControl: '31536000',
        }),
      cleanup: (paths) => cleanupMirroredPublicMedia(admin, 'site-assets', paths, '[hero]'),
      stageDeletion: (paths) => stageMirroredPublicMediaDeletion(admin, 'site-assets', paths),
    },
    hasAudioTrack: mp4BytesHasAudioTrack,
    storagePathFromUrl: (url) => getPublicStoragePath(url, 'site-assets'),
    now: Date.now,
  }
}

export async function createHeroVideoUpload(
  file: {
    name: string
    size: number
    type: string
  },
  variant: HeroVariant = 'desktop'
): Promise<ActionResult<SignedVideoUploadTarget>> {
  try {
    await assertAdmin()
    assertPublicMediaWriteReady()
    const admin = createAdminClient()

    const v = parseHeroVariant(variant)
    if (!v.ok) return { success: false, error: v.error }

    if (!isMp4File(file)) {
      return { success: false, error: 'File must be an MP4 video' }
    }

    // Client-reported size only; the server proof is saveHeroVideoCore (storage info()).
    const sizeCheck = checkHeroVideoSize(file.size)
    if (!sizeCheck.ok) return { success: false, error: sizeCheck.error }

    const path = createHeroVideoPath(v.value)
    const { data, error } = await admin.storage
      .from('site-assets')
      .createSignedUploadUrl(path)

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
  path: string,
  variant: HeroVariant = 'desktop'
): Promise<ActionResult<string>> {
  const res = await runAdminAction(
    adminEnv,
    async (ctx) => {
      const r = await saveHeroVideoCore(
        heroPorts(ctx.db),
        { audit: ctx.audit, adminUserId: ctx.adminUserId },
        { path, variant }
      )
      if (r.mediaCleanupFailed) console.error('[saveHeroVideoUpload] media cleanup failed')
      return r
    },
    {
      fallbackError: 'Upload failed',
      revalidate: () => {
        updateTag('site-config')
        revalidatePath('/')
        revalidatePath('/portfolio')
      },
    }
  )
  return res
}

export async function setHeroVideoUrl(
  youtubeUrl: string,
  variant: HeroVariant = 'desktop'
): Promise<ActionResult> {
  // The runner checks admin first; validation runs inside it so a non-admin
  // learns nothing about what a valid URL looks like.
  return runAdminAction(
    adminEnv,
    async (ctx) => {
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
        heroPorts(ctx.db),
        { audit: ctx.audit, adminUserId: ctx.adminUserId },
        { canonicalUrl, variant }
      )
      if (r.mediaCleanupFailed) console.error('[setHeroVideoUrl] media cleanup failed')
      return r
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
  variant: HeroVariant = 'desktop'
): Promise<ActionResult> {
  return runAdminAction(
    adminEnv,
    async (ctx) => {
      const r = await removeHeroVideoCore(
        heroPorts(ctx.db),
        { audit: ctx.audit, adminUserId: ctx.adminUserId },
        { variant }
      )
      if (r.mediaCleanupFailed) console.error('[removeHeroVideo] media cleanup failed')
      return r
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

export async function setHeroVideoMuted(muted: boolean): Promise<ActionResult> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    // hero_video_muted not yet in generated database.types — `as never` is the
    // codebase convention for columns added by a migration before gen-types runs.
    const { error } = await admin
      .from('app_config')
      .update({ hero_video_muted: muted } as never)
      .eq('id', 1)

    if (error) return { success: false, error: error.message }

    updateTag('site-config')
    revalidatePath('/')

    return { success: true }
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

function createPreloaderVideoPath() {
  return `preloader/video-${Date.now()}.mp4`
}

export async function createPreloaderVideoUpload(file: {
  name: string
  size: number
  type: string
}): Promise<ActionResult<SignedVideoUploadTarget>> {
  try {
    await assertAdmin()
    assertPublicMediaWriteReady()
    const admin = createAdminClient()

    if (!isMp4File(file)) {
      return { success: false, error: 'File must be an MP4 video' }
    }

    // Client-reported size only; the server proof is savePreloaderVideoCore (storage info()).
    if (file.size > PRELOADER_VIDEO_LIMIT.maxBytes) {
      return { success: false, error: PRELOADER_VIDEO_LIMIT.tooLarge }
    }

    const path = createPreloaderVideoPath()
    const { data, error } = await admin.storage
      .from('site-assets')
      .createSignedUploadUrl(path)

    if (error) return { success: false, error: error.message }

    return { success: true, data: { path: data.path, token: data.token } }
  } catch (err) {
    console.error('[createPreloaderVideoUpload] failed', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upload failed',
    }
  }
}

export async function savePreloaderVideoUpload(
  path: string
): Promise<ActionResult<string>> {
  return runAdminAction(
    adminEnv,
    (ctx) =>
      savePreloaderVideoCore(heroPorts(ctx.db), { audit: ctx.audit, adminUserId: ctx.adminUserId }, { path }),
    {
      fallbackError: 'Upload failed',
      revalidate: () => {
        updateTag('site-config')
        revalidatePath('/', 'layout')
      },
    }
  )
}

export async function removePreloaderVideo(): Promise<ActionResult> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    const { data: previousConfig, error: previousConfigError } = await admin
      .from('app_config')
      .select()
      .eq('id', 1)
      .single()
    if (previousConfigError || !previousConfig) {
      return {
        success: false,
        error: previousConfigError?.message ?? 'Could not load site config',
      }
    }

    const previousPreloaderUrl = (
      previousConfig as unknown as { preloader_video_url: string | null }
    ).preloader_video_url
    const previousPath = getPublicStoragePath(previousPreloaderUrl, 'site-assets')
    const mediaDeletion = previousPath
      ? await stageMirroredPublicMediaDeletion(admin, 'site-assets', [
          previousPath,
        ])
      : null
    const { error: configError } = await admin
      .from('app_config')
      .update({ preloader_video_url: null } as never)
      .eq('id', 1)

    if (configError) {
      const restored = await mediaDeletion?.rollback()
      return {
        success: false,
        error: restored !== false
          ? configError.message
          : 'Could not remove the preloader video and restore R2 media',
      }
    }

    if (mediaDeletion && !(await mediaDeletion.commit())) {
      console.error('[removePreloaderVideo] media cleanup failed')
    }

    updateTag('site-config')
    revalidatePath('/', 'layout')

    return { success: true }
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
    assertPublicMediaWriteReady()
    const admin = createAdminClient()
    const { name, size, type, showId, variant } = file

    const showIdParsed = parseId(showId, 'show')
    if (!showIdParsed.ok) return { success: false, error: showIdParsed.error }

    if (variant !== 'desktop' && variant !== 'mobile') {
      return { success: false, error: 'Invalid variant' }
    }

    if (!isMp4File({ name, type })) {
      return { success: false, error: 'File must be an MP4 video' }
    }

    // Client-reported size only; the server proof is saveShowVideoCore (storage info()).
    if (size > SHOW_VIDEO_LIMIT.maxBytes) {
      return { success: false, error: SHOW_VIDEO_LIMIT.tooLarge }
    }

    const path = `shows/${showIdParsed.value}/hero-${variant}-${Date.now()}.mp4`
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
  return runAdminAction(
    adminEnv,
    (ctx) =>
      saveShowVideoCore(heroPorts(ctx.db), { audit: ctx.audit, adminUserId: ctx.adminUserId }, { path }),
    // The URL is written when the show form is saved; nothing cached changes here.
    { fallbackError: 'Upload failed', revalidate: () => {} }
  )
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
  site_description_ar: z.string().trim().max(300).nullable(),
  site_tagline: z.string().trim().min(1, 'Tagline is required').max(120),
  site_tagline_ar: z.string().trim().max(120).nullable(),
})

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

export async function updateLiveStreamUrl(
  input: z.input<typeof liveStreamUrlSchema>
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const parsed = liveStreamUrlSchema.parse(input)
    const admin = createAdminClient()
    const { error } = await admin
      .from('app_config')
      .update({
        live_stream_url: parsed.live_stream_url,
        live_stream_label: parsed.live_stream_label,
        live_stream_label_ar: parsed.live_stream_label_ar,
      })
      .eq('id', 1)
    if (error) return { success: false, error: error.message }
    await auditConfigUpdate(user.id, [
      'live_stream_url',
      'live_stream_label',
      'live_stream_label_ar',
    ])
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

    // Auto-fill blank Arabic fields from their English source (DeepL).
    parsed.site_description_ar = await fillArabic(
      parsed.site_description,
      parsed.site_description_ar
    )
    parsed.site_tagline_ar = await fillArabic(parsed.site_tagline, parsed.site_tagline_ar)

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

export async function updateAuthPageConfig(
  input: z.input<typeof authPageSchema>
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const parsed = authPageSchema.parse(input)

    // Auto-fill blank Arabic copy from the English source (DeepL).
    parsed.auth_heading_ar = await fillArabic(
      parsed.auth_heading,
      parsed.auth_heading_ar
    )
    parsed.auth_subheading_ar = await fillArabic(
      parsed.auth_subheading,
      parsed.auth_subheading_ar
    )
    parsed.auth_quote_ar = await fillArabic(parsed.auth_quote, parsed.auth_quote_ar)
    parsed.auth_quote_attribution_ar = await fillArabic(
      parsed.auth_quote_attribution,
      parsed.auth_quote_attribution_ar
    )

    const admin = createAdminClient()
    const { error } = await admin
      .from('app_config')
      .update(parsed as never)
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

    // Auto-fill blank Arabic tagline from English (DeepL).
    parsed.taglineAr = (await fillArabic(parsed.tagline, parsed.taglineAr)) ?? ''

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

const portfolioContentSchema = z.object({
  hero_description: z.string().trim().max(500).nullable(),
  hero_description_ar: z.string().trim().max(500).nullable(),
  portfolio_heading: z.string().trim().max(200).nullable(),
  portfolio_heading_ar: z.string().trim().max(200).nullable(),
})

export async function updatePortfolioContent(
  input: z.input<typeof portfolioContentSchema>
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const parsed = portfolioContentSchema.parse(input)

    // Auto-fill blank Arabic fields from their English source (DeepL).
    parsed.hero_description_ar = await fillArabic(
      parsed.hero_description,
      parsed.hero_description_ar
    )
    parsed.portfolio_heading_ar = await fillArabic(
      parsed.portfolio_heading,
      parsed.portfolio_heading_ar
    )

    const admin = createAdminClient()

    const updatePayload = {
      hero_description: parsed.hero_description,
      hero_description_ar: parsed.hero_description_ar,
      portfolio_heading: parsed.portfolio_heading,
      portfolio_heading_ar: parsed.portfolio_heading_ar,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
    const { error } = await admin
      .from('app_config')
      .update(updatePayload)
      .eq('id', 1)

    if (error) return { success: false, error: error.message }
    await auditConfigUpdate(user.id, [
      'hero_description',
      'hero_description_ar',
      'portfolio_heading',
      'portfolio_heading_ar',
    ])
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
    const cleaned: Record<string, string | null> = {
      google_analytics_id: parsed.google_analytics_id?.trim() || null,
      meta_pixel_id: parsed.meta_pixel_id?.trim() || null,
    }
    if (parsed.youtube_api_key !== undefined) {
      cleaned.youtube_api_key = parsed.youtube_api_key?.trim() || null
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
): Promise<ActionResult<{ untranslated: number }>> {
  try {
    const user = await assertAdmin()
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

    // Auto-fill blank Arabic fields in one strict batch: never English in an Arabic slot.
    const { items, untranslated } = await fillTickerArabic(trimmed, translateBatchToArabicStrict)

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
    await auditConfigUpdate(user.id, ['top_ticker'], { untranslated })
    bumpSiteConfigCache()
    return { success: true, data: { untranslated } }
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

// Upload OG image or favicon to site-assets bucket.
// Returns the public URL and writes it to the matching app_config column.
export async function uploadSiteImage(
  formData: FormData
): Promise<ActionResult<string>> {
  try {
    await assertAdmin()
    assertPublicMediaWriteReady()
    const admin = createAdminClient()

    const file = formData.get('file') as File | null
    const kind = formData.get('kind')
    if (!file) return { success: false, error: 'No file provided' }
    if (!isSiteImageKind(kind)) {
      return { success: false, error: 'Invalid kind' }
    }
    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: 'Image must be under 5MB' }
    }

    // SVG is refused (declared type and sniffed bytes); PNG, JPEG, WebP and ICO stay allowed (AVIF is not in the site-assets bucket allow-list).
    const bytes = new Uint8Array(await file.arrayBuffer())
    const checked = checkImageUpload({
      declaredMime: file.type,
      bytes,
      allow: SITE_IMAGE_MIME_EXT,
    })
    if (!checked.ok) return { success: false, error: checked.error }
    const mime = checked.mime
    const ext = checked.ext

    const column = SITE_IMAGE_COLUMN[kind]
    const { data: previousConfig, error: previousConfigError } = await admin
      .from('app_config')
      .select(column)
      .eq('id', 1)
      .single()
    if (previousConfigError || !previousConfig) {
      return {
        success: false,
        error: previousConfigError?.message ?? 'Could not load site config',
      }
    }

    const previousUrl = (
      previousConfig as unknown as Record<string, string | null>
    )[column]
    const path = `settings/${kind}-${Date.now()}.${ext}`

    const body = new Blob([bytes], { type: mime })

    const { error: uploadError } = await admin.storage
      .from('site-assets')
      .upload(path, body, {
        upsert: false,
        contentType: mime,
        cacheControl: '31536000',
      })

    if (uploadError) return { success: false, error: uploadError.message }

    await mirrorUploadedPublicMedia(admin, {
      bucket: 'site-assets',
      key: path,
      body,
      contentType: mime,
      cacheControl: '31536000',
    })

    const { data: urlData } = admin.storage
      .from('site-assets')
      .getPublicUrl(path)
    // Cache-bust the URL so browsers always pick up the latest upload
    const bustedUrl = `${urlData.publicUrl}?v=${Date.now()}`

    const { error: dbError } = await admin
      .from('app_config')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ [column]: bustedUrl } as any)
      .eq('id', 1)

    if (dbError) {
      await cleanupMirroredPublicMedia(
        admin,
        'site-assets',
        [path],
        '[uploadSiteImage]'
      )
      return { success: false, error: dbError.message }
    }

    const previousPath = getPublicStoragePath(previousUrl, 'site-assets')
    if (previousPath && previousPath !== path) {
      await cleanupMirroredPublicMedia(
        admin,
        'site-assets',
        [previousPath],
        '[uploadSiteImage]'
      )
    }

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
  kind: SiteImageKind
): Promise<ActionResult> {
  try {
    await assertAdmin()
    if (!isSiteImageKind(kind)) return { success: false, error: 'Invalid kind' }
    const admin = createAdminClient()
    const column = SITE_IMAGE_COLUMN[kind]
    const { data: previousConfig, error: previousConfigError } = await admin
      .from('app_config')
      .select(column)
      .eq('id', 1)
      .single()
    if (previousConfigError || !previousConfig) {
      return {
        success: false,
        error: previousConfigError?.message ?? 'Could not load site config',
      }
    }

    const previousUrl = (
      previousConfig as unknown as Record<string, string | null>
    )[column]
    const { error } = await admin
      .from('app_config')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ [column]: null } as any)
      .eq('id', 1)
    if (error) return { success: false, error: error.message }

    const previousPath = getPublicStoragePath(previousUrl, 'site-assets')
    if (previousPath) {
      await cleanupMirroredPublicMedia(
        admin,
        'site-assets',
        [previousPath],
        '[removeSiteImage]'
      )
    }

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
    assertPublicMediaWriteReady()
    const admin = createAdminClient()

    const file = formData.get('file') as File | null
    if (!file) return { success: false, error: 'No file provided' }
    if (file.size > 2 * 1024 * 1024) {
      return { success: false, error: 'Icon must be under 2MB' }
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const checked = checkImageUpload({
      declaredMime: file.type,
      bytes,
      allow: SOCIAL_ICON_MIME_EXT,
    })
    if (!checked.ok) return { success: false, error: checked.error }

    const path = `settings/social-icons/${Date.now()}.${checked.ext}`
    const body = new Blob([bytes], { type: checked.mime })
    const { error: uploadError } = await admin.storage
      .from('site-assets')
      .upload(path, body, { upsert: false, contentType: checked.mime, cacheControl: '31536000' })

    if (uploadError) return { success: false, error: uploadError.message }

    await mirrorUploadedPublicMedia(admin, {
      bucket: 'site-assets',
      key: path,
      body,
      contentType: checked.mime,
      cacheControl: '31536000',
    })

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

export async function updateShort(
  id: string,
  data: z.input<typeof shortSchema>
): Promise<ActionResult> {
  try {
    const user = await assertAdmin()
    const idParsed = parseId(id, 'short')
    if (!idParsed.ok) return { success: false, error: idParsed.error }
    id = idParsed.value
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

export async function uploadCastImage(
  formData: FormData
): Promise<ActionResult<string>> {
  try {
    await assertAdmin()
    assertPublicMediaWriteReady()
    const admin = createAdminClient()

    const file = formData.get('file') as File | null
    const showId = formData.get('showId') as string | null

    if (!file || file.size === 0) {
      return { success: false, error: 'No file provided' }
    }
    const showIdParsed = parseId(showId, 'show')
    if (!showIdParsed.ok) {
      return { success: false, error: showIdParsed.error }
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

    const path = `shows/${showIdParsed.value}/cast/${Date.now()}.${ext}`

    const { error: uploadError } = await admin.storage
      .from('show-artwork')
      .upload(path, file, {
        upsert: false,
        contentType: file.type,
        cacheControl: '31536000',
      })

    if (uploadError) return { success: false, error: uploadError.message }

    await mirrorUploadedPublicMedia(admin, {
      bucket: 'show-artwork',
      key: path,
      body: file,
      contentType: file.type,
      cacheControl: '31536000',
    })

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
    const idParsed = parseId(id, 'cast member')
    if (!idParsed.ok) return { success: false, error: idParsed.error }
    id = idParsed.value
    const admin = createAdminClient()

    const { data: cast, error: castError } = await admin
      .from('show_cast')
      .select('image_url')
      .eq('id', id)
      .single()
    if (castError || !cast) {
      return {
        success: false,
        error: castError?.message ?? 'Cast member not found',
      }
    }

    const imagePath = getPublicStoragePath(cast.image_url, 'show-artwork')
    const mediaDeletion = imagePath
      ? await stageMirroredPublicMediaDeletion(admin, 'show-artwork', [
          imagePath,
        ])
      : null

    const { error } = await admin.from('show_cast').delete().eq('id', id)

    if (error) {
      const restored = await mediaDeletion?.rollback()
      return {
        success: false,
        error:
          restored === false
            ? 'Could not delete cast and restore R2 media'
            : error.message,
      }
    }

    if (mediaDeletion && !(await mediaDeletion.commit())) {
      console.error('[deleteCastMember] media cleanup failed')
    }

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
  title_ar: string | null
  content_ar: string | null
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
  title_ar: z.string().max(200).optional().nullable(),
  content_ar: z.string().optional().nullable(),
  sort_order: z.number().int().min(0).default(0),
})

export async function getLegalPages(): Promise<LegalPage[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('legal_pages')
    .select('id, slug, title, content, title_ar, content_ar, sort_order, updated_at')
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

    // Auto-fill blank Arabic fields from their English source (DeepL).
    fields.title_ar = await fillArabic(fields.title, fields.title_ar)
    fields.content_ar = await fillArabic(fields.content, fields.content_ar)

    if (id) {
      const { data, error } = await supabase
        .from('legal_pages')
        .update(fields)
        .eq('id', id)
        .select()
        .single()
      if (error) return { success: false, error: error.message }
      bumpLegalCache(parsed.data.slug)
      return { success: true, data: data as LegalPage }
    } else {
      const { data, error } = await supabase
        .from('legal_pages')
        .insert(fields)
        .select()
        .single()
      if (error) return { success: false, error: error.message }
      bumpLegalCache(parsed.data.slug)
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
}

const faqSchema = z.object({
  id: z.string().uuid().optional(),
  question: z.string().min(1, 'Question is required').max(500),
  answer: z.string().min(1, 'Answer is required'),
  question_ar: z.string().max(500).optional().nullable(),
  answer_ar: z.string().optional().nullable(),
  sort_order: z.number().int().min(0).default(0),
})

export async function getFaqs(): Promise<Faq[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('faqs')
    .select('id, question, answer, question_ar, answer_ar, sort_order')
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

    // Auto-fill blank Arabic fields from their English source (DeepL).
    fields.question_ar = await fillArabic(fields.question, fields.question_ar)
    fields.answer_ar = await fillArabic(fields.answer, fields.answer_ar)

    if (id) {
      const { data, error } = await supabase
        .from('faqs')
        .update(fields)
        .eq('id', id)
        .select()
        .single()
      if (error) return { success: false, error: error.message }
      bumpFaqCache()
      return { success: true, data: data as Faq }
    } else {
      const { data, error } = await supabase
        .from('faqs')
        .insert(fields)
        .select()
        .single()
      if (error) return { success: false, error: error.message }
      bumpFaqCache()
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
  return runAdminAction(
    adminEnv,
    (ctx) => deleteRowAuditedCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId }, ROW_DELETE.faq, id),
    { fallbackError: 'Failed to delete FAQ', revalidate: () => bumpFaqCache() }
  )
}
