// Preloader and per-show hero video upload cores: server-verified size (storage info(),
// then the downloaded blob), a pending audit row before any write, a terminal row with
// the same attempt_id after. The preloader also swaps app_config.preloader_video_url and
// stages the previous file's deletion until the config write has landed.
// No next/*, server-only or '@/' imports: node --test loads this file.
import {
  compensationAuditDiff,
  newAttemptId,
  pendingAuditDiff,
  runWithCompensation,
  type WriteStep,
} from './compensation.ts'
import {
  PRELOADER_VIDEO_LIMIT,
  SHOW_VIDEO_LIMIT,
  verifyUploadedVideoSize,
  type VideoSizeLimit,
} from './media-guards.ts'
import type { AdminDb, AuditWriter, CoreResult } from './ports'

type StagedDeletion = { commit(): Promise<boolean>; rollback(): Promise<boolean> }

export type VideoUploadPorts = {
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
  storagePathFromUrl(url: string | null): string | null
  now(): number
}

type Deps = { audit: AuditWriter; adminUserId: string }
type UploadResult<T> = CoreResult<T> & { mediaCleanupFailed?: boolean }

const AUDIT_PENDING_FAILED = 'Could not write the audit record; the video was not saved.'

export function isPreloaderVideoUploadPath(path: unknown): path is string {
  return typeof path === 'string' && /^preloader\/video-\d+\.mp4$/.test(path)
}

const SHOW_VIDEO_PATH =
  /^shows\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/hero-(desktop|mobile)-\d+\.mp4$/i

