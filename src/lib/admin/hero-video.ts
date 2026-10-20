// Video core for hero (desktop, mobile), preloader and per-show hero videos (plans 01.1 and 02-16).
// The object is already in R2 (presigned PUT). This core proves it is ours (finalize port: key shape,
// size, magic bytes), re-checks the size with head(), reads only the first 4 MiB to check fast-start
// and the audio track, then keeps the Phase 01.1 order: write the target, strict audit row, and only
// then commit the deletion of the previous R2 object. An audit failure restores the previous value and
// deletes the new object. A previous Supabase Storage URL is never deleted.
// No next/*, server-only or '@/' imports: node --test loads this file.
import { isFaststart, moovBytes } from '../../server/mp4-boxes.ts'
import { HERO_VIDEO_MAX_BYTES, HERO_VIDEO_TOO_LARGE } from './media-guards.ts'
import { parseHeroVariant, parseId } from './schemas.ts'
import type { HeroVariant } from './schemas.ts'
import type { AdminDb, AuditWriter, CoreResult } from './ports'

export type { HeroVariant }

export const HERO_VIDEO_PREFIX: Record<HeroVariant, string> = {
  desktop: 'hero/video',
  mobile: 'hero/video-mobile',
}
export const HERO_URL_COLUMN: Record<HeroVariant, 'hero_video_url' | 'hero_video_mobile_url'> = {
  desktop: 'hero_video_url',
  mobile: 'hero_video_mobile_url',
}
export const HERO_TYPE_COLUMN: Record<HeroVariant, 'hero_video_type' | 'hero_video_mobile_type'> = {
  desktop: 'hero_video_type',
  mobile: 'hero_video_mobile_type',
}

// Legacy (Supabase signed upload) path helpers, used by the old create*/save* actions until plan 02-19.
export function createHeroVideoPath(variant: HeroVariant) {
  return `${HERO_VIDEO_PREFIX[variant]}-${Date.now()}.mp4`
}

export function isHeroVideoUploadPath(path: string, variant: HeroVariant) {
  const prefix = HERO_VIDEO_PREFIX[variant].replace('/', '\\/')
  return new RegExp(`^${prefix}-\\d+\\.mp4$`).test(path)
}

/** Finalize reads at most this many bytes of the object (T-02-73). */
export const VIDEO_HEAD_BYTES = 4 * 1024 * 1024
export const PRELOADER_VIDEO_MAX_BYTES = 20 * 1024 * 1024
export const PRELOADER_VIDEO_TOO_LARGE = 'Video must be under 20MB'
export const VIDEO_NOT_FASTSTART =
  'Video is not fast-start. Export it with fast start (moov at the beginning) and upload again.'
export const VIDEO_NO_AUDIO = 'This MP4 has no audio track. Re-export with audio enabled (AAC) and upload again.'
export const MEDIA_HOST_NOT_READY = 'Media host is not ready'

type HeroType = 'mp4' | 'youtube' | null
type StagedDeletion = { commit(): Promise<boolean>; rollback(): Promise<boolean> }

export type VideoFinalizeOutcome =
  | { ok: true; key: string }
  | { ok: false; error: string; cleanupFailed?: true }

export type VideoFinalizeKind = 'hero-video' | 'preloader-video' | 'show-video'

export type HeroVideoPorts = {
  db: AdminDb
  /** https verified media origin (or the local-preview loopback); null when the media host is not ready. */
  mediaOrigin: string | null
  /** Bound to the R2 binding: key shape and owner, size cap, MP4 magic bytes, delete on refusal. */
  finalize(input: {
    kind: VideoFinalizeKind
    slot: string | null
    showId: string | null
    userId: string
    key: string
  }): Promise<VideoFinalizeOutcome>
  /** R2 HEAD: the object size, or null when there is no such object. */
  head(key: string): Promise<{ size: number } | null>
  /** R2 range read of the first `maxBytes` bytes; null when the object is gone. */
  readHead(key: string, maxBytes: number): Promise<Uint8Array | null>
  media: {
    /** R2 delete; may throw. */
    delete(keys: string[]): Promise<void>
    /** Stage the deletion of previous R2 objects: nothing is deleted before commit(). */
    stageDeletion(keys: string[]): Promise<StagedDeletion>
  }
  hasAudioTrack(bytes: Uint8Array): boolean
  /** The R2 keys behind a stored url; [] for Supabase Storage urls, null and foreign hosts. */
  previousR2Keys(url: string | null): string[]
  /** The object key behind a stored url for the audit row, or null. */
  storagePathFromUrl(url: string | null): string | null
}

