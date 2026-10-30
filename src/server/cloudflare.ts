import 'server-only'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { AiBinding } from '@/lib/arabic-text'

export type { AiBinding }

/**
 * Minimal structural R2 bucket type (only what the app calls). Kept local so
 * the app does not depend on @cloudflare/workers-types.
 */
export type R2BucketLike = {
  head(key: string): Promise<unknown | null>
  get(key: string, options?: unknown): Promise<unknown | null>
  put(key: string, value: unknown, options?: unknown): Promise<unknown>
  delete(keys: string | string[]): Promise<void>
  list(options?: {
    prefix?: string
    cursor?: string
    limit?: number
  }): Promise<{ objects: Array<{ key: string; uploaded: Date }>; truncated: boolean; cursor?: string }>
}

/**
 * Minimal structural Queue producer type (only what the app calls). Local for the
 * same reason as R2BucketLike.
 */
export type QueueLike = {
  send(body: unknown): Promise<void>
  sendBatch(messages: { body: unknown }[]): Promise<void>
}

/**
 * Bindings and variables of the `clickit` app Worker (root wrangler.jsonc).
 * This is the app Worker's own `MEDIA` binding, not the media Worker's
 * `MEDIA_BUCKET`. Names only; secrets are optional because they exist only
 * after the owner sets them (RUNBOOK).
 */
export type WorkerEnv = {
  MEDIA: R2BucketLike
  /** Workers AI (wrangler.jsonc `ai`). Optional: absent in node tests and builds. */
  AI?: AiBinding
  CLOUDFLARE_ACCOUNT_ID: string
  CLOUDFLARE_R2_BUCKET: string
  CLICKIT_RUNTIME?: string
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
  CRON_SECRET?: string
  TURNSTILE_SECRET_KEY?: string
  LOCAL_DEV?: string
  /** Exactly "on" lets the weekly R2 upload sweep delete; anything else is a dry run. */
  R2_UPLOAD_SWEEP_DELETE?: string
  /** Local preview only (.dev.vars); never a wrangler secret or var. */
  LOCAL_UPLOAD_SHIM_SECRET?: string
  /** Email outbox doorbell (producer binding; the consumer is added in 05-19). Optional: absent in node tests and `next dev`. */
  EMAIL_QUEUE?: QueueLike
  /** Resend API key (wrangler secret, owner step). Absent until the owner sets it. */
  RESEND_API_KEY?: string
  /** HMAC secret for unsubscribe and newsletter-confirm links (wrangler secret, owner step). */
  EMAIL_LINK_SECRET?: string
  /** From header, e.g. "Clickit Story <no-reply@clickitstory.ae>" (wrangler var). */
  EMAIL_FROM?: string
  /** Exactly "on" lets the daily digest cron enqueue (wrangler var); anything else is off. */
  EMAIL_DIGEST_ENABLED?: string
  /** Public origin used in email links (wrangler var). */
  SITE_ORIGIN?: string
  /** Supabase project URL for the queue consumer's RPC calls (wrangler var). */
  SUPABASE_URL?: string
  /** Service-role key for the queue consumer (wrangler secret, owner step). Never logged. */
  SUPABASE_SERVICE_ROLE_KEY?: string
}

export async function getWorkerEnv(): Promise<WorkerEnv> {
  const { env } = await getCloudflareContext({ async: true })
  return env as unknown as WorkerEnv
}

/**
 * The Workers AI binding, or undefined. Reads only the context the Worker (or
 * `next dev`) already put on the global scope: never the async mode, which would
 * start a wrangler platform proxy (and a remote AI session) inside `next build`.
 */
export function getWorkerAi(): AiBinding | undefined {
  try {
    const { env } = getCloudflareContext()
    const ai = (env as unknown as Partial<WorkerEnv>).AI
    return ai && typeof ai.run === 'function' ? ai : undefined
  } catch {
    return undefined
  }
}
