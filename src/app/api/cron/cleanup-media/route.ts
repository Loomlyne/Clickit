import { NextResponse } from 'next/server'
import { cronAuthOk } from '@/server/cron-auth'
import { getWorkerEnv } from '@/server/cloudflare'
import { stageR2Deletion, type MediaDeleteGuard } from '@/server/r2-delete'
import {
  findLiveReferences,
  readMediaReferenceUrls,
  referencedPathsByBucket,
  type ReferenceDb,
} from '@/server/media-references'
import { getPublicMediaOrigin } from '@/lib/supabase-media'
import { createAdminClient } from '@/lib/supabase/admin'
import { supabaseCleanupEnabled } from '@/server/scheduled'
import { pruneRateLimits } from '@/server/rate-limit-store'
import { runUploadSweep } from '@/server/r2-upload-sweep'

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
 * Then sweeps R2 uploads that were never finalised (src/server/r2-upload-sweep.ts):
 * minted upload keys older than 24 h with no live reference, in the app Worker's MEDIA
 * bucket. Dry run unless R2_UPLOAD_SWEEP_DELETE is exactly "on" (Koss's word). Fail-soft,
 * reported as `r2UploadSweep` in every response.
 *
 * Invocation:
 *   The Worker scheduled handler sends `Authorization: Bearer ${CRON_SECRET}`.
 *   Local dev: curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/cleanup-media
 */

const MIN_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours
const SITE_ASSETS_BUCKET = 'site-assets'
const SHOW_ARTWORK_BUCKET = 'show-artwork'

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

  // --- Step 0b: R2 uploads never finalised (never throws) -------------------
  // Before the Supabase sweep, which returns early on the Worker and can fail.
  const r2UploadSweep = await runUploadSweep({
    getEnv: getWorkerEnv,
    guard: {
      readReferences: () => readMediaReferenceUrls(admin as unknown as ReferenceDb),
      mediaOrigin: getPublicMediaOrigin(),
      label: '[cron/cleanup-media r2-upload-sweep]',
    },
    nowMs: startedAt,
  })
  const sweepLog = {
    mode: r2UploadSweep.mode,
    examined: r2UploadSweep.examined,
    truncated: r2UploadSweep.truncated,
    candidates: r2UploadSweep.candidates,
    deleted: r2UploadSweep.deleted,
    error: r2UploadSweep.error,
  }
  if (r2UploadSweep.error) {
    console.error('[cron/cleanup-media] r2 upload sweep failed', sweepLog)
  } else {
    console.log('[cron/cleanup-media] r2 upload sweep', { ...sweepLog, candidateKeys: r2UploadSweep.candidateKeys })
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
        r2UploadSweep,
      },
      { status: 500 }
    )
  }

  // Every url form counts (the helper the R2 sweep uses): a Supabase public url, our
  // media origin, media.clickitstory.ae or a workers.dev media host. After the media-url
  // rewrite rows hold media-host urls; a Supabase-only parser would call those objects
  // orphans (PR #31 review 5). Each key lands in its own bucket's set.
  const urls: Array<string | null> = []
  for (const show of shows ?? []) {
    urls.push(
      show.hero_url,
      show.hero_image_mobile_url,
      show.poster_url,
      show.card_image_url,
      show.logo_url,
      show.hero_video_url,
      show.hero_video_mobile_url
    )
  }
  for (const member of cast ?? []) urls.push(member.image_url)

  const referencedPaths = referencedPathsByBucket(urls, getPublicMediaOrigin())
  const referencedArtwork = referencedPaths.get(SHOW_ARTWORK_BUCKET) ?? new Set<string>()
  const referencedVideos = referencedPaths.get(SITE_ASSETS_BUCKET) ?? new Set<string>()

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
    return NextResponse.json({ ok: true, skipped: 'supabase-originals', candidates, rateLimitsPruned, r2UploadSweep })
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
    r2UploadSweep: sweepLog,
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
    r2UploadSweep,
  })
}
