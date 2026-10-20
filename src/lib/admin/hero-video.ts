// Hero video core: server-verified size, audit row written before the previous media
// deletion is committed, full rollback when the audit row cannot be written.
// No next/*, server-only or '@/' imports: node --test loads this file.
import { HERO_VIDEO_MAX_BYTES, HERO_VIDEO_TOO_LARGE, verifyUploadedVideoSize } from './media-guards.ts'
import { parseHeroVariant } from './schemas.ts'
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

export function createHeroVideoPath(variant: HeroVariant) {
  return `${HERO_VIDEO_PREFIX[variant]}-${Date.now()}.mp4`
}

export function isHeroVideoUploadPath(path: string, variant: HeroVariant) {
  const prefix = HERO_VIDEO_PREFIX[variant].replace('/', '\\/')
  return new RegExp(`^${prefix}-\\d+\\.mp4$`).test(path)
}

type HeroType = 'mp4' | 'youtube' | null
type StagedDeletion = { commit(): Promise<boolean>; rollback(): Promise<boolean> }

export type HeroVideoPorts = {
  db: AdminDb
  storage: {
    info(path: string): Promise<{ data: { size?: number } | null; error: { message: string } | null }>
    download(path: string): Promise<{ data: Blob | null; error: { message: string } | null }>
    remove(paths: string[]): Promise<{ error: { message: string } | null }>
    publicUrl(path: string): string
  }
  media: {
    mirrorUpload(path: string, blob: Blob): Promise<void>
    cleanup(paths: string[]): Promise<void>
    stageDeletion(paths: string[]): Promise<StagedDeletion>
  }
  hasAudioTrack(bytes: Uint8Array): boolean
  storagePathFromUrl(url: string | null): string | null
  now(): number
}

type Deps = { audit: AuditWriter; adminUserId: string }
type HeroResult<T = unknown> = CoreResult<T> & { mediaCleanupFailed?: boolean }

const AUDIT_FAILED = 'Could not write the audit record; the hero video was not changed.'

async function readHeroConfig(db: AdminDb, variant: HeroVariant) {
  const { data, error } = await db.from('app_config').select().eq('id', 1).single()
  if (error || !data) return { error: error?.message ?? 'Missing site config' }
  const row = data as unknown as Record<string, string | null>
  return {
    error: null,
    url: (row[HERO_URL_COLUMN[variant]] ?? null) as string | null,
    type: (row[HERO_TYPE_COLUMN[variant]] ?? null) as HeroType,
  }
}

async function writeHeroConfig(db: AdminDb, variant: HeroVariant, url: string | null, type: HeroType) {
  const { error } = await db
    .from('app_config')
    .update({ [HERO_URL_COLUMN[variant]]: url, [HERO_TYPE_COLUMN[variant]]: type } as never)
    .eq('id', 1)
  return error ? error.message : null
}

type TailInput = {
  variant: HeroVariant
  newUrl: string | null
  newType: HeroType
  newPath: string | null
  audit: Parameters<AuditWriter>[0]
  configFailureMessage: (rolledBack: boolean, error: string) => string
}

