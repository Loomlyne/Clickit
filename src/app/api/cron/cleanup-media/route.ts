import { NextResponse } from 'next/server'
import { cronAuthOk } from '@/server/cron-auth'
import { getWorkerEnv } from '@/server/cloudflare'
import { stageR2Deletion, type MediaDeleteGuard } from '@/server/r2-delete'
import { findLiveReferences, readMediaReferenceUrls, type ReferenceDb } from '@/server/media-references'
import { getPublicMediaOrigin } from '@/lib/supabase-media'
import { createAdminClient } from '@/lib/supabase/admin'
import { supabaseCleanupEnabled } from '@/server/scheduled'
import { pruneRateLimits } from '@/server/rate-limit-store'

/**
 * Scheduled sweep: deletes hero media files in Supabase Storage that no show
 * in the DB references.
 *
 * Context: the admin upload flow writes new files immediately with versioned
 * paths (shows/{id}/hero-{timestamp}.webp) so in-flight edits can be rolled
 * back via Cancel without destroying the live asset. The tradeoff is that each
 * Save leaves the old file as an orphan. This cron picks up the orphans.
 *
 * Schedule: weekly, Monday 04:00 UTC (src/server/cron-schedule.ts). Wall-clock cost is O(shows + storage
 * objects); at current scale (~15 shows, ~100 files) it finishes in seconds.
 *
 * Safety rules:
 *   - Only deletes files older than 24 hours (prevents racing with an
 *     in-progress drawer edit that hasn't been saved yet).
 *   - Only operates on specific prefixes (shows/{uuid}/hero* etc.) so stray
 *     files in other folders are never touched.
 *   - Requires the CRON_SECRET bearer header so the endpoint can't be called
 *     by anyone who guesses the URL.
 *
 * Also prunes rate_limits rows older than 24 h first (review item 9, PR #29): one
 * DELETE, fail-soft, reported as `rateLimitsPruned`; a failed prune never stops the sweep.
 *
 * Invocation:
 *   The Worker scheduled handler sends `Authorization: Bearer ${CRON_SECRET}`.
 *   Local dev: curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/cleanup-media
 */

const MIN_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours
const SITE_ASSETS_BUCKET = 'site-assets'
const SHOW_ARTWORK_BUCKET = 'show-artwork'

/**
 * Extracts the storage path from a Supabase public URL. Returns null for
 * anything that doesn't look like our own storage (external URLs, malformed
 * entries). We intentionally return null on parse failure rather than throwing
 * so one malformed row doesn't abort the whole sweep.
 */
