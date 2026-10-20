// Cron dispatch for the Worker (PLAT-04). Pure: the only import is the cron map.
// The Worker's scheduled() builds an in-process Request to the mapped route and
// hands it to the same handler that serves HTTP, so the routes stay the single
// place where the work (and the CRON_SECRET check) happens.

import { CRON_ROUTES, cronPathFor } from './cron-schedule.ts'

// Placeholder origin: the request never leaves the Worker (handler.fetch is
// called directly), so the host only has to parse.
const SELF_ORIGIN = 'https://self.invalid'

/**
 * The two UTC schedules, in code and docs only. wrangler.jsonc keeps
 * "triggers": {"crons": []} until the Phase 3 cutover (P3-8, after P3-6), so
 * nothing is scheduled on deploy. Phase 3 copies this list into wrangler.jsonc.
 */
export const CRON_EXPRESSIONS_FOR_PHASE_3: readonly string[] = Object.freeze(
  Object.keys(CRON_ROUTES),
)

export function buildCronRequest(
  cron: string,
  secret: string | null | undefined,
): Request | null {
  const path = cronPathFor(cron)
  if (path === null) return null
  const trimmed = typeof secret === 'string' ? secret.trim() : ''
  if (trimmed === '') return null
  return new Request(`${SELF_ORIGIN}${path}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${trimmed}` },
  })
}

// Reads CLICKIT_RUNTIME and CLEANUP_SUPABASE_ORIGINALS.
export type CleanupEnv = Readonly<Record<string, string | undefined>>

/**
 * May cleanup-media delete Supabase Storage originals? On the Worker only with
 * CLEANUP_SUPABASE_ORIGINALS=on (not set in Phase 2). An explicit node runtime
 * (CLICKIT_RUNTIME=node) keeps today's behaviour. No declared runtime refuses (fail
 * closed, so a dropped CLICKIT_RUNTIME var can never switch deletion on).
 */
export function supabaseCleanupEnabled(env: CleanupEnv): boolean {
  if (env.CLICKIT_RUNTIME === 'workers') return env.CLEANUP_SUPABASE_ORIGINALS === 'on'
  return env.CLICKIT_RUNTIME === 'node'
}
