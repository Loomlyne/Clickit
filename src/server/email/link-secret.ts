import 'server-only'

import { getWorkerEnv } from '@/server/cloudflare'

/**
 * HMAC secret for unsubscribe and newsletter-confirm links. Worker env first
 * (wrangler secret), then process.env (local dev, node). Null when unset: callers
 * show the unavailable state and never fall back to a default secret.
 */
export async function getLinkSecret(): Promise<string | null> {
  let fromWorker: string | undefined
  try {
    fromWorker = (await getWorkerEnv()).EMAIL_LINK_SECRET
  } catch {
    fromWorker = undefined
  }
  const value = fromWorker ?? process.env.EMAIL_LINK_SECRET
  return typeof value === 'string' && value.trim() !== '' ? value : null
}