function extractStoragePath(
  publicUrl: string | null,
  bucket: string
): string | null {
  if (!publicUrl) return null
  try {
    const parsed = new URL(publicUrl)
    const marker = `/storage/v1/object/public/${bucket}/`
    if (!parsed.pathname.startsWith(marker)) return null
    const path = decodeURIComponent(parsed.pathname.slice(marker.length))
    return path && !path.startsWith('/') && !path.split('/').includes('..')
      ? path
      : null
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  // --- Auth guard ----------------------------------------------------------
  // Constant-time compare (PLAT-07); an empty or missing secret refuses.
  if (!(await cronAuthOk(req.headers.get('authorization'), process.env.CRON_SECRET))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Top-level try/catch so an unexpected throw (admin-client init, storage
  // API outage, network blip) still surfaces in logs + returns a 500 with a
  // readable body. Previously a thrown error bubbled silently to a generic
  // Vercel 500 page and we had no record in the cron log.
  try {
    return await runCleanup()
  } catch (err) {
    console.error('[cron/cleanup-media] unhandled failure', err)
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown failure',
      },
      { status: 500 }
    )
  }
}

async function runCleanup() {
  const admin = createAdminClient()
  const startedAt = Date.now()
  const cutoff = new Date(startedAt - MIN_AGE_MS)

  // --- Step 0: prune the rate-limit ledger (never throws) -------------------
  const rateLimitsPruned = await pruneRateLimits(admin, startedAt)
  if (rateLimitsPruned.error) {
    console.error('[cron/cleanup-media] rate_limits prune failed', rateLimitsPruned.error)
  }

  // --- Step 1: gather all URLs currently referenced by the DB --------------
  const [{ data: shows, error: showsError }, { data: cast, error: castError }] =
    await Promise.all([
      admin
        .from('shows')
        .select(
          'hero_url, hero_image_mobile_url, poster_url, card_image_url, logo_url, hero_video_url, hero_video_mobile_url'
        ),
      admin.from('show_cast').select('image_url'),
    ])

  if (showsError || castError) {
    return NextResponse.json(
      {
        error: 'Failed to load media references',
        details: showsError?.message ?? castError?.message,
        rateLimitsPruned,
      },
      { status: 500 }
    )
  }

  const referencedArtwork = new Set<string>()
  const referencedVideos = new Set<string>()

  for (const show of shows ?? []) {
    // Artwork bucket: hero + hero-mobile + poster + logo all live here
    const heroPath = extractStoragePath(show.hero_url, SHOW_ARTWORK_BUCKET)
    const mobileHeroPath = extractStoragePath(
      show.hero_image_mobile_url,
      SHOW_ARTWORK_BUCKET
    )
    const posterPath = extractStoragePath(show.poster_url, SHOW_ARTWORK_BUCKET)
    const cardPath = extractStoragePath(
      show.card_image_url,
      SHOW_ARTWORK_BUCKET
    )
    const logoPath = extractStoragePath(show.logo_url, SHOW_ARTWORK_BUCKET)
    if (heroPath) referencedArtwork.add(heroPath)
    if (mobileHeroPath) referencedArtwork.add(mobileHeroPath)
    if (posterPath) referencedArtwork.add(posterPath)
    if (cardPath) referencedArtwork.add(cardPath)
    if (logoPath) referencedArtwork.add(logoPath)
    // Video bucket: hero videos only
    const videoPath = extractStoragePath(
      show.hero_video_url,
      SITE_ASSETS_BUCKET
    )
    const mobileVideoPath = extractStoragePath(
      show.hero_video_mobile_url,
      SITE_ASSETS_BUCKET
    )
    if (videoPath) referencedVideos.add(videoPath)
    if (mobileVideoPath) referencedVideos.add(mobileVideoPath)
  }

  for (const member of cast ?? []) {
    const imagePath = extractStoragePath(member.image_url, SHOW_ARTWORK_BUCKET)
    if (imagePath) referencedArtwork.add(imagePath)
  }

  // --- Step 2: walk storage and compute orphans ----------------------------
  // Supabase's list() returns one level at a time, so walk every nested path.

  const artworkOrphans: string[] = []
  const videoOrphans: string[] = []

  async function scanBucket(
    bucket: string,
    referenced: Set<string>,
    orphanFilenamePattern: RegExp,
    collect: string[]
  ) {
    async function scanPrefix(prefix: string) {
      let offset = 0
      for (;;) {
        const { data: entries, error: listError } = await admin.storage
          .from(bucket)
          .list(prefix, { limit: 1000, offset })
        if (listError) throw new Error('Could not scan media storage')
        if (!entries) return

        for (const entry of entries) {
          if (!entry.name) continue
          const fullPath = `${prefix}/${entry.name}`
          if (!entry.id) {
            await scanPrefix(fullPath)
            continue
          }
          if (!orphanFilenamePattern.test(entry.name)) continue

          // Skip files newer than the safety cutoff (still might be in an open
          // drawer that hasn't saved yet)
          const createdAt = entry.created_at ? new Date(entry.created_at) : null
          if (createdAt && createdAt > cutoff) continue

          if (!referenced.has(fullPath)) collect.push(fullPath)
        }

        if (entries.length < 1000) return
        offset += entries.length
      }
    }

    await scanPrefix('shows')
  }

  // Artwork bucket: versioned filenames for hero, hero-mobile, poster, card,
  // logo, and nested cast portraits. All artwork slots now use timestamped
  // names after the poster/logo versioning fix. Stable-path legacy files (poster.webp,
  // logo.png, hero.webp from pre-migration shows) won't match this regex
  // and are left untouched — their DB URLs still point at them.
  await scanBucket(
    SHOW_ARTWORK_BUCKET,
    referencedArtwork,
    /^(?:(hero(-mobile)?|poster|card|logo)-\d+|\d+)\.(webp|png|jpg|jpeg)$/,
    artworkOrphans
  )
  // Videos bucket: hero-desktop-*.mp4, hero-mobile-*.mp4
  await scanBucket(
    SITE_ASSETS_BUCKET,
    referencedVideos,
    /^hero-(desktop|mobile)-\d+\.mp4$/,
    videoOrphans
  )

  // On the Worker, Supabase Storage originals are never deleted in this phase
  // (T-02-26): report what would go and stop before any storage call that
  // writes. Switched on only by CLEANUP_SUPABASE_ORIGINALS=on.
  if (!supabaseCleanupEnabled(process.env)) {
    const candidates = artworkOrphans.length + videoOrphans.length
    console.log('[cron/cleanup-media] skipped supabase-originals', {
      candidates,
      artworkOrphans: artworkOrphans.length,
      videoOrphans: videoOrphans.length,
    })
    return NextResponse.json({ ok: true, skipped: 'supabase-originals', candidates, rateLimitsPruned })
  }

  // --- Step 3: delete orphans ---------------------------------------------
  let artworkDeleted = 0
  let videoDeleted = 0
  const errors: string[] = []

  // Step 1 only looked at shows and cast. A file can also be live in the site settings,
  // another table or a profile (deferred item 22), so every orphan is re-checked against
  // every reference right before deletion; a failed read deletes nothing.
  const guard: MediaDeleteGuard = {
    readReferences: () => readMediaReferenceUrls(admin as unknown as ReferenceDb),
    mediaOrigin: getPublicMediaOrigin(),
    label: '[cron/cleanup-media]',
  }

  async function deleteOrphans(
    label: 'artwork' | 'video',
    bucket: typeof SHOW_ARTWORK_BUCKET | typeof SITE_ASSETS_BUCKET,
    candidates: string[]
  ) {
    if (candidates.length === 0) return 0

    const refs = await findLiveReferences(
      candidates.map((path) => `${bucket}/${path}`),
      guard.readReferences,
      guard.mediaOrigin
    )
    if (refs.error !== null) {
      errors.push(`${label}: could not read media references; nothing deleted`)
      return 0
    }
    const live = new Set(refs.live)
    const paths = candidates.filter((path) => !live.has(`${bucket}/${path}`))
    if (paths.length === 0) return 0

    // Supabase original first, then its R2 mirror and variants by key (the MEDIA binding;
    // nothing is deleted from R2 unless the Supabase delete worked). Only reached when
    // CLEANUP_SUPABASE_ORIGINALS=on.
    const { error } = await admin.storage.from(bucket).remove(paths)
    if (error) {
      errors.push(`${label}: ${error.message}`)
      return 0
    }

    const r2 = stageR2Deletion(
      (await getWorkerEnv()).MEDIA,
      paths.map((path) => `${bucket}/${path}`),
      guard
    )
    if (!(await r2.commit())) {
      errors.push(`${label}: R2 mirror delete failed`)
    }
    return paths.length
  }

  artworkDeleted = await deleteOrphans(
    'artwork',
    SHOW_ARTWORK_BUCKET,
    artworkOrphans
  )
  videoDeleted = await deleteOrphans('video', SITE_ASSETS_BUCKET, videoOrphans)

  const durationMs = Date.now() - startedAt

  // Structured log so you can grep Vercel function logs after a sweep
  console.log('[cron/cleanup-media]', {
    shows: shows?.length ?? 0,
    referencedArtwork: referencedArtwork.size,
    referencedVideos: referencedVideos.size,
    artworkOrphans: artworkOrphans.length,
    videoOrphans: videoOrphans.length,
    artworkDeleted,
    videoDeleted,
    durationMs,
    errors,
    rateLimitsPruned,
  })

  return NextResponse.json({
    ok: errors.length === 0,
    shows: shows?.length ?? 0,
    referenced: {
      artwork: referencedArtwork.size,
      videos: referencedVideos.size,
    },
    orphans: { artwork: artworkOrphans.length, videos: videoOrphans.length },
    deleted: { artwork: artworkDeleted, videos: videoDeleted },
    durationMs,
    errors,
    rateLimitsPruned,
  })
}
