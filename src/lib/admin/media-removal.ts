// Remove/clear core for media the admin takes off the site (deferred items 21-23):
// removeSiteImage and removePreloaderVideo clear one app_config column, deleteCastMember
// deletes one show_cast row. The write is compare-and-swap on the value read just before
// (a save that landed meanwhile wins: MEDIA_SAVE_CONFLICT, nothing deleted), and the R2
// object goes only if no live value in any scope still uses it (deleteMediaForUrl re-reads
// every reference). R2 only: a Supabase Storage original is never deleted (MEDIA-07).
// No next/*, server-only or '@/' imports: node --test loads this file.
import { MEDIA_SAVE_CONFLICT, readMediaReferenceUrls, type ReferenceDb } from '../../server/media-references.ts'
import { deleteMediaForUrl, type DeletableBucket } from '../../server/r2-delete.ts'
import type { AdminDb, CoreResult } from './ports'

export type MediaRemovalTarget =
  | {
      /** Set the column to null on the one app_config row. */
      kind: 'clear-column'
      table: 'app_config'
      id: number
      column: string
      notFound: string
    }
  | {
      /** Delete the whole row (a cast member and its portrait). */
      kind: 'delete-row'
      table: 'show_cast'
      id: string
      column: 'image_url'
      notFound: string
    }

export type MediaRemovalPorts = {
  /** Service client: the reference read must see every row. */
  db: AdminDb
  media: DeletableBucket
  mediaOrigin: string | null
}

export type MediaRemovalResult = CoreResult & { mediaCleanupFailed?: boolean }

export async function removeMediaCore(
  ports: MediaRemovalPorts,
  target: MediaRemovalTarget,
  label: string
): Promise<MediaRemovalResult> {
  // Dynamic column names (some newer than database.types): typed as one known column.
  const column = target.column as 'image_url'
  const table = target.table as 'show_cast'
  const id = target.id as string

  const { data, error: readError } = await ports.db.from(table).select(column).eq('id', id).maybeSingle()
  if (readError) return { success: false, error: readError.message, wrote: false }
  if (!data) return { success: false, error: target.notFound, wrote: false }
  const previous = ((data as Record<string, unknown>)[column] as string | null | undefined) ?? null

  const base =
    target.kind === 'clear-column'
      ? ports.db
          .from(table)
          .update({ [column]: null } as never)
          .eq('id', id)
      : ports.db.from(table).delete().eq('id', id)
  const { data: rows, error: writeError } = await (previous === null
    ? base.is(column, null)
    : base.eq(column, previous)
  ).select('id')
  if (writeError) return { success: false, error: writeError.message, wrote: false }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, error: MEDIA_SAVE_CONFLICT, wrote: false }
  }

  const cleaned = await deleteMediaForUrl(ports.media, previous, {
    readReferences: () => readMediaReferenceUrls(ports.db as unknown as ReferenceDb),
    mediaOrigin: ports.mediaOrigin,
    label,
  })
  const out: MediaRemovalResult = { success: true, wrote: true }
  if (!cleaned) out.mediaCleanupFailed = true
  return out
}