type Deps = { audit: AuditWriter; adminUserId: string }
type HeroResult<T = unknown> = CoreResult<T> & { mediaCleanupFailed?: boolean }

type Slot = {
  read(db: AdminDb): Promise<{ error: string } | { error: null; url: string | null; type: HeroType }>
  write(db: AdminDb, url: string | null, type: HeroType): Promise<string | null>
}

function heroSlot(variant: HeroVariant): Slot {
  return {
    async read(db) {
      const { data, error } = await db.from('app_config').select().eq('id', 1).single()
      if (error || !data) return { error: error?.message ?? 'Missing site config' }
      const row = data as unknown as Record<string, string | null>
      return {
        error: null,
        url: (row[HERO_URL_COLUMN[variant]] ?? null) as string | null,
        type: (row[HERO_TYPE_COLUMN[variant]] ?? null) as HeroType,
      }
    },
    async write(db, url, type) {
      const { error } = await db
        .from('app_config')
        .update({ [HERO_URL_COLUMN[variant]]: url, [HERO_TYPE_COLUMN[variant]]: type } as never)
        .eq('id', 1)
      return error ? error.message : null
    },
  }
}

function preloaderSlot(): Slot {
  return {
    async read(db) {
      const { data, error } = await db.from('app_config').select().eq('id', 1).single()
      if (error || !data) return { error: error?.message ?? 'Missing site config' }
      const row = data as unknown as Record<string, string | null>
      return { error: null, url: row.preloader_video_url ?? null, type: row.preloader_video_url ? 'mp4' : null }
    },
    async write(db, url) {
      const { error } = await db
        .from('app_config')
        .update({ preloader_video_url: url } as never)
        .eq('id', 1)
      return error ? error.message : null
    },
  }
}

function showSlot(showId: string, variant: HeroVariant): Slot {
  return {
    async read(db) {
      const { data, error } = await db.from('shows').select().eq('id', showId).single()
      if (error || !data) return { error: error?.message ?? 'Show not found' }
      const row = data as unknown as Record<string, string | null>
      return {
        error: null,
        url: (row[HERO_URL_COLUMN[variant]] ?? null) as string | null,
        type: (row[HERO_TYPE_COLUMN[variant]] ?? null) as HeroType,
      }
    },
    async write(db, url, type) {
      const { error } = await db
        .from('shows')
        .update({ [HERO_URL_COLUMN[variant]]: url, [HERO_TYPE_COLUMN[variant]]: type } as never)
        .eq('id', showId)
      return error ? error.message : null
    },
  }
}

type TailInput = {
  /** null: nothing in the database changes (a form holds the url until Save); the upload is still audited. */
  slot: Slot | null
  /** Wording of the failure messages: "the hero video was not changed". */
  noun: string
  setting: string
  newUrl: string | null
  newType: HeroType
  newKey: string | null
  audit: Parameters<AuditWriter>[0]
  configFailureMessage: (rolledBack: boolean, error: string) => string
}

async function deleteQuietly(ports: HeroVideoPorts, keys: string[]): Promise<boolean> {
  if (keys.length === 0) return true
  try {
    await ports.media.delete(keys)
    return true
  } catch (err) {
    console.error('[hero-video] R2 cleanup failed', err)
    return false
  }
}

