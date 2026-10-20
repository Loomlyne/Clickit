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
