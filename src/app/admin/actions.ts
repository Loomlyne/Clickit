'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { z } from 'zod'
import sharp from 'sharp'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionResult<T = unknown> = {
  success: boolean
  error?: string
  data?: T
}

export type EpisodeConflict = {
  episodeId: string
  episodeTitle: string
  episodeNumber: number
  seasonId: string
  seasonNumber: number
  conflictingEpisodeTitle: string
}

export type RestoreResult = ActionResult & {
  conflicts?: EpisodeConflict[]
}

// ---------------------------------------------------------------------------
// Auth helper: defense-in-depth (D-12) — every action verifies admin
// ---------------------------------------------------------------------------

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: config } = await supabase
    .from('app_config')
    .select('admin_user_id')
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
function heroVideoInvariant(
  urlKey: 'hero_video_url' | 'hero_video_mobile_url',
  typeKey: 'hero_video_type' | 'hero_video_mobile_type',
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
    brand_color: z.enum(['brand-blue', 'brand-purple', 'brand-green', 'brand-red', 'brand-orange']),
    status: z.enum(['draft', 'coming-soon', 'now-streaming']),
    broadcast_day: z.string().optional().nullable(),
    broadcast_time: z.string().optional().nullable(),
    poster_url: optionalUrl,
    hero_url: optionalUrl,
    logo_url: optionalUrl,
    hero_image_mobile_url: optionalUrl,
    hero_video_url: optionalUrl,
    hero_video_type: z.enum(['mp4', 'youtube']).optional().nullable(),
    hero_video_mobile_url: optionalUrl,
    hero_video_mobile_type: z.enum(['mp4', 'youtube']).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    heroVideoInvariant('hero_video_url', 'hero_video_type')(data, ctx)
    heroVideoInvariant('hero_video_mobile_url', 'hero_video_mobile_type')(data, ctx)
  })

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
  data: z.input<typeof showSchema>,
): Promise<ActionResult> {
  try {
    await assertAdmin()
    const parsed = showSchema.parse(data)
    const admin = createAdminClient()

    const { id, ...rest } = parsed
    const insertData = id ? { id, ...rest } : rest

    const { data: show, error } = await admin
      .from('shows')
      .insert(insertData)
      .select()
      .single()

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin')
    updateTag('shows')
    return { success: true, data: show }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create show' }
  }
}

export async function updateShow(
  id: string,
  data: z.input<typeof showSchema>,
): Promise<ActionResult> {
  try {
    await assertAdmin()
    const parsed = showSchema.parse(data)
    const admin = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _parsedId, ...updateData } = parsed

    const { data: show, error } = await admin
      .from('shows')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin')
    revalidatePath(`/admin/shows/${id}`)
    updateTag('shows')
    return { success: true, data: show }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update show' }
  }
}

export async function archiveShow(id: string): Promise<ActionResult> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    const { error: showError } = await admin
      .from('shows')
      .update({ archived: true })
      .eq('id', id)

    if (showError) return { success: false, error: showError.message }

    // Also archive all episodes for this show
    await admin
      .from('episodes')
      .update({ archived: true })
      .eq('show_id', id)

    revalidatePath('/admin')
    updateTag('shows')
    updateTag('episodes')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to archive show' }
  }
}

export async function restoreShow(id: string): Promise<RestoreResult> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

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

      const seasonMap = new Map(seasons?.map(s => [s.id, s.season_number]) ?? [])

      // Check each archived episode against existing visible episodes
      const conflicts: EpisodeConflict[] = []
      for (const ep of archivedEpisodes) {
        const { data: existing } = await admin
          .from('episodes')
          .select('title')
          .eq('season_id', ep.season_id)
          .eq('episode_number', ep.episode_number)
          .eq('archived', false)
          .maybeSingle()

        if (existing) {
          conflicts.push({
            episodeId: ep.id,
            episodeTitle: ep.title,
            episodeNumber: ep.episode_number,
            seasonId: ep.season_id,
            seasonNumber: seasonMap.get(ep.season_id) ?? 0,
            conflictingEpisodeTitle: existing.title,
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
      .update({ archived: false })
      .eq('id', id)

    if (showError) return { success: false, error: showError.message }

    await admin
      .from('episodes')
      .update({ archived: false })
      .eq('show_id', id)

    revalidatePath('/admin')
    revalidatePath('/admin/archive')
    updateTag('shows')
    updateTag('episodes')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to restore show' }
  }
}

export async function resolveConflictsAndRestore(
  showId: string,
  fixes: { episodeId: string; newEpisodeNumber: number }[],
): Promise<RestoreResult> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    // Apply the number fixes to archived episodes
    for (const fix of fixes) {
      const { error } = await admin
        .from('episodes')
        .update({ episode_number: fix.newEpisodeNumber })
        .eq('id', fix.episodeId)

      if (error) return { success: false, error: `Failed to update episode: ${error.message}` }
    }

    // Re-run restore with conflict check
    return restoreShow(showId)
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to resolve conflicts' }
  }
}

