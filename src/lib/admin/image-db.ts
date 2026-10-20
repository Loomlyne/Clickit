// Database side of the admin image finalize (plan 02-15): read and write exactly one
// column or row per target. No next/*, server-only or '@/' imports: node --test loads
// this file, and the tests record every write against the fake Supabase.
import { MEDIA_SAVE_CONFLICT } from '../../server/media-references.ts'
import { updatedAtOf, type RowVersion } from './row-version.ts'
import type { AdminDb } from './ports'
import type { ImageTarget, ImageUploadPorts, LiveScope } from './image-upload'

type LiveRead = { urls: Array<string | null>; error: string | null }

const pick = (row: unknown, columns: readonly string[]) =>
  columns.map((c) => (row as Record<string, string | null | undefined>)[c] ?? null)

/** Read-only: every url live in the scope (Phase 01.1 review guard before finalize). */
export async function readAdminLiveUrls(db: AdminDb, scope: LiveScope): Promise<LiveRead> {
  if (scope.type === 'show-artwork') {
    const { data, error } = await db
      .from('shows')
      .select(scope.columns.join(', '))
      .eq('id', scope.showId)
      .maybeSingle()
    if (error) return { urls: [], error: error.message }
    // A show that does not exist yet has nothing live.
    return { urls: data ? pick(data, scope.columns) : [], error: null }
  }
  if (scope.type === 'app-config') {
    const { data, error } = await db
      .from('app_config')
      .select(scope.columns.join(', '))
      .eq('id', 1)
      .single()
    if (error || !data) return { urls: [], error: error?.message ?? 'Could not load site config' }
    return { urls: pick(data, scope.columns), error: null }
  }
  if (scope.type === 'show-cast') {
    const { data, error } = await db.from('show_cast').select('image_url').eq('show_id', scope.showId)
    if (error || !data) return { urls: [], error: error?.message ?? 'Could not load cast' }
    return { urls: data.map((row) => row.image_url ?? null), error: null }
  }
  if (scope.type === 'social-icons') {
    const { data, error } = await db.from('app_config').select('footer_content').eq('id', 1).single()
    if (error || !data) return { urls: [], error: error?.message ?? 'Could not load site config' }
    const social = (data.footer_content as { social?: unknown } | null)?.social
    const urls = Array.isArray(social)
      ? social.flatMap((item) =>
          item && typeof item === 'object' && typeof (item as { iconUrl?: unknown }).iconUrl === 'string'
            ? [(item as { iconUrl: string }).iconUrl]
            : []
        )
      : []
    return { urls, error: null }
  }
  return { urls: [], error: 'Unsupported live scope' }
}

/**
 * Compare-and-swap write of one target (deferred item 23): the row is updated only while
 * the column still holds `expected`, the value read before. 0 rows means another save got
 * there first: MEDIA_SAVE_CONFLICT, and the caller must not delete anything that was live.
 * `version` (app_config only): the settings page's updated_at must also still match, and the
 * new one is written back into it, so the forms sharing the row keep one chain (residual b).
 */
export async function writeAdminImageTarget(
  db: AdminDb,
  target: ImageTarget,
  url: string | null,
  expected: string | null,
  version?: RowVersion
): Promise<string | null> {
  let result: { data: unknown[] | null; error: { message: string } | null }
  if (target.type === 'show-artwork') {
    const q = db
      .from('shows')
      .update({ [target.column]: url } as never)
      .eq('id', target.showId)
    const column = target.column as 'poster_url'
    result = await (expected === null ? q.is(column, null) : q.eq(column, expected)).select('id')
  } else if (target.type === 'app-config') {
    const row = db
      .from('app_config')
      .update({ [target.column]: url } as never)
      .eq('id', 1)
    const q = version ? row.eq('updated_at', version.expected) : row
    const column = target.column as 'og_image_url'
    result = await (expected === null ? q.is(column, null) : q.eq(column, expected)).select(
      version ? 'id, updated_at' : 'id'
    )
    if (version && !result.error && Array.isArray(result.data) && result.data.length > 0) {
      version.next = updatedAtOf(result.data)
    }
  } else if (target.type === 'cast') {
    const q = db
      .from('show_cast')
      .update({ image_url: url })
      .eq('id', target.castId)
      .eq('show_id', target.showId)
    result = await (expected === null ? q.is('image_url', null) : q.eq('image_url', expected)).select('id')
  } else {
    return 'Unsupported image target'
  }
  if (result.error) return result.error.message
  return Array.isArray(result.data) && result.data.length > 0 ? null : MEDIA_SAVE_CONFLICT
}

/**
 * Finalize core db port for the admin kinds (shows, app_config, show_cast). `version` is the
 * settings page's app_config updated_at: it applies to the write only, never to the
 * audit-failure restore (that one is a CAS on the value we wrote).
 */
export function adminImageDb(db: AdminDb, version?: RowVersion): ImageUploadPorts['db'] {
  return {
    readLive: (scope) => readAdminLiveUrls(db, scope),
    async readCurrent(target) {
      if (target.type === 'show-artwork') {
        const { data, error } = await db
          .from('shows')
          .select(target.column)
          .eq('id', target.showId)
          .single()
        if (error || !data) return { url: null, error: error?.message ?? 'Show not found' }
        return {
          url: (data as unknown as Record<string, string | null>)[target.column] ?? null,
          error: null,
        }
      }
      if (target.type === 'app-config') {
        const { data, error } = await db
          .from('app_config')
          .select(target.column)
          .eq('id', 1)
          .single()
        if (error || !data) return { url: null, error: error?.message ?? 'Could not load site config' }
        return {
          url: (data as unknown as Record<string, string | null>)[target.column] ?? null,
          error: null,
        }
      }
      if (target.type === 'cast') {
        const { data, error } = await db
          .from('show_cast')
          .select('image_url')
          .eq('id', target.castId)
          .eq('show_id', target.showId)
          .single()
        if (error || !data) return { url: null, error: error?.message ?? 'Cast member not found' }
        return { url: data.image_url ?? null, error: null }
      }
      return { url: null, error: 'Unsupported image target' }
    },
    write: (target, url, expected) => writeAdminImageTarget(db, target, url, expected, version),
    restore: (target, previous, expected) => writeAdminImageTarget(db, target, previous, expected),
  }
}
