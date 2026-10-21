// Every place a stored media url can be live, across all scopes (deferred items 21-23).
// Before an R2 object that was once live is deleted, these are read fresh and the key is
// kept if ANY of them still points at it, in any url form: our media origin (with or
// without ?v=), a Supabase Storage public url for the same <bucket>/<path>, another media
// host, or a derived `_v/<w>/<fmt>/` variant of it. A read that fails or cannot be proven
// complete counts as "everything is live": an orphan is acceptable, a broken image is not.
// Pure: no '@/' or server-only imports (node --test loads it).
import { liveKeysForUrl, originalMediaKey } from './r2-keys.ts'

/** Returned when a compare-and-swap save finds the value changed since it was read. */
export const MEDIA_SAVE_CONFLICT = 'This item changed while you were saving. Reload and try again.'

/**
 * Plain text columns that hold one media url, per table. A test reads the migrations and
 * fails when a media-looking column is missing here; add new media columns to this list.
 */
export const MEDIA_URL_COLUMNS = {
  shows: [
    'poster_url',
    'card_image_url',
    'hero_url',
    'hero_image_mobile_url',
    'logo_url',
    'hero_video_url',
    'hero_video_mobile_url',
  ],
  show_cast: ['image_url'],
  app_config: [
    'og_image_url',
    'favicon_url',
    'favicon_dark_url',
    'auth_image_url',
    'hero_video_url',
    'hero_video_mobile_url',
    'preloader_video_url',
    'live_stream_url',
  ],
  profiles: ['avatar_url'],
  shorts: ['thumbnail_url'],
} as const

/** jsonb columns scanned deeply for any url string (footer social `iconUrl` lives in footer_content). */
export const MEDIA_JSON_COLUMNS = {
  app_config: ['footer_content', 'cta_copy', 'genre_config', 'feature_flags', 'top_ticker'],
} as const

export type ReferenceRead = { urls: string[]; error: string | null }
/** Reads every live media url now. Called again right before each delete. */
export type ReferenceSource = () => Promise<ReferenceRead>

type QueryResult = { data: unknown; error: { message: string } | null; count?: number | null }
export interface ReferenceQuery extends PromiseLike<QueryResult> {
  not(column: string, operator: string, value: null): ReferenceQuery
  order(column: string, options: { ascending: boolean }): ReferenceQuery
  range(from: number, to: number): ReferenceQuery
}
/** The slice of a Supabase client the reader needs (service client in production: it must see every row). */
export type ReferenceDb = {
  from(table: string): { select(columns: string, options: { count: 'exact' }): ReferenceQuery }
}

const PAGE = 1000
const MAX_PAGES = 200
const UNREADABLE = 'Could not read every media reference'

function collectStrings(value: unknown, out: string[]) {
  if (typeof value === 'string') {
    if (value) out.push(value)
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out)
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, out)
  }
}

/** Every row of one table, page by page; null on success, an error message otherwise. */
async function readTable(
  db: ReferenceDb,
  table: string,
  columns: readonly string[],
  out: string[]
): Promise<string | null> {
  let offset = 0
  for (let page = 0; page < MAX_PAGES; page++) {
    let query = db.from(table).select(columns.join(', '), { count: 'exact' })
    // One-column tables: rows without a value cannot reference anything.
    if (columns.length === 1) query = query.not(columns[0]!, 'is', null)
    const { data, error, count } = await query.order('id', { ascending: true }).range(offset, offset + PAGE - 1)
    if (error) return error.message || UNREADABLE
    // Without the exact count a short page could be a server row cap: not provably complete.
    if (!Array.isArray(data) || typeof count !== 'number') return UNREADABLE
    for (const row of data as Array<Record<string, unknown>>) {
      for (const column of columns) collectStrings(row?.[column], out)
    }
    offset += data.length
    if (offset >= count) return null
    if (data.length === 0) return UNREADABLE
  }
  return UNREADABLE
}