export async function deleteShowPermanently(id: string): Promise<ActionResult> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    // First delete storage files
    await admin.storage
      .from('show-artwork')
      .remove([
        `shows/${id}/poster.webp`,
        `shows/${id}/hero.webp`,
        `shows/${id}/logo.png`,
      ])

    // Then delete DB record — CASCADE handles seasons/episodes
    const { error } = await admin
      .from('shows')
      .delete()
      .eq('id', id)

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin/archive')
    updateTag('shows')
    updateTag('episodes')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete show' }
  }
}

// ---------------------------------------------------------------------------
// Season Actions
// ---------------------------------------------------------------------------

export async function createSeason(
  data: z.input<typeof seasonSchema>,
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
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create season' }
  }
}

export async function updateSeason(
  id: string,
  data: Partial<z.input<typeof seasonSchema>>,
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
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update season' }
  }
}

export async function deleteSeason(
  id: string,
  showId: string,
): Promise<ActionResult> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    // Delete season — CASCADE deletes episodes
    const { error } = await admin
      .from('seasons')
      .delete()
      .eq('id', id)

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
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete season' }
  }
}

// ---------------------------------------------------------------------------
// Episode Actions
// ---------------------------------------------------------------------------

export async function createEpisode(
  data: z.input<typeof episodeSchema>,
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
      return { success: false, error: `Episode number ${parsed.episode_number} already exists in this season. Choose a different number.` }
    }

    const { data: episode, error } = await admin
      .from('episodes')
      .insert(parsed)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: `Episode number ${parsed.episode_number} already exists in this season. Choose a different number.` }
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
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create episode' }
  }
}

export async function updateEpisode(
  id: string,
  data: Partial<z.input<typeof episodeSchema>>,
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
          return { success: false, error: `Episode number ${data.episode_number} already exists in this season. Choose a different number.` }
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
        return { success: false, error: 'This episode number already exists in this season. Choose a different number.' }
      }
      return { success: false, error: error.message }
    }

    if (episode) {
      revalidatePath(`/admin/shows/${episode.show_id}`)
      updateTag('episodes')
    }
    return { success: true, data: episode }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update episode' }
  }
}

export async function archiveEpisode(
  id: string,
  showId: string,
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
    return { success: false, error: err instanceof Error ? err.message : 'Failed to archive episode' }
  }
}

export async function reorderEpisode(
  episodeId: string,
  direction: 'up' | 'down',
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
    const adjacentNumber = direction === 'up'
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
    return { success: false, error: err instanceof Error ? err.message : 'Failed to reorder episode' }
  }
}

// ---------------------------------------------------------------------------
// Artwork Upload / Delete
// ---------------------------------------------------------------------------

export async function uploadArtwork(formData: FormData): Promise<ActionResult<string>> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    const file = formData.get('file') as File | null
    const showId = formData.get('showId') as string | null
    const slot = formData.get('slot') as string | null

    if (!file || !showId || !slot) {
      return { success: false, error: 'Missing file, showId, or slot' }
    }

    const ALLOWED_MIME = ['image/webp', 'image/png', 'image/jpeg']
    if (!ALLOWED_MIME.includes(file.type)) {
      return { success: false, error: 'File must be a WebP, PNG, or JPEG image' }
    }
    if (file.size > 10 * 1024 * 1024) {
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
      const transcoded = ext === 'png'
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
    return { success: false, error: err instanceof Error ? err.message : 'Upload failed' }
  }
}

export async function deleteArtwork(showId: string, slot: string): Promise<ActionResult> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    const ext = slot === 'logo' ? 'png' : 'webp'
    const path = `shows/${showId}/${slot}.${ext}`

    const { error } = await admin.storage
      .from('show-artwork')
      .remove([path])

    if (error) return { success: false, error: error.message }

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Delete failed' }
  }
}

// ---------------------------------------------------------------------------
// Hero Video Management
// ---------------------------------------------------------------------------

