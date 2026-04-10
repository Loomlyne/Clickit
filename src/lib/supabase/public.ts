import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

/**
 * Cookie-free Supabase client for public catalog reads.
 * Use this inside unstable_cache — the cookie-based createClient() from
 * server.ts accesses next/headers which is forbidden inside cache closures.
 * These queries read public anon data (shows, seasons, episodes) so no
 * session is needed.
 */
export function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
