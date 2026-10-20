// Preloader and per-show video uploads: server-verified size (storage info() and the
// downloaded blob), then a pending audit row, the writes, and one terminal row.
// No next/*, server-only or '@/' imports: node --test loads this file.
import { verifyUploadedVideoSize, type VideoSizeLimit } from './media-guards.ts'
import { runAuditedDelete, type WriteStep } from './compensation.ts'
import type { HeroVideoPorts } from './hero-video.ts'
import type { AuditWriter, CoreResult } from './ports'

export const PRELOADER_VIDEO_LIMIT: VideoSizeLimit = {
  maxBytes: 20 * 1024 * 1024,
  tooLarge: 'Video must be under 20MB',
}
export const SHOW_VIDEO_LIMIT: VideoSizeLimit = {
  maxBytes: 50 * 1024 * 1024,
  tooLarge: 'Video must be under 50MB',
}

const SHOW_VIDEO_PATH =
  /^shows\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/hero-(desktop|mobile)-\d+\.mp4$/i

export function isPreloaderVideoUploadPath(path: unknown): path is string {
  return typeof path === 'string' && /^preloader\/video-\d+\.mp4$/.test(path)
}

export function parseShowVideoUploadPath(
  path: unknown
): { showId: string; variant: 'desktop' | 'mobile' } | null {
  if (typeof path !== 'string') return null
  const m = SHOW_VIDEO_PATH.exec(path)
  if (!m) return null
  return { showId: m[1]!.toLowerCase(), variant: m[2]!.toLowerCase() as 'desktop' | 'mobile' }
}

export type VideoUploadPorts = Pick<HeroVideoPorts, 'db' | 'storage' | 'storagePathFromUrl' | 'now'> & {
  media: Pick<HeroVideoPorts['media'], 'mirrorUpload' | 'cleanup'>
}

type Deps = { audit: AuditWriter; adminUserId: string }
type UploadResult<T = unknown> = CoreResult<T>

const LIVE_PATH = 'This file is already the live video; upload a new file instead.'

const MESSAGES = {
  pendingFailed: 'Could not write the audit record; the video was not saved.',
  terminalFailed: (attemptId: string) =>
    `The video was saved, but the closing audit row could not be written. The pending audit row remains (attempt_id ${attemptId}).`,
}

/** Size proof from storage info() and the downloaded blob; the oversize file is removed. */
async function verifiedBlob(
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

function mirrorStep(ports: VideoUploadPorts, path: string, blob: Blob): WriteStep {
  return {
    name: 'mirror-upload',
    run: async () => {
      await ports.media.mirrorUpload(path, blob)
      return { error: null }
    },
    undo: async () => {
      await ports.media.cleanup([path])
      return { error: null }
    },
  }
}

export async function savePreloaderVideoCore(
  ports: VideoUploadPorts,
  deps: Deps,
  input: { path: unknown }
): Promise<UploadResult<string>> {
  const path = input.path
  if (!isPreloaderVideoUploadPath(path)) return { success: false, error: 'Invalid upload path', wrote: false }

  // Read the live value first: nothing below may remove or clean up the live file.
  const { data, error } = await ports.db.from('app_config').select('preloader_video_url').eq('id', 1).single()
  if (error || !data) return { success: false, error: error?.message ?? 'Could not load site config', wrote: false }
  const previousUrl = (data as unknown as { preloader_video_url: string | null }).preloader_video_url ?? null
  const previousPath = ports.storagePathFromUrl(previousUrl)
  if (previousPath === path) return { success: false, error: LIVE_PATH, wrote: false }

  const checked = await verifiedBlob(ports, path, PRELOADER_VIDEO_LIMIT)
  if (!checked.ok) return { success: false, error: checked.error, wrote: false }
  const blob = checked.blob
  const publicUrl = `${ports.storage.publicUrl(path)}?v=${ports.now()}`

  const writeUrl = (url: string | null) => async () => {
    const { error: e } = await ports.db
      .from('app_config')
      .update({ preloader_video_url: url } as never)
      .eq('id', 1)
    return { error: e ? e.message : null }
  }

  const res = await runAuditedDelete({
    audit: deps.audit,
    adminUserId: deps.adminUserId,
    action: 'upload',
    entity: 'storage',
    entityId: null,
    context: { slot: 'preloader', path, sizeMB: sizeMBOf(blob), previous_path: previousPath },
    steps: [
      mirrorStep(ports, path, blob),
      { name: 'write-config', run: writeUrl(publicUrl), undo: writeUrl(previousUrl) },
    ],
    messages: MESSAGES,
  })

  // cleanup logs its own failure and never throws; a leftover file is swept later.
  const cleanupPrevious = async () => {
    if (previousPath && previousPath !== path) await ports.media.cleanup([previousPath])
  }
  if (!res.ok) {
    // The new file is live when every step ran and only the closing audit row failed.
    if (res.committed) {
      await cleanupPrevious()
      return { success: false, error: res.error, wrote: true }
    }
    // wrote=false only when the pending row failed: nothing ran, so drop the upload.
    // A failed mirror removes its own source; a failed config write undoes the mirror.
    if (!res.wrote) await ports.storage.remove([path])
    return { success: false, error: res.error, wrote: res.wrote }
  }

  await cleanupPrevious()
  return { success: true, data: publicUrl, wrote: true }
}

/** The URL is persisted when the show form is saved; this proves size and audits the upload. */
export async function saveShowVideoCore(
  ports: VideoUploadPorts,
  deps: Deps,
  input: { path: unknown }
): Promise<UploadResult<string>> {
  const parsed = parseShowVideoUploadPath(input.path)
  if (!parsed) return { success: false, error: 'Invalid upload path', wrote: false }
  const path = input.path as string

  // Never touch a file the show already serves (a re-sent live path would be removed on failure).
  const show = await ports.db
    .from('shows')
    .select('hero_video_url, hero_video_mobile_url')
    .eq('id', parsed.showId)
    .maybeSingle()
  if (show.error) return { success: false, error: show.error.message, wrote: false }
  if (!show.data) return { success: false, error: 'Show not found.', wrote: false }
  const row = show.data as unknown as { hero_video_url: string | null; hero_video_mobile_url: string | null }
  const livePaths = [row.hero_video_url, row.hero_video_mobile_url].map((u) => ports.storagePathFromUrl(u ?? null))
  if (livePaths.includes(path)) return { success: false, error: LIVE_PATH, wrote: false }

  const checked = await verifiedBlob(ports, path, SHOW_VIDEO_LIMIT)
  if (!checked.ok) return { success: false, error: checked.error, wrote: false }
  const blob = checked.blob

  const res = await runAuditedDelete({
    audit: deps.audit,
    adminUserId: deps.adminUserId,
    action: 'upload',
    entity: 'storage',
    entityId: parsed.showId,
    context: { slot: `show_hero_${parsed.variant}`, show_id: parsed.showId, path, sizeMB: sizeMBOf(blob) },
    steps: [mirrorStep(ports, path, blob)],
    messages: MESSAGES,
  })
  if (!res.ok) {
    if (!res.wrote) await ports.storage.remove([path])
    return { success: false, error: res.error, wrote: res.wrote }
  }
  return { success: true, data: ports.storage.publicUrl(path), wrote: true }
}