export async function uploadHeroVideo(formData: FormData): Promise<ActionResult<string>> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    const file = formData.get('file') as File | null
    if (!file) return { success: false, error: 'No file provided' }

    if (file.size > 50 * 1024 * 1024) {
      return { success: false, error: 'Video must be under 50MB' }
    }

    const path = `hero/video.mp4`

    const { error } = await admin.storage
      .from('site-assets')
      .upload(path, file, {
        upsert: true,
        contentType: 'video/mp4',
        cacheControl: '3600',
      })

    if (error) return { success: false, error: error.message }

    const { data: urlData } = admin.storage
      .from('site-assets')
      .getPublicUrl(path)

    // Save URL + type to app_config
    const { error: dbError } = await admin
      .from('app_config')
      .update({ hero_video_url: urlData.publicUrl, hero_video_type: 'mp4' })
      .eq('id', 1)

    if (dbError) return { success: false, error: dbError.message }

    updateTag('site-config')
    revalidatePath('/')
    return { success: true, data: urlData.publicUrl }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Upload failed' }
  }
}

export async function setHeroVideoUrl(youtubeUrl: string): Promise<ActionResult> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    if (!youtubeUrl.trim()) return { success: false, error: 'URL is required' }

    const { error } = await admin
      .from('app_config')
      .update({ hero_video_url: youtubeUrl.trim(), hero_video_type: 'youtube' })
      .eq('id', 1)

    if (error) return { success: false, error: error.message }

    updateTag('site-config')
    revalidatePath('/')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save URL' }
  }
}

export async function removeHeroVideo(): Promise<ActionResult> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    // Try to remove MP4 from storage (ignore errors if not found)
    await admin.storage
      .from('site-assets')
      .remove(['hero/video.mp4'])

    const { error } = await admin
      .from('app_config')
      .update({ hero_video_url: null, hero_video_type: null })
      .eq('id', 1)

    if (error) return { success: false, error: error.message }

    updateTag('site-config')
    revalidatePath('/')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to remove video' }
  }
}

// ---------------------------------------------------------------------------
// Per-Show Hero Video Management
// ---------------------------------------------------------------------------

// Uploads MP4 to storage and returns the public URL. Does NOT write to DB —
// the URL is persisted when the parent form is saved (same pattern as artwork).
export async function uploadShowVideoFile(formData: FormData): Promise<ActionResult<string>> {
  try {
    await assertAdmin()
    const admin = createAdminClient()

    const file = formData.get('file') as File | null
    const showId = formData.get('showId') as string | null
    const variant = formData.get('variant') as 'desktop' | 'mobile' | null

    if (!file || !showId || !variant) return { success: false, error: 'Missing file, showId, or variant' }
    if (variant !== 'desktop' && variant !== 'mobile') return { success: false, error: 'Invalid variant' }
    if (file.type !== 'video/mp4') return { success: false, error: 'File must be an MP4 video' }
    if (file.size > 50 * 1024 * 1024) return { success: false, error: 'Video must be under 50MB' }

    // Versioned path: new uploads never overwrite the live DB-referenced asset in-place.
    // Form state holds the new URL; DB commit happens on Save. Orphans are cleaned up
    // by the scheduled sweep (see TODOS.md).
    const path = `shows/${showId}/hero-${variant}-${Date.now()}.mp4`

    const { error: uploadError } = await admin.storage
      .from('site-assets')
      .upload(path, file, { upsert: false, contentType: 'video/mp4', cacheControl: '3600' })

    if (uploadError) return { success: false, error: uploadError.message }

    const { data: urlData } = admin.storage.from('site-assets').getPublicUrl(path)
    return { success: true, data: urlData.publicUrl }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Upload failed' }
  }
}

// Removes the uploaded MP4 from storage. DB null-out happens on form save.
export async function deleteShowVideoFile(showId: string, variant: 'desktop' | 'mobile'): Promise<ActionResult> {
  try {
    await assertAdmin()
    const admin = createAdminClient()
    await admin.storage.from('site-assets').remove([`shows/${showId}/hero-${variant}.mp4`])
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to remove video' }
  }
}

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

    // If featuring, check we don't exceed 5
    if (newFeatured) {
      const { count } = await admin
        .from('shows')
        .select('id', { count: 'exact', head: true })
        .eq('featured', true)
        .eq('archived', false)

      if ((count ?? 0) >= 5) {
        return { success: false, error: 'Maximum 5 featured shows allowed. Unfeature another show first.' }
      }
    }

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
    return { success: false, error: err instanceof Error ? err.message : 'Failed to toggle featured' }
  }
}

