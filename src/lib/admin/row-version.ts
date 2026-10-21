// Optimistic concurrency for admin form saves (deferred item 23, residual b). shows and
// app_config carry updated_at (NOT NULL; shorts.updated_at is nullable, see NULL_UPDATED_AT), set by the set_updated_at BEFORE UPDATE trigger
// (supabase/migrations/20260401000000_create_schema.sql). A form sends back the updated_at it
// was loaded with; the UPDATE only lands while the row still holds exactly that value, and
// returns the new one so the next save from the same page chains on it. 0 rows: someone saved
// in between, nothing is written and the admin gets the existing conflict line.
//
// The value is compared as the exact string PostgREST returned (e.g.
// 2026-10-20T16:43:24.123456+00:00); it is never turned into a Date, which would drop the
// microseconds and make every save conflict.
// No next/*, server-only or '@/' imports: node --test loads this file.
import { MEDIA_SAVE_CONFLICT } from '../../server/media-references.ts'
import { NULL_UPDATED_AT } from './version-chain.ts'
import type { AdminDb } from './ports'

export { NULL_UPDATED_AT }
import type { ParseResult } from './schemas'

/** The one conflict line (1d6ce5b); no new copy. */
export const SAVE_CONFLICT = MEDIA_SAVE_CONFLICT

/** Validation error for a missing or malformed updated_at; a correct client never sees it. */
export const INVALID_UPDATED_AT = 'Missing or invalid updated_at.'

// timestamptz as PostgREST writes it: date, T, time, up to 6 fraction digits, Z or +hh:mm.
const TIMESTAMPTZ =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/

export function parseUpdatedAt(value: unknown): ParseResult<string> {
  if (
    typeof value !== 'string' ||
    value.length > 40 ||
    !TIMESTAMPTZ.test(value)
  ) {
    return { ok: false, error: INVALID_UPDATED_AT }
  }
  return { ok: true, value }
}

/**
 * The updated_at a save expects, and (after a successful write) the one it produced. Passed by
 * reference into the media cores so their single write can carry the check too.
 */
export type RowVersion = { expected: string; next: string | null }

/** A version on a table whose updated_at may be NULL (expected null = the row holds NULL). */
export type NullableRowVersion = { expected: string | null; next: string | null }

/** Tables whose updated_at column is nullable; only these accept an expected NULL. */
const NULLABLE_UPDATED_AT = new Set<string>(['shorts'])

/**
 * Parse the editor's version. With `{ nullable: true }` (shorts only) the explicit
 * NULL_UPDATED_AT marker means "the row's updated_at is NULL"; a missing, blank or malformed
 * value is refused either way.
 */
export function rowVersion(value: unknown): ParseResult<RowVersion>
export function rowVersion(value: unknown, opts: { nullable: true }): ParseResult<NullableRowVersion>
export function rowVersion(
  value: unknown,
  opts?: { nullable: true }
): ParseResult<RowVersion | NullableRowVersion> {
  if (opts?.nullable && value === NULL_UPDATED_AT) return { ok: true, value: { expected: null, next: null } }
  const p = parseUpdatedAt(value)
  return p.ok ? { ok: true, value: { expected: p.value, next: null } } : p
}

/** updated_at of the first returned row, or null. */
export function updatedAtOf(data: unknown): string | null {
  const row = Array.isArray(data) ? data[0] : data
  const v =
    row && typeof row === 'object'
      ? (row as { updated_at?: unknown }).updated_at
      : null
  return typeof v === 'string' ? v : null
}

/**
 * UPDATE one row only while its updated_at is still `version.expected`. On success
 * `version.next` holds the new updated_at and `row` the selected row. 0 rows: SAVE_CONFLICT,
 * nothing written. An expected NULL (shorts only) is matched with IS NULL; on any other
 * table it is refused before the write.
 */
export async function updateIfUnchanged(
  db: AdminDb,
  table: 'shows' | 'app_config' | 'categories' | 'shorts' | 'faqs',
  id: string | number,
  patch: Record<string, unknown>,
  version: RowVersion | NullableRowVersion,
  columns = 'id, updated_at'
): Promise<{ error: string | null; row: Record<string, unknown> | null }> {
  if (version.expected === null && !NULLABLE_UPDATED_AT.has(table))
    return { error: INVALID_UPDATED_AT, row: null }
  const { data, error } = await (version.expected === null
    ? db
        .from(table as 'shows')
        .update(patch as never)
        .eq('id', id as string)
        .is('updated_at', null)
        .select(columns)
    : db
        .from(table as 'shows')
        .update(patch as never)
        .eq('id', id as string)
        .eq('updated_at', version.expected)
        .select(columns))
  if (error) return { error: error.message, row: null }
  if (!Array.isArray(data) || data.length === 0)
    return { error: SAVE_CONFLICT, row: null }
  const next = updatedAtOf(data)
  if (!next)
    return { error: 'The saved row came back without updated_at.', row: null }
  version.next = next
  return { error: null, row: data[0] as unknown as Record<string, unknown> }
}
