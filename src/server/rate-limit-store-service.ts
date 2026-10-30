import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import type { RateLimitStore } from '@/server/rate-limit-policy'
import { supabaseRateLimitStore } from '@/server/rate-limit-store'

/**
 * The rate_limits ledger as a RateLimitStore on the service-role client: the
 * shared form of contact.ts's private rateLimitStore() (05-21; contact.ts moves
 * onto it in 05-28). The pure adapter stays in rate-limit-store.ts so node
 * --test can load it; this file only adds the client. createAdminClient throws
 * when the service key is missing: callers treat that as a refusal (fail
 * closed).
 */
export function createRateLimitStore(): RateLimitStore {
  return supabaseRateLimitStore(createAdminClient())
}
