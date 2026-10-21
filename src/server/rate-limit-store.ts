// The rate_limits ledger as a RateLimitStore (service_role client only). The table
// has only a `key` column, so the caller's ip (or `admin:<userId>`) is folded into
// the key as `<key>:<ip>`. Errors THROW (never allow): decideRateLimit turns a
// throw into a refusal, so the limiter fails closed. No imports: the client is
// passed in so node --test can load it.
import type { RateLimitStore } from './rate-limit-policy'

type CountResult = { count: number | null; error: unknown }
type RateLimitsClient = {
  from(table: 'rate_limits'): {
    select(
      columns: string,
      options: { count: 'exact'; head: true }
    ): {
      eq(column: string, value: string): { gte(column: string, value: string): PromiseLike<CountResult> }
    }
    insert(row: { key: string }): PromiseLike<{ error: unknown }>
  }
}

export function supabaseRateLimitStore(client: unknown): RateLimitStore {
  const admin = client as RateLimitsClient
  return {
    async count(ip, key, sinceIso) {
      const { count, error } = await admin
        .from('rate_limits')
        .select('id', { count: 'exact', head: true })
        .eq('key', `${key}:${ip}`)
        .gte('created_at', sinceIso)
      if (error) throw new Error('rate_limits count failed')
      if (typeof count !== 'number') throw new Error('rate_limits count missing')
      return count
    },
    async record(ip, key) {
      const { error } = await admin.from('rate_limits').insert({ key: `${key}:${ip}` })
      if (error) throw new Error('rate_limits insert failed')
    },
  }
}

/**
 * Rows older than this are never read by any limiter: the longest window in use is the
 * contact form's 1 h (translate-ar is 10 min). Review item 9 (PR #29).
 */
export const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000

type PruneClient = {
  from(table: 'rate_limits'): {
    delete(options: { count: 'exact' }): {
      lt(column: 'created_at', value: string): PromiseLike<{ error: unknown; count?: number | null }>
    }
  }
}

/**
 * One DELETE of the rate_limits rows older than the retention (service_role client only).
 * Fail-soft: never throws, so a failed prune cannot break the cron's main job; the caller
 * logs and reports the result.
 */
export async function pruneRateLimits(
  client: unknown,
  nowMs: number = Date.now()
): Promise<{ pruned: number | null; error: string | null }> {
  try {
    const cutoff = new Date(nowMs - RATE_LIMIT_RETENTION_MS).toISOString()
    const { error, count } = await (client as PruneClient)
      .from('rate_limits')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff)
    if (error) return { pruned: null, error: 'rate_limits prune failed' }
    return { pruned: typeof count === 'number' ? count : null, error: null }
  } catch {
    return { pruned: null, error: 'rate_limits prune failed' }
  }
}