/** Common tail: stage previous deletion, write config, audit, and only then commit. */
async function applyHeroChange<T>(
  ports: HeroVideoPorts,
  deps: Deps,
  input: TailInput,
  successData: T,
  extraAuditDiff: (previous: { url: string | null; path: string | null }) => Record<string, unknown>
): Promise<HeroResult<T>> {
  const { variant, newPath } = input
  const cleanupNew = async () => {
    if (newPath) await ports.media.cleanup([newPath])
  }
  const previous = await readHeroConfig(ports.db, variant)
  if (previous.error) {
    await cleanupNew()
    return { success: false, error: previous.error, wrote: false }
  }
  const previousPath = ports.storagePathFromUrl(previous.url ?? null)
  const staged = previousPath && previousPath !== newPath ? await ports.media.stageDeletion([previousPath]) : null

  const configError = await writeHeroConfig(ports.db, variant, input.newUrl, input.newType)
  if (configError) {
    const restored = await staged?.rollback()
    await cleanupNew()
    return {
      success: false,
      error: input.configFailureMessage(restored !== false, configError),
      wrote: false,
    }
  }

  const auditResult = await deps.audit({
    ...input.audit,
    diff: { ...(input.audit.diff ?? {}), ...extraAuditDiff({ url: previous.url ?? null, path: previousPath }) },
  })
  if (auditResult.error) {
    const restoreError = await writeHeroConfig(ports.db, variant, previous.url ?? null, previous.type ?? null)
    const rolledBack = await staged?.rollback()
    await cleanupNew()
    let error = AUDIT_FAILED
    if (restoreError) error += ` Restoring the previous hero setting also failed: ${restoreError}.`
    if (rolledBack === false) error += ' Restoring the previous media also failed.'
    return { success: false, error, wrote: true }
  }

  const committed = await staged?.commit()
  const out: HeroResult<T> = { success: true, data: successData, wrote: true }
  if (committed === false) out.mediaCleanupFailed = true
  return out
}

export async function saveHeroVideoCore(
  ports: HeroVideoPorts,
  deps: Deps,
  input: { path: unknown; variant: unknown }
): Promise<HeroResult<string>> {
  const v = parseHeroVariant(input.variant)
  if (!v.ok) return { success: false, error: v.error, wrote: false }
  const variant = v.value
  const path = input.path
  if (typeof path !== 'string' || !isHeroVideoUploadPath(path, variant)) {
    return { success: false, error: 'Invalid upload path', wrote: false }
  }

  const verified = await verifyUploadedVideoSize(ports.storage, path)
  if (!verified.ok) return { success: false, error: verified.error, wrote: false }

  const { data: blob, error: downloadError } = await ports.storage.download(path)
  if (downloadError || !blob) {
    return { success: false, error: downloadError?.message ?? 'Could not verify uploaded video', wrote: false }
  }

  const removeNew = async (message: string) => {
    const { error } = await ports.storage.remove([path])
    return error ? `${message}; The uploaded file could not be removed.` : message
  }

  if (blob.size > HERO_VIDEO_MAX_BYTES) {
    return { success: false, error: await removeNew(HERO_VIDEO_TOO_LARGE), wrote: false }
  }
  if (!ports.hasAudioTrack(new Uint8Array(await blob.arrayBuffer()))) {
    return {
      success: false,
      error: await removeNew(
        'This MP4 has no audio track. Re-export with audio enabled (AAC) and upload again.'
      ),
      wrote: false,
    }
  }

  await ports.media.mirrorUpload(path, blob)
  const publicUrl = `${ports.storage.publicUrl(path)}?v=${ports.now()}`
  const sizeMB = Math.round((blob.size / (1024 * 1024)) * 100) / 100

  return applyHeroChange(
    ports,
    deps,
    {
      variant,
      newUrl: publicUrl,
      newType: 'mp4',
      newPath: path,
      audit: {
        adminUserId: deps.adminUserId,
        action: 'upload',
        entity: 'storage',
        diff: { slot: `hero_${variant}`, path, sizeMB },
      },
      configFailureMessage: (_ok, error) => error,
    },
    publicUrl,
    (previous) => ({ previous_path: previous.path })
  )
}

export async function setHeroVideoUrlCore(
  ports: HeroVideoPorts,
  deps: Deps,
  input: { canonicalUrl: string; variant: unknown }
): Promise<HeroResult> {
  const v = parseHeroVariant(input.variant)
  if (!v.ok) return { success: false, error: v.error, wrote: false }
  const variant = v.value
  return applyHeroChange(
    ports,
    deps,
    {
      variant,
      newUrl: input.canonicalUrl,
      newType: 'youtube',
      newPath: null,
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
  return applyHeroChange(
    ports,
    deps,
    {
      variant,
      newUrl: null,
      newType: null,
      newPath: null,
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