/** Common tail: stage previous deletion, write the target, audit, and only then commit. */
async function applyVideoChange<T>(
  ports: HeroVideoPorts,
  deps: Deps,
  input: TailInput,
  successData: T,
  extraAuditDiff: (previous: { url: string | null; path: string | null }) => Record<string, unknown>
): Promise<HeroResult<T>> {
  const { slot, newKey } = input
  const cleanupNew = async () => (newKey ? deleteQuietly(ports, [newKey]) : true)
  const withCleanup = async (result: HeroResult<T>): Promise<HeroResult<T>> => {
    if (!(await cleanupNew())) result.mediaCleanupFailed = true
    return result
  }

  let previousUrl: string | null = null
  let previousType: HeroType = null
  if (slot) {
    const previous = await slot.read(ports.db)
    if (previous.error !== null) {
      return withCleanup({ success: false, error: previous.error, wrote: false })
    }
    previousUrl = previous.url
    previousType = previous.type
  }
  const previousPath = ports.storagePathFromUrl(previousUrl)
  // Only R2 objects of ours: a Supabase Storage url yields no keys and is never deleted.
  const doomed = ports.previousR2Keys(previousUrl).filter((k) => k !== newKey)
  const staged = slot && doomed.length > 0 ? await ports.media.stageDeletion(doomed) : null

  if (slot) {
    const configError = await slot.write(ports.db, input.newUrl, input.newType)
    if (configError) {
      const restored = await staged?.rollback()
      return withCleanup({
        success: false,
        error: input.configFailureMessage(restored !== false, configError),
        wrote: false,
      })
    }
  }

  const auditResult = await deps.audit({
    ...input.audit,
    diff: { ...(input.audit.diff ?? {}), ...extraAuditDiff({ url: previousUrl, path: previousPath }) },
  })
  if (auditResult.error) {
    let restoreError: string | null = null
    if (slot) restoreError = await slot.write(ports.db, previousUrl, previousType)
    const rolledBack = await staged?.rollback()
    let error = `Could not write the audit record; the ${input.noun} was not changed.`
    if (restoreError) {
      error += ` Restoring the previous ${input.setting} setting also failed: ${restoreError}.`
    }
    if (rolledBack === false) error += ' Restoring the previous media also failed.'
    return withCleanup({ success: false, error, wrote: slot !== null })
  }

  const committed = await staged?.commit()
  const out: HeroResult<T> = { success: true, data: successData, wrote: slot !== null }
  if (committed === false) out.mediaCleanupFailed = true
  return out
}

export type VideoTarget = 'hero-desktop' | 'hero-mobile' | 'preloader' | 'show'
const VIDEO_TARGETS: readonly string[] = ['hero-desktop', 'hero-mobile', 'preloader', 'show']

export type SaveVideoInput = {
  key: unknown
  target: unknown
  showId?: unknown
  variant?: unknown
  /** Show target only. Default true: the show row is written. false: a form holds the url until Save. */
  commit?: boolean
}

/**
 * Finalize one uploaded video. Refusals delete the new object (finalize itself deletes what it
 * refuses). Nothing is written before the checks pass, and the previous object goes last.
 */
export async function saveVideoCore(
  ports: HeroVideoPorts,
  deps: Deps,
  input: SaveVideoInput
): Promise<HeroResult<string>> {
  const fail = (error: string): HeroResult<string> => ({ success: false, error, wrote: false })

  const target = input.target
  if (typeof target !== 'string' || !VIDEO_TARGETS.includes(target)) return fail('Invalid video target.')
  const key = input.key
  if (typeof key !== 'string' || key.length === 0 || key.length > 300) return fail('Invalid upload path')

  let slot: Slot | null
  let kind: VideoFinalizeKind
  let finalizeSlot: string | null
  let showId: string | null = null
  let maxBytes = HERO_VIDEO_MAX_BYTES
  let tooLarge = HERO_VIDEO_TOO_LARGE
  let needsAudio = false
  let noun = 'hero video'
  let setting = 'hero'

  if (target === 'hero-desktop' || target === 'hero-mobile') {
    const variant: HeroVariant = target === 'hero-mobile' ? 'mobile' : 'desktop'
    slot = heroSlot(variant)
    kind = 'hero-video'
    finalizeSlot = variant
    needsAudio = true
  } else if (target === 'preloader') {
    slot = preloaderSlot()
    kind = 'preloader-video'
    finalizeSlot = null
    maxBytes = PRELOADER_VIDEO_MAX_BYTES
    tooLarge = PRELOADER_VIDEO_TOO_LARGE
    noun = 'preloader video'
    setting = 'preloader'
  } else {
    const id = parseId(input.showId, 'show')
    if (!id.ok) return fail(id.error)
    if (input.variant !== 'desktop' && input.variant !== 'mobile') return fail('Invalid hero variant.')
    const variant: HeroVariant = input.variant
    showId = id.value
    slot = input.commit === false ? null : showSlot(id.value, variant)
    kind = 'show-video'
    finalizeSlot = variant
    noun = 'show video'
    setting = 'show video'
  }
  const slotLabel =
    target === 'show' ? `show_${finalizeSlot}` : target === 'preloader' ? 'preloader' : `hero_${finalizeSlot}`

  // Before anything is touched: a url we cannot serve must never reach the database.
  if (!ports.mediaOrigin) return fail(MEDIA_HOST_NOT_READY)

  const fin = await ports.finalize({ kind, slot: finalizeSlot, showId, userId: deps.adminUserId, key })
  // Finalize already removed what it could prove to be ours; nothing was written.
  if (!fin.ok) {
    const out = fail(fin.error)
    if (fin.cleanupFailed) out.mediaCleanupFailed = true
    return out
  }

  const refuseAndRemove = async (message: string): Promise<HeroResult<string>> => {
    const removed = await deleteQuietly(ports, [key])
    const out = fail(removed ? message : `${message}; The uploaded file could not be removed.`)
    if (!removed) out.mediaCleanupFailed = true
    return out
  }

  const head = await ports.head(key)
  if (!head) return fail('Upload not found')
  const size = head.size
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
    return refuseAndRemove('No file provided')
  }
  if (size > maxBytes) return refuseAndRemove(tooLarge)

  // Only the first 4 MiB are read: enough for ftyp, moov and the start of mdat (T-02-73).
  const bytes = await ports.readHead(key, Math.min(size, VIDEO_HEAD_BYTES))
  if (!bytes) return refuseAndRemove('Could not verify uploaded video')
  if (isFaststart(bytes) !== true) return refuseAndRemove(VIDEO_NOT_FASTSTART)
  if (needsAudio && !ports.hasAudioTrack(moovBytes(bytes) ?? new Uint8Array(0))) {
    return refuseAndRemove(VIDEO_NO_AUDIO)
  }

  const newUrl = `${ports.mediaOrigin}/${key}`
  const sizeMB = Math.round((size / (1024 * 1024)) * 100) / 100

  return applyVideoChange(
    ports,
    deps,
    {
      slot,
      noun,
      setting,
      newUrl,
      newType: 'mp4',
      newKey: key,
      audit: {
        adminUserId: deps.adminUserId,
        action: 'upload',
        entity: 'storage',
        diff: { slot: slotLabel, ...(showId ? { show_id: showId } : {}), path: key, sizeMB },
      },
      configFailureMessage: (_ok, error) => error,
    },
    newUrl,
    (previous) => ({ previous_path: previous.path })
  )
}

