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
  /** Local preview only (.dev.vars); never a wrangler secret or var. */
  LOCAL_UPLOAD_SHIM_SECRET?: string
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