// ---------------------------------------------------------------------------
// Site Settings — admin-only edits of app_config
//
// All actions: assertAdmin() → validate (zod) → update app_config →
// updateTag('site-config') → revalidatePath('/').
// Mirrors the hero video action shape above.
// ---------------------------------------------------------------------------

const urlOrEmpty = z.string().trim().max(500).refine(
  (v) => v === '' || /^https?:\/\//i.test(v),
  'Must be empty or a valid URL (http/https)'
)

const siteMetadataSchema = z.object({
  site_title: z.string().trim().min(1, 'Title is required').max(120),
  site_description: z.string().trim().max(300).nullable(),
  site_tagline: z.string().trim().min(1, 'Tagline is required').max(120),
})

const footerSchema = z.object({
  tagline: z.string().max(300),
  stat: z.string().max(80),
  contactEmail: z.string().trim().max(120).refine(
    (v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    'Invalid email'
  ),
  social: z.object({
    instagram: urlOrEmpty,
    x: urlOrEmpty,
    youtube: urlOrEmpty,
    tiktok: urlOrEmpty,
  }),
  legal: z.object({
    privacy: urlOrEmpty,
    terms: urlOrEmpty,
    cookies: urlOrEmpty,
  }),
})

const hrefOrEmpty = z.string().trim().max(500).refine(
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

export async function updateSiteMetadata(
  input: z.input<typeof siteMetadataSchema>
): Promise<ActionResult> {
  try {
    await assertAdmin()
    const parsed = siteMetadataSchema.parse(input)
    const admin = createAdminClient()
    const { error } = await admin
      .from('app_config')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(parsed as any)
      .eq('id', 1)
    if (error) return { success: false, error: error.message }
    bumpSiteConfigCache()
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save' }
  }
}

export async function updateFooterContent(
  input: z.input<typeof footerSchema>
): Promise<ActionResult> {
  try {
    await assertAdmin()
    const parsed = footerSchema.parse(input)
    const admin = createAdminClient()
    const { error } = await admin
      .from('app_config')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ footer_content: parsed } as any)
      .eq('id', 1)
    if (error) return { success: false, error: error.message }
    bumpSiteConfigCache()
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save' }
  }
}

export async function updateCtaCopy(
  input: z.input<typeof ctaCopySchema>
): Promise<ActionResult> {
  try {
    await assertAdmin()
    const parsed = ctaCopySchema.parse(input)
    const admin = createAdminClient()
    const { error } = await admin
      .from('app_config')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ cta_copy: parsed } as any)
      .eq('id', 1)
    if (error) return { success: false, error: error.message }
    bumpSiteConfigCache()
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save' }
  }
}

export async function updateGenreConfig(
  input: z.input<typeof genreConfigSchema>
): Promise<ActionResult> {
  try {
    await assertAdmin()
    const parsed = genreConfigSchema.parse(input)
    const admin = createAdminClient()
    const { error } = await admin
      .from('app_config')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ genre_config: parsed } as any)
      .eq('id', 1)
    if (error) return { success: false, error: error.message }
    bumpSiteConfigCache()
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save' }
  }
}

export async function updateIntegrations(
  input: z.input<typeof integrationsSchema>
): Promise<ActionResult> {
  try {
    await assertAdmin()
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
    bumpSiteConfigCache()
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save' }
  }
}

export async function updateFeatureFlags(
  input: z.input<typeof featureFlagsSchema>
): Promise<ActionResult> {
  try {
    await assertAdmin()
    const parsed = featureFlagsSchema.parse(input)
    const admin = createAdminClient()
    const { error } = await admin
      .from('app_config')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ feature_flags: parsed } as any)
      .eq('id', 1)
    if (error) return { success: false, error: error.message }
    bumpSiteConfigCache()
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save' }
  }
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
    if (!ext) return { success: false, error: `Unsupported image type: ${mime}` }

    const path = kind === 'og' ? `settings/og.${ext}` : `settings/favicon.${ext}`

    const { error: uploadError } = await admin.storage
      .from('site-assets')
      .upload(path, file, { upsert: true, contentType: mime, cacheControl: '3600' })

    if (uploadError) return { success: false, error: uploadError.message }

    const { data: urlData } = admin.storage.from('site-assets').getPublicUrl(path)
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
    return { success: false, error: err instanceof Error ? err.message : 'Upload failed' }
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
    return { success: false, error: err instanceof Error ? err.message : 'Failed to remove' }
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
    updateTag('site-config')
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to revalidate' }
  }
}