/** Every live media url in every scope. Fails closed: any error means no list. */
export async function readMediaReferenceUrls(db: ReferenceDb): Promise<ReferenceRead> {
  const specs: Array<[string, readonly string[]]> = [
    ['shows', MEDIA_URL_COLUMNS.shows],
    ['show_cast', MEDIA_URL_COLUMNS.show_cast],
    ['app_config', [...MEDIA_URL_COLUMNS.app_config, ...MEDIA_JSON_COLUMNS.app_config]],
    ['profiles', MEDIA_URL_COLUMNS.profiles],
    ['shorts', MEDIA_URL_COLUMNS.shorts],
  ]
  try {
    const parts = await Promise.all(
      specs.map(async ([table, columns]) => {
        const urls: string[] = []
        const error = await readTable(db, table, columns, urls)
        return { urls, error }
      })
    )
    const failed = parts.find((p) => p.error !== null)
    if (failed) return { urls: [], error: failed.error }
    return { urls: parts.flatMap((p) => p.urls), error: null }
  } catch (err) {
    return { urls: [], error: err instanceof Error && err.message ? err.message : UNREADABLE }
  }
}

const URL_IN_TEXT = /https?:\/\/[^\s"'<>()\\]+/g
const SUPABASE_PUBLIC_PREFIX = '/storage/v1/object/public/'

/** The original media keys one stored value refers to, in every url form we know. */
export function referencedKeysOf(value: string, mediaOrigin: string | null): string[] {
  const out = new Set<string>()
  const trimmed = value.trim()
  if (!trimmed) return []
  const bare = originalMediaKey(trimmed)
  if (bare) out.add(bare)
  const candidates = new Set([trimmed, ...(trimmed.match(URL_IN_TEXT) ?? []).map((u) => u.replace(/[.,;:]+$/, ''))])
  for (const candidate of candidates) {
    for (const key of liveKeysForUrl(candidate, mediaOrigin)) {
      const original = originalMediaKey(key)
      if (original) out.add(original)
    }
    // Any host: the same path on an old media origin or the preview loopback is still this file.
    let path: string
    try {
      path = new URL(candidate).pathname
      path = path.startsWith(SUPABASE_PUBLIC_PREFIX) ? path.slice(SUPABASE_PUBLIC_PREFIX.length) : path.slice(1)
      path = decodeURIComponent(path)
    } catch {
      continue
    }
    const original = originalMediaKey(path)
    if (original) out.add(original)
  }
  return [...out]
}

/** The set of original keys a list of live urls refers to. */
export function referencedKeySet(urls: readonly string[], mediaOrigin: string | null): Set<string> {
  return new Set(urls.flatMap((url) => referencedKeysOf(url, mediaOrigin)))
}

/**
 * Referenced storage paths per bucket (`show-artwork` -> `shows/<id>/hero-1.webp`), in every
 * url form referencedKeysOf knows: a Supabase public url, our media origin,
 * media.clickitstory.ae, a workers.dev media host. The cleanup cron's first pass uses it:
 * after the media-url rewrite rows hold media-host urls, which a Supabase-only parser would
 * miss, so their objects would look like orphans (PR #31 review 5).
 */
export function referencedPathsByBucket(
  urls: ReadonlyArray<string | null | undefined>,
  mediaOrigin: string | null
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  const present = urls.filter((url): url is string => typeof url === 'string' && url !== '')
  for (const key of referencedKeySet(present, mediaOrigin)) {
    const slash = key.indexOf('/')
    const bucket = key.slice(0, slash)
    const paths = out.get(bucket) ?? new Set<string>()
    paths.add(key.slice(slash + 1))
    out.set(bucket, paths)
  }
  return out
}

/**
 * Which of `keys` (originals or variants) are live right now. A key is live when its
 * original is referenced anywhere. A failed read returns every key as live, with the error.
 */
export async function findLiveReferences(
  keys: readonly string[],
  source: ReferenceSource,
  mediaOrigin: string | null
): Promise<{ live: string[]; error: string | null }> {
  let read: ReferenceRead
  try {
    read = await source()
  } catch (err) {
    read = { urls: [], error: err instanceof Error && err.message ? err.message : UNREADABLE }
  }
  if (read.error !== null) return { live: [...keys], error: read.error }
  const referenced = referencedKeySet(read.urls, mediaOrigin)
  return { live: keys.filter((k) => referenced.has(originalMediaKey(k) ?? k)), error: null }
}

/** True when the key (or its original) is live anywhere, or when that cannot be read. */
export async function isMediaKeyReferenced(
  key: string,
  source: ReferenceSource,
  mediaOrigin: string | null
): Promise<boolean> {
  const r = await findLiveReferences([key], source, mediaOrigin)
  return r.error !== null || r.live.length > 0
}
