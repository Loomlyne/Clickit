// Cron dispatch for the Worker (PLAT-04). Pure: the only import is the cron map.
// The Worker's scheduled() builds an in-process Request to the mapped route and
// hands it to the same handler that serves HTTP, so the routes stay the single
// place where the work (and the CRON_SECRET check) happens.

import { CRON_ROUTES, cronPathFor } from './cron-schedule.ts'

// Placeholder origin: the request never leaves the Worker (handler.fetch is
// called directly), so the host only has to parse.
const SELF_ORIGIN = 'https://self.invalid'

/**
 * The three UTC schedules, in code and docs only. wrangler.jsonc keeps
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

export type CronRouteFetch = (request: Request) => Promise<Response>
export type CronLogger = { log(...args: unknown[]): void; error(...args: unknown[]): void }

/**
 * Run one cron: build the in-process request, call the route, log the outcome.
 * Rejects on no route / no CRON_SECRET, a non-OK status or a throw, so the
 * Worker's scheduled() promise fails and Cloudflare's cron status shows it.
 * Logs and errors name the path and status, never the secret.
 */
export async function runCron(
  cron: string,
  secret: string | null | undefined,
  fetchRoute: CronRouteFetch,
  logger: CronLogger = console,
): Promise<void> {
  const request = buildCronRequest(cron, secret)
  if (request === null) {
    logger.error('cron: no route or no CRON_SECRET for', cron)
    throw new Error(`cron: no route or no CRON_SECRET for ${cron}`)
  }
  const path = new URL(request.url).pathname
  let response: Response
  try {
    response = await fetchRoute(request)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    logger.error('cron: threw', path, message)
    throw new Error(`cron: ${path} threw`)
  }
  if (!response.ok) {
    logger.error('cron: failed', path, 'status', response.status)
    throw new Error(`cron: ${path} failed with status ${response.status}`)
  }
  logger.log('cron:', path, 'status', response.status)
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
