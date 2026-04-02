// Server-only: uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
// Import only in Server Actions (src/app/**/actions.ts files).
// WARNING: This client bypasses Row Level Security. Only use in Server Actions.
// NEVER import this file in client-side code.

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
