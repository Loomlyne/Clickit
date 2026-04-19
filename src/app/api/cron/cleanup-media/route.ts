import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Scheduled sweep: deletes hero media files in Supabase Storage that no show
 * in the DB references.
 *
 * Context: the admin upload flow writes new files immediately with versioned
 * paths (shows/{id}/hero-{timestamp}.webp) so in-flight edits can be rolled
 * back via Cancel without destroying the live asset. The tradeoff is that each
 * Save leaves the old file as an orphan. This cron picks up the orphans.
 *
 * Schedule: weekly (see vercel.json). Wall-clock cost is O(shows + storage
 * objects); at current scale (~15 shows, ~100 files) it finishes in seconds.
 *
 * Safety rules:
 *   - Only deletes files older than 24 hours (prevents racing with an
 *     in-progress drawer edit that hasn't been saved yet).
 *   - Only operates on specific prefixes (shows/{uuid}/hero* etc.) so stray
 *     files in other folders are never touched.
 *   - Requires the Vercel CRON_SECRET header so the endpoint can't be called
 *     by anyone who guesses the URL.
 *
 * Invocation:
 *   Vercel cron sends `Authorization: Bearer ${CRON_SECRET}` automatically.
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
function extractStoragePath(publicUrl: string | null, bucket: string): string | null {
  if (!publicUrl) return null
  const marker = `/storage/v1/object/public/${bucket}/`
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return null
  return publicUrl.slice(idx + marker.length)
}

export async function GET(req: Request) {
  // --- Auth guard ----------------------------------------------------------
  const authHeader = req.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || authHeader !== expected) {
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
      { ok: false, error: err instanceof Error ? err.message : 'Unknown failure' },
      { status: 500 },
    )
  }
}

async function runCleanup() {
  const admin = createAdminClient()
  const startedAt = Date.now()
  const cutoff = new Date(startedAt - MIN_AGE_MS)

  // --- Step 1: gather all URLs currently referenced by the DB --------------
  const { data: shows, error: showsError } = await admin
    .from('shows')
    .select('hero_url, hero_image_mobile_url, poster_url, logo_url, hero_video_url, hero_video_mobile_url')

  if (showsError) {
    return NextResponse.json({ error: 'Failed to load shows', details: showsError.message }, { status: 500 })
  }

  const referencedArtwork = new Set<string>()
  const referencedVideos = new Set<string>()

  for (const show of shows ?? []) {
    // Artwork bucket: hero + hero-mobile + poster + logo all live here
    const heroPath = extractStoragePath(show.hero_url, SHOW_ARTWORK_BUCKET)
    const mobileHeroPath = extractStoragePath(show.hero_image_mobile_url, SHOW_ARTWORK_BUCKET)
    const posterPath = extractStoragePath(show.poster_url, SHOW_ARTWORK_BUCKET)
    const logoPath = extractStoragePath(show.logo_url, SHOW_ARTWORK_BUCKET)
    if (heroPath) referencedArtwork.add(heroPath)
    if (mobileHeroPath) referencedArtwork.add(mobileHeroPath)
    if (posterPath) referencedArtwork.add(posterPath)
    if (logoPath) referencedArtwork.add(logoPath)
    // Video bucket: hero videos only
    const videoPath = extractStoragePath(show.hero_video_url, SITE_ASSETS_BUCKET)
    const mobileVideoPath = extractStoragePath(show.hero_video_mobile_url, SITE_ASSETS_BUCKET)
    if (videoPath) referencedVideos.add(videoPath)
    if (mobileVideoPath) referencedVideos.add(mobileVideoPath)
  }

  // --- Step 2: walk storage and compute orphans ----------------------------
  // We only enumerate the `shows/` subtree. Each show has at most one folder.
  // Supabase's list() returns one level at a time, so we iterate per-show.

  const artworkOrphans: string[] = []
  const videoOrphans: string[] = []

  async function scanBucket(
    bucket: string,
    referenced: Set<string>,
    orphanFilenamePattern: RegExp,
    collect: string[],
  ) {
    const { data: showFolders, error: listShowsErr } = await admin.storage
      .from(bucket)
      .list('shows', { limit: 1000 })
    if (listShowsErr || !showFolders) return

    for (const folder of showFolders) {
      // Skip non-folder entries (shouldn't happen under shows/ but defensive)
      if (!folder.name || folder.id) continue
      const { data: files, error: filesErr } = await admin.storage
        .from(bucket)
        .list(`shows/${folder.name}`, { limit: 1000 })
      if (filesErr || !files) continue

      for (const file of files) {
        if (!file.name) continue
        if (!orphanFilenamePattern.test(file.name)) continue

        // Skip files newer than the safety cutoff (still might be in an open
        // drawer that hasn't saved yet)
        const createdAt = file.created_at ? new Date(file.created_at) : null
        if (createdAt && createdAt > cutoff) continue

        const fullPath = `shows/${folder.name}/${file.name}`
        if (!referenced.has(fullPath)) collect.push(fullPath)
      }
    }
  }

  // Artwork bucket: versioned filenames for hero, hero-mobile, poster, logo.
  // All four slots now use the {slot}-{timestamp}.{ext} pattern after the
  // poster/logo versioning fix. Stable-path legacy files (poster.webp,
  // logo.png, hero.webp from pre-migration shows) won't match this regex
  // and are left untouched — their DB URLs still point at them.
  await scanBucket(
    SHOW_ARTWORK_BUCKET,
    referencedArtwork,
    /^(hero(-mobile)?|poster|logo)-\d+\.(webp|png|jpg|jpeg)$/,
    artworkOrphans,
  )
  // Videos bucket: hero-desktop-*.mp4, hero-mobile-*.mp4
  await scanBucket(SITE_ASSETS_BUCKET, referencedVideos, /^hero-(desktop|mobile)-\d+\.mp4$/, videoOrphans)

  // --- Step 3: delete orphans ---------------------------------------------
  let artworkDeleted = 0
  let videoDeleted = 0
  const errors: string[] = []

  if (artworkOrphans.length > 0) {
    const { error } = await admin.storage.from(SHOW_ARTWORK_BUCKET).remove(artworkOrphans)
    if (error) errors.push(`artwork: ${error.message}`)
    else artworkDeleted = artworkOrphans.length
  }
  if (videoOrphans.length > 0) {
    const { error } = await admin.storage.from(SITE_ASSETS_BUCKET).remove(videoOrphans)
    if (error) errors.push(`video: ${error.message}`)
    else videoDeleted = videoOrphans.length
  }

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
  })

  return NextResponse.json({
    ok: errors.length === 0,
    shows: shows?.length ?? 0,
    referenced: { artwork: referencedArtwork.size, videos: referencedVideos.size },
    orphans: { artwork: artworkOrphans.length, videos: videoOrphans.length },
    deleted: { artwork: artworkDeleted, videos: videoDeleted },
    durationMs,
    errors,
  })
}
