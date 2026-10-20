// YouTube Data API key cores (D-15, D-20). The key lives in Supabase Vault as
// the one named secret `youtube_api_key` and leaves Postgres only through the
// service-role RPCs from migration 20261020150526. Pure (unit-tested under
// node --test): no path-alias imports, no env reads, no logging. The server
// wrapper is src/server/youtube-key.ts.

/** Shape of a Google API key; `private.set_youtube_key` checks the same. */
export const YOUTUBE_KEY_FORMAT = /^AIza[0-9A-Za-z_-]{35}$/

export type RpcClient = {
  rpc(
    fn: string,
    args?: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: unknown }>
}

export type YouTubeKeyMeta = {
  hasKey: boolean
  last4: string | null
  updatedAt: string | null
}

const NO_KEY: YouTubeKeyMeta = { hasKey: false, last4: null, updatedAt: null }

/**
 * Reads the key through `rpc('get_youtube_key')`. Returns the trimmed key, or
 * null when it is missing, blank, not a string, or the call fails. Never
 * throws and never returns the error text (it could quote the request).
 */
export async function resolveYouTubeApiKeyCore(
  db: RpcClient
): Promise<string | null> {
  try {
    const { data, error } = await db.rpc('get_youtube_key')
    if (error || typeof data !== 'string') return null
    const key = data.trim()
    return key === '' ? null : key
  } catch {
    return null
  }
}

/**
 * Reads `rpc('youtube_key_meta')`: whether a key is stored, its last four
 * characters and when it changed. Any failure reads as "no key".
 */
export async function readYouTubeKeyMetaCore(
  db: RpcClient
): Promise<YouTubeKeyMeta> {
  try {
    const { data, error } = await db.rpc('youtube_key_meta')
    if (error) return { ...NO_KEY }
    const row: unknown = Array.isArray(data) ? data[0] : data
    if (!row || typeof row !== 'object') return { ...NO_KEY }
    const r = row as Record<string, unknown>
    if (r.has_key !== true) return { ...NO_KEY }
    return {
      hasKey: true,
      last4: typeof r.last4 === 'string' ? r.last4 : null,
      updatedAt: typeof r.updated_at === 'string' ? r.updated_at : null,
    }
  } catch {
    return { ...NO_KEY }
  }
}
