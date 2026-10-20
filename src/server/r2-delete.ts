// R2-only media deletion for the admin actions (plan 02-19). Replaces the old
// Supabase-remove-plus-R2-mirror helpers (src/lib/r2-media*.ts, deleted): those removed the
// Supabase Storage original, which MEDIA-07 forbids until Koss approves emptying Supabase.
// Everything here deletes keys behind our own media origin and nothing else, by key, through
// the app Worker's MEDIA binding. Pure: no '@/' or server-only imports (node --test loads it).
//
// Deferred items 21-23: every delete of a key that was ever live goes through
// deleteIfUnreferenced, which re-reads every reference (src/server/media-references.ts)
// right before deleting and keeps any key still used anywhere. Every exported helper
// below takes that guard as a required argument.
import { findLiveReferences, type ReferenceSource } from './media-references.ts'
import { r2KeysForUrl } from './r2-keys.ts'
import { VARIANT_WIDTHS } from './upload-kinds.ts'

export type DeletableBucket = { delete(keys: string | string[]): Promise<void> }

/** What a delete needs to prove a key is no longer live. */
export type MediaDeleteGuard = {
  /** Read every live media url now (service client: every row of every table). */
  readReferences: ReferenceSource
  /** Our media origin, so urls on it map back to keys. */
  mediaOrigin: string | null
  /** Log prefix, e.g. '[removeSiteImage]'. */
  label: string
}

export type GuardedDeleteResult = {
  /** false when the reference read or the R2 delete failed (nothing, or not all, was removed). */
  ok: boolean
  deleted: string[]
  kept: string[]
  error: string | null
}

export type ListableBucket = DeletableBucket & {
  list(options: {
    prefix: string
    cursor?: string
    limit?: number
  }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>
}

/** A deletion that is decided now and carried out at commit. Nothing is removed before. */
export type StagedR2Deletion = {
  commit(): Promise<boolean>
  /** Nothing was deleted before commit, so there is nothing to restore. */
  rollback(): Promise<boolean>
}

const DELETE_BATCH = 500 // R2 accepts at most 1000 keys per delete call
const LIST_PAGE = 1000
const MAX_LIST_PAGES = 50

/** Original keys plus every variant the browser or the copy script may have made. */
export function withVariantKeys(keys: string[]): string[] {
  const out = new Set<string>()
  for (const key of keys) {
    out.add(key)
    for (const w of VARIANT_WIDTHS) {
      out.add(`_v/${w}/webp/${key}`)
      out.add(`_v/${w}/avif/${key}`)
    }
  }
  return [...out]
}

async function deleteKeys(bucket: { delete(keys: string[]): Promise<void> }, keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += DELETE_BATCH) {
    await bucket.delete(keys.slice(i, i + DELETE_BATCH))
  }
}

/**
 * THE delete for any key that was ever live: re-reads every reference right now and
 * deletes only the keys whose original no live value uses. A failed read deletes nothing
 * (an orphan is acceptable, a broken image is not). Exactly the given keys are considered;
 * callers add variants.
 */
export async function deleteIfUnreferenced(
  bucket: { delete(keys: string[]): Promise<void> },
  keys: readonly string[],
  guard: MediaDeleteGuard
): Promise<GuardedDeleteResult> {
  const unique = [...new Set(keys)]
  if (unique.length === 0) return { ok: true, deleted: [], kept: [], error: null }
  const refs = await findLiveReferences(unique, guard.readReferences, guard.mediaOrigin)
  if (refs.error !== null) {
    console.error(`${guard.label} media reference read failed; nothing deleted`, refs.error)
    return { ok: false, deleted: [], kept: unique, error: refs.error }
  }
  const live = new Set(refs.live)
  const kept = unique.filter((k) => live.has(k))
  const doomed = unique.filter((k) => !live.has(k))
  if (kept.length > 0) console.warn(`${guard.label} kept ${kept.length} media key(s) still in use`)
  if (doomed.length === 0) return { ok: true, deleted: [], kept, error: null }
  try {
    await deleteKeys(bucket, doomed)
    return { ok: true, deleted: doomed, kept, error: null }
  } catch (err) {
    console.error(`${guard.label} R2 delete failed`, err)
    return { ok: false, deleted: [], kept, error: err instanceof Error ? err.message : 'R2 delete failed' }
  }
}

/** Stage deleting `keys` (variants are added). Nothing happens until commit; commit re-checks every reference. */
export function stageR2Deletion(bucket: DeletableBucket, keys: string[], guard: MediaDeleteGuard): StagedR2Deletion {
  const doomed = withVariantKeys(keys)
  return {
    commit: async () => (await deleteIfUnreferenced(bucket, doomed, guard)).ok,
    rollback: async () => true,
  }
}

/** Stage deleting the R2 objects behind a stored url. Foreign and Supabase urls: no-op. */
export function stageR2DeletionForUrl(
  bucket: DeletableBucket,
  url: string | null | undefined,
  guard: MediaDeleteGuard
): StagedR2Deletion | null {
  const keys = r2KeysForUrl(url, guard.mediaOrigin)
  return keys.length === 0 ? null : stageR2Deletion(bucket, [keys[0]!], guard)
}

/** Every key under `prefix`, paginated. Throws if the listing cannot finish. */
export async function listKeys(bucket: ListableBucket, prefix: string): Promise<string[]> {
  const keys: string[] = []
  let cursor: string | undefined
  for (let page = 0; page < MAX_LIST_PAGES; page++) {
    const r = await bucket.list({ prefix, cursor, limit: LIST_PAGE })
    for (const o of r.objects) keys.push(o.key)
    if (!r.truncated) return keys
    cursor = r.cursor
    if (!cursor) throw new Error('R2 list returned a truncated page without a cursor')
  }
  throw new Error('R2 list did not finish')
}

/** Delete the R2 objects behind a url unless still referenced; false when the read or delete failed. */
export async function deleteMediaForUrl(
  bucket: DeletableBucket,
  url: string | null | undefined,
  guard: MediaDeleteGuard
): Promise<boolean> {
  const staged = stageR2DeletionForUrl(bucket, url, guard)
  if (!staged) return true
  const ok = await staged.commit()
  if (!ok) console.error(`${guard.label} media cleanup failed`)
  return ok
}

/**
 * Stage deleting everything under `<bucket>/shows/<showId>/` for the given buckets
 * (artwork, logos, cast portraits and hero videos live there). Listing happens now, so a
 * listing failure aborts the show delete before any row is touched.
 */
export async function stageShowMedia(
  bucket: ListableBucket,
  showId: string,
  guard: MediaDeleteGuard,
  buckets: readonly string[] = ['show-artwork', 'site-assets']
): Promise<StagedR2Deletion[]> {
  // The id becomes part of a list prefix: refuse anything that is not a plain id.
  if (!/^[A-Za-z0-9-]{8,64}$/.test(showId)) throw new Error('Invalid show id')
  const staged: StagedR2Deletion[] = []
  for (const name of buckets) {
    // Originals only: variants live under _v/ and are added (and deleted) by key, and
    // deleting a variant that was never made is a no-op.
    const keys = await listKeys(bucket, `${name}/shows/${showId}/`)
    // Committed after the show row is gone: a file another show or the site still uses stays.
    if (keys.length > 0) staged.push(stageR2Deletion(bucket, keys, guard))
  }
  return staged
}
