// R2-only media deletion for the admin actions (plan 02-19). Replaces the old
// Supabase-remove-plus-R2-mirror helpers (src/lib/r2-media*.ts, deleted): those removed the
// Supabase Storage original, which MEDIA-07 forbids until Koss approves emptying Supabase.
// Everything here deletes keys behind our own media origin and nothing else, by key, through
// the app Worker's MEDIA binding. Pure: no '@/' or server-only imports (node --test loads it).
import { r2KeysForUrl } from './r2-keys.ts'
import { VARIANT_WIDTHS } from './upload-kinds.ts'

export type DeletableBucket = { delete(keys: string | string[]): Promise<void> }

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

export async function deleteKeys(bucket: DeletableBucket, keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += DELETE_BATCH) {
    await bucket.delete(keys.slice(i, i + DELETE_BATCH))
  }
}

/** Stage deleting `keys` (variants are added). Nothing happens until commit. */
export function stageR2Deletion(bucket: DeletableBucket, keys: string[]): StagedR2Deletion {
  const doomed = withVariantKeys(keys)
  return {
    commit: async () => {
      if (doomed.length === 0) return true
      try {
        await deleteKeys(bucket, doomed)
        return true
      } catch (err) {
        console.error('[r2-delete] delete failed', err)
        return false
      }
    },
    rollback: async () => true,
  }
}

/** Stage deleting the R2 objects behind a stored url. Foreign and Supabase urls: no-op. */
export function stageR2DeletionForUrl(
  bucket: DeletableBucket,
  url: string | null | undefined,
  mediaOrigin: string | null
): StagedR2Deletion | null {
  const keys = r2KeysForUrl(url, mediaOrigin)
  return keys.length === 0 ? null : stageR2Deletion(bucket, [keys[0]!])
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

/** Best-effort delete of the R2 objects behind a url; logs and returns false on failure. */
export async function deleteMediaForUrl(
  bucket: DeletableBucket,
  url: string | null | undefined,
  mediaOrigin: string | null,
  label: string
): Promise<boolean> {
  const staged = stageR2DeletionForUrl(bucket, url, mediaOrigin)
  if (!staged) return true
  const ok = await staged.commit()
  if (!ok) console.error(`${label} media cleanup failed`)
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
  buckets: readonly string[] = ['show-artwork', 'site-assets']
): Promise<StagedR2Deletion[]> {
  // The id becomes part of a list prefix: refuse anything that is not a plain id.
  if (!/^[A-Za-z0-9-]{8,64}$/.test(showId)) throw new Error('Invalid show id')
  const staged: StagedR2Deletion[] = []
  for (const name of buckets) {
    // Originals only: variants live under _v/ and are added (and deleted) by key, and
    // deleting a variant that was never made is a no-op.
    const keys = await listKeys(bucket, `${name}/shows/${showId}/`)
    if (keys.length > 0) staged.push(stageR2Deletion(bucket, keys))
  }
  return staged
}
