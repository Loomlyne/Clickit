// Weekly sweep of direct-to-R2 uploads that were never finalised (Koss, Option B).
// Run by the cleanup-media cron (src/app/api/cron/cleanup-media/route.ts) after the
// rate_limits prune. Pure: no '@/' or server-only imports (node --test loads it).
//
// A candidate is an ORIGINAL key that:
//   - has exactly the shape mintUploadKey produces for some upload kind
//     (`<ts>-<8 hex>` stamp). The 86 objects copied from Supabase were written by the
//     old upload code as `-${Date.now()}` with no random part, so they never match;
//   - is older than 24 h twice over: every listed object for it (original and variants)
//     was uploaded more than 24 h ago, and the mint time in the key is too;
//   - has no live reference anywhere (findLiveReferences: a failed read keeps everything).
//
// Variants: `_v/<640|1280|1920>/<webp|avif>/<key>` are never candidates on their own.
// A variant whose <key> is a minted original counts toward that original (its age too),
// and the original is swept with every variant key (withVariantKeys), whether or not the
// original object itself still exists. Variants of copied Supabase objects are ignored.
//
// Dry run unless R2_UPLOAD_SWEEP_DELETE is exactly "on" (Koss's word flips it; the deploy
// guard refuses "on" without --allow-upload-sweep-delete). Deletes go through
// deleteIfUnreferenced, which reads every reference again right before deleting.
// Nothing here throws: the cron reports the result and carries on.
import { findLiveReferences } from './media-references.ts'
import { deleteIfUnreferenced, withVariantKeys, type MediaDeleteGuard } from './r2-delete.ts'
import { UPLOAD_KINDS, VARIANT_WIDTHS, keyMatchesKind, type UploadKind } from './upload-kinds.ts'

export const UPLOAD_SWEEP_MIN_AGE_MS = 24 * 60 * 60 * 1000
/** Keys examined per run at most (originals and variants together). */
export const UPLOAD_SWEEP_MAX_KEYS = 5000
/** The wrangler var that switches real deletes on. */
export const UPLOAD_SWEEP_FLAG = 'R2_UPLOAD_SWEEP_DELETE'

const LIST_PAGE = 1000

/** The slice of an R2 binding the sweep uses. */
export type SweepBucket = {
  list(options: {
    cursor?: string
    limit?: number
  }): Promise<{ objects: Array<{ key: string; uploaded: Date | string }>; truncated: boolean; cursor?: string }>
  delete(keys: string | string[]): Promise<void>
}

export type UploadSweepResult = {
  mode: 'dry-run' | 'delete'
  /** Objects listed (originals and variants). */
  examined: number
  /** True when the cap stopped the listing before the end of the bucket. */
  truncated: boolean
  /** Distinct minted originals seen (directly or through a variant). */
  minted: number
  /** Of those, older than 24 h. */
  aged: number
  /** Of those, still referenced (kept). */
  referenced: number
  /** Unreferenced aged originals: what a delete run removes (with their variants). */
  candidates: number
  candidateKeys: string[]
  /** Originals actually deleted (0 in a dry run). */
  deleted: number
  deletedKeys: string[]
  error: string | null
}

/** Real deletes only for exactly "on". */
export function uploadSweepDeleteEnabled(value: unknown): boolean {
  return value === 'on'
}

const KINDS = Object.keys(UPLOAD_KINDS) as UploadKind[]
const VARIANT_RE = new RegExp(`^_v/(?:${VARIANT_WIDTHS.join('|')})/(?:webp|avif)/(.+)$`)
const MINT_TIME_RE = /[-/]([0-9]{10,16})-[0-9a-f]{8}\.[a-z0-9]+$/

function isMintedOriginal(key: string): boolean {
  return KINDS.some((kind) =>
    keyMatchesKind(kind, key, kind === 'avatar' ? { userId: key.split('/')[1] ?? '' } : {})
  )
}

/** The minted original a key is (or is a variant of); null for anything else. */
export function mintedOriginalOf(key: string): string | null {
  if (typeof key !== 'string' || key === '') return null
  const original = VARIANT_RE.exec(key)?.[1] ?? key
  return isMintedOriginal(original) ? original : null
}

function uploadedMs(value: unknown): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') return Date.parse(value)
  return Number.NaN
}

function emptyResult(mode: UploadSweepResult['mode'], error: string | null): UploadSweepResult {
  return {
    mode,
    examined: 0,
    truncated: false,
    minted: 0,
    aged: 0,
    referenced: 0,
    candidates: 0,
    candidateKeys: [],
    deleted: 0,
    deletedKeys: [],
    error,
  }
}

