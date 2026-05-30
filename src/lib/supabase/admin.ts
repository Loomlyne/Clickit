// Server-only: uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
// Import only in Server Actions (src/app/**/actions.ts files).
// WARNING: This client bypasses Row Level Security. Only use in Server Actions.
// NEVER import this file in client-side code.

import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  // Fail loud at the call site with a clear message rather than handing a
  // client with an `undefined` key to Supabase — the resulting 401s would be
  // much harder to trace in production logs.
  if (!url) throw new Error('[createAdminClient] NEXT_PUBLIC_SUPABASE_URL is not set')
  if (!key) throw new Error('[createAdminClient] SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient<Database>(url, key)
}