/** Phase 01.1 entry point: a hero video for one variant. */
export async function saveHeroVideoCore(
  ports: HeroVideoPorts,
  deps: Deps,
  input: { path: unknown; variant: unknown }
): Promise<HeroResult<string>> {
  const v = parseHeroVariant(input.variant)
  if (!v.ok) return { success: false, error: v.error, wrote: false }
  return saveVideoCore(ports, deps, {
    key: input.path,
    target: v.value === 'mobile' ? 'hero-mobile' : 'hero-desktop',
  })
}

export async function setHeroVideoUrlCore(
  ports: HeroVideoPorts,
  deps: Deps,
  input: { canonicalUrl: string; variant: unknown }
): Promise<HeroResult> {
  const v = parseHeroVariant(input.variant)
  if (!v.ok) return { success: false, error: v.error, wrote: false }
  const variant = v.value
  return applyVideoChange(
    ports,
    deps,
    {
      slot: heroSlot(variant),
      noun: 'hero video',
      setting: 'hero',
      newUrl: input.canonicalUrl,
      newType: 'youtube',
      newKey: null,
      audit: {
        adminUserId: deps.adminUserId,
        action: 'config_update',
        entity: 'app_config',
        diff: { variant, keys: [HERO_URL_COLUMN[variant], HERO_TYPE_COLUMN[variant]] },
      },
      configFailureMessage: (ok, error) => (ok ? error : 'Could not save the hero URL and restore R2 media'),
    },
    undefined,
    (previous) => ({ previous_url: previous.url })
  )
}

export async function removeHeroVideoCore(
  ports: HeroVideoPorts,
  deps: Deps,
  input: { variant: unknown }
): Promise<HeroResult> {
  const v = parseHeroVariant(input.variant)
  if (!v.ok) return { success: false, error: v.error, wrote: false }
  const variant = v.value
  return applyVideoChange(
    ports,
    deps,
    {
      slot: heroSlot(variant),
      noun: 'hero video',
      setting: 'hero',
      newUrl: null,
      newType: null,
      newKey: null,
      audit: {
        adminUserId: deps.adminUserId,
        action: 'remove_media',
        entity: 'app_config',
        diff: { variant },
      },
      configFailureMessage: (ok, error) => (ok ? error : 'Could not remove the hero video and restore R2 media'),
    },
    undefined,
    (previous) => ({ previous_path: previous.path })
  )
}