export async function sweepUnfinalisedUploads(deps: {
  bucket: SweepBucket
  guard: MediaDeleteGuard
  deleteEnabled: boolean
  nowMs: number
  maxKeys?: number
}): Promise<UploadSweepResult> {
  const mode = deps.deleteEnabled ? 'delete' : 'dry-run'
  const maxKeys = deps.maxKeys ?? UPLOAD_SWEEP_MAX_KEYS
  const cutoff = deps.nowMs - UPLOAD_SWEEP_MIN_AGE_MS

  // 1. List, page by page, up to the cap. Any listing doubt: delete nothing.
  const seen = new Map<string, boolean>() // minted original -> every object for it is old
  let examined = 0
  let truncated = false
  try {
    let cursor: string | undefined
    for (;;) {
      const limit = Math.min(LIST_PAGE, maxKeys - examined)
      const page = await deps.bucket.list({ cursor, limit })
      for (const object of page.objects) {
        examined += 1
        const original = mintedOriginalOf(object?.key)
        if (!original) continue
        const t = uploadedMs(object.uploaded)
        const old = Number.isFinite(t) && t < cutoff
        seen.set(original, (seen.get(original) ?? true) && old)
      }
      if (!page.truncated) break
      if (!page.cursor) return { ...emptyResult(mode, 'R2 list returned a truncated page without a cursor'), examined }
      if (examined >= maxKeys) {
        truncated = true
        break
      }
      cursor = page.cursor
    }
  } catch {
    return { ...emptyResult(mode, 'R2 list failed'), examined }
  }

  const aged = [...seen]
    .filter(([key, old]) => {
      const minted = Number(MINT_TIME_RE.exec(key)?.[1])
      return old && Number.isFinite(minted) && minted < cutoff
    })
    .map(([key]) => key)
    .sort()
  const base = { ...emptyResult(mode, null), examined, truncated, minted: seen.size, aged: aged.length }

  // 2. Keep everything still referenced. A failed read keeps everything.
  if (aged.length === 0) return base
  const refs = await findLiveReferences(aged, deps.guard.readReferences, deps.guard.mediaOrigin)
  if (refs.error !== null) return { ...base, error: 'Could not read media references; nothing deleted' }
  const live = new Set(refs.live)
  const candidateKeys = aged.filter((key) => !live.has(key))
  const result = { ...base, referenced: live.size, candidates: candidateKeys.length, candidateKeys }
  if (!deps.deleteEnabled || candidateKeys.length === 0) return result

  // 3. Delete: originals plus every variant key, re-checked against every reference now.
  const done = await deleteIfUnreferenced(
    deps.bucket as { delete(keys: string[]): Promise<void> },
    withVariantKeys(candidateKeys),
    deps.guard
  )
  const deletedSet = new Set(done.deleted)
  const deletedKeys = candidateKeys.filter((key) => deletedSet.has(key))
  return {
    ...result,
    deleted: deletedKeys.length,
    deletedKeys,
    error: done.ok ? null : 'R2 upload sweep delete failed',
  }
}

/** Cron entry: reads the binding and the flag from the Worker env. Never throws. */
export async function runUploadSweep(deps: {
  getEnv: () => Promise<{ MEDIA?: unknown; R2_UPLOAD_SWEEP_DELETE?: string }>
  guard: MediaDeleteGuard
  nowMs: number
  maxKeys?: number
}): Promise<UploadSweepResult> {
  let env: { MEDIA?: unknown; R2_UPLOAD_SWEEP_DELETE?: string }
  try {
    env = await deps.getEnv()
  } catch {
    return emptyResult('dry-run', 'Worker env unavailable')
  }
  const deleteEnabled = uploadSweepDeleteEnabled(env?.R2_UPLOAD_SWEEP_DELETE)
  const mode = deleteEnabled ? 'delete' : 'dry-run'
  const bucket = env?.MEDIA as Partial<SweepBucket> | undefined
  if (!bucket || typeof bucket.list !== 'function' || typeof bucket.delete !== 'function') {
    return emptyResult(mode, 'MEDIA binding unavailable')
  }
  try {
    return await sweepUnfinalisedUploads({
      bucket: bucket as SweepBucket,
      guard: deps.guard,
      deleteEnabled,
      nowMs: deps.nowMs,
      maxKeys: deps.maxKeys,
    })
  } catch {
    return emptyResult(mode, 'R2 upload sweep failed')
  }
}