export function parseShowVideoUploadPath(
  path: unknown
): { showId: string; variant: 'desktop' | 'mobile' } | null {
  if (typeof path !== 'string') return null
  const m = SHOW_VIDEO_PATH.exec(path)
  if (!m) return null
  return { showId: m[1]!.toLowerCase(), variant: m[2]!.toLowerCase() as 'desktop' | 'mobile' }
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

async function writeAudit(deps: Deps, entry: Omit<Parameters<AuditWriter>[0], 'adminUserId'>) {
  try {
    return await deps.audit({ adminUserId: deps.adminUserId, ...entry })
  } catch (e) {
    return { error: errText(e) }
  }
}

/** info() size, download, blob size. Oversize files are removed from storage. */
async function verifyUploadedVideo(
  ports: VideoUploadPorts,
  path: string,
  limit: VideoSizeLimit
): Promise<{ ok: true; blob: Blob } | { ok: false; error: string }> {
  const verified = await verifyUploadedVideoSize(ports.storage, path, limit)
  if (!verified.ok) return verified
  const { data: blob, error } = await ports.storage.download(path)
  if (error || !blob) return { ok: false, error: error?.message ?? 'Could not verify uploaded video' }
  if (blob.size > limit.maxBytes) {
    const { error: rmErr } = await ports.storage.remove([path])
    return {
      ok: false,
      error: rmErr ? `${limit.tooLarge}; The uploaded file could not be removed.` : limit.tooLarge,
    }
  }
  return { ok: true, blob }
}

const sizeMBOf = (blob: Blob) => Math.round((blob.size / (1024 * 1024)) * 100) / 100

type AuditedUploadInput = {
  context: Record<string, unknown>
  steps: WriteStep[]
  /** Runs only after every step succeeded, before the terminal row; its result goes into the terminal row. */
  afterCommit?: () => Promise<Record<string, unknown>>
}

/** pending row -> steps (reverse undo on failure) -> terminal row, same attempt_id. */
async function runAuditedUpload(
  deps: Deps,
  input: AuditedUploadInput
): Promise<{ ok: boolean; wrote: boolean; error?: string; extra?: Record<string, unknown> }> {
  const attemptId = newAttemptId()
  const base = { action: 'upload' as const, entity: 'storage' as const, entityId: null }

  const pending = await writeAudit(deps, { ...base, diff: pendingAuditDiff(input.context, attemptId) })
  if (pending.error) return { ok: false, wrote: false, error: AUDIT_PENDING_FAILED }

  const result = await runWithCompensation(input.steps)
  const extra = result.ok && input.afterCommit ? await input.afterCommit() : {}

  const terminal = await writeAudit(deps, {
    ...base,
    diff: { ...compensationAuditDiff(result, input.context, attemptId), ...extra },
  })

  if (!result.ok) {
    const left = result.leftInPlace.map((l) => l.step).join(', ')
    let error = left ? `${result.error} (could not undo: ${left})` : result.error
    if (terminal.error) error += ` (the closing audit row also failed; attempt ${attemptId})`
    return { ok: false, wrote: result.wrote, error }
  }
  if (terminal.error) {
    return {
      ok: false,
      wrote: true,
      extra,
      error: `The video was saved, but the closing audit row could not be written. The pending audit row remains (attempt_id ${attemptId}).`,
    }
  }
  return { ok: true, wrote: true, extra }
}

export async function savePreloaderVideoCore(
  ports: VideoUploadPorts,
  deps: Deps,
  input: { path: unknown }
): Promise<UploadResult<string>> {
  const path = input.path
  if (!isPreloaderVideoUploadPath(path)) return { success: false, error: 'Invalid upload path', wrote: false }

  const checked = await verifyUploadedVideo(ports, path, PRELOADER_VIDEO_LIMIT)
  if (!checked.ok) return { success: false, error: checked.error, wrote: false }

  const { data: config, error: configError } = await ports.db
    .from('app_config')
    .select('preloader_video_url')
    .eq('id', 1)
    .single()
  if (configError || !config) {
    return { success: false, error: configError?.message ?? 'Could not load site config', wrote: false }
  }
  const previousUrl = (config as unknown as { preloader_video_url: string | null }).preloader_video_url ?? null
  const previousPath = ports.storagePathFromUrl(previousUrl)
  const publicUrl = `${ports.storage.publicUrl(path)}?v=${ports.now()}`
  let staged: StagedDeletion | null = null

  const writeUrl = async (url: string | null) => {
    const { error } = await ports.db
      .from('app_config')
      .update({ preloader_video_url: url } as never)
      .eq('id', 1)
    return { error: error ? error.message : null }
  }

  const res = await runAuditedUpload(deps, {
    context: { slot: 'preloader', path, sizeMB: sizeMBOf(checked.blob), previous_path: previousPath },
    steps: [
      {
        name: 'mirror_upload',
        run: async () => {
          await ports.media.mirrorUpload(path, checked.blob)
          return { error: null }
        },
        undo: async () => {
          await ports.media.cleanup([path])
          return { error: null }
        },
      },
      {
        name: 'stage_previous_deletion',
        run: async () => {
          if (previousPath && previousPath !== path) staged = await ports.media.stageDeletion([previousPath])
          return { error: null }
        },
        undo: async () => {
          const s = staged as StagedDeletion | null
          if (s && (await s.rollback()) === false) return { error: 'Restoring the previous media failed' }
          return { error: null }
        },
      },
      { name: 'write_config', run: () => writeUrl(publicUrl), undo: () => writeUrl(previousUrl) },
    ],
    afterCommit: async () => {
      const s = staged as StagedDeletion | null
      if (!s) return {}
      return (await s.commit()) ? {} : { media_cleanup_failed: true }
    },
  })

  if (!res.ok) return { success: false, error: res.error, wrote: res.wrote }
  const out: UploadResult<string> = { success: true, data: publicUrl, wrote: true }
  if (res.extra?.media_cleanup_failed) out.mediaCleanupFailed = true
  return out
}

/** Per-show hero video: verified and mirrored here; the URL is saved with the show form. */
export async function saveShowVideoUploadCore(
  ports: VideoUploadPorts,
  deps: Deps,
  input: { path: unknown }
): Promise<UploadResult<string>> {
  const parsed = parseShowVideoUploadPath(input.path)
  if (!parsed) return { success: false, error: 'Invalid upload path', wrote: false }
  const path = input.path as string

  const checked = await verifyUploadedVideo(ports, path, SHOW_VIDEO_LIMIT)
  if (!checked.ok) return { success: false, error: checked.error, wrote: false }

  const res = await runAuditedUpload(deps, {
    context: {
      slot: `show_hero_${parsed.variant}`,
      show_id: parsed.showId,
      path,
      sizeMB: sizeMBOf(checked.blob),
    },
    steps: [
      {
        name: 'mirror_upload',
        run: async () => {
          await ports.media.mirrorUpload(path, checked.blob)
          return { error: null }
        },
        undo: async () => {
          await ports.media.cleanup([path])
          return { error: null }
        },
      },
    ],
  })

  if (!res.ok) return { success: false, error: res.error, wrote: res.wrote }
  return { success: true, data: ports.storage.publicUrl(path), wrote: true }
}
