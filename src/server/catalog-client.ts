// Server-only catalog client (AUTH-08, research finding F1, D-24).
//
// `episodes_view` is security_invoker and calls get_public_youtube_video_id.
// Once anon EXECUTE on that function is revoked (M3), anon reads of the view
// fail. The four cached catalog queries that read episodes_view therefore use
// this service-role client instead of the anon public client.
//
// Rules:
// - Read-only use. Only the episodes_view reads in src/lib/queries.ts that must
//   survive the M3 anon revoke use it (getNewEpisodes, getEpisodesByShowId,
//   getEpisodesBySeasonId, getComingSoonEpisodes).
// - Never import from client components: the service role bypasses RLS.
// - Without SUPABASE_SERVICE_ROLE_KEY (clean-clone build) it returns null, logs
//   once per process, and callers return an empty result instead of throwing.

import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

let warnedMissingKey = false

export function createCatalogClient(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    if (!warnedMissingKey) {
      warnedMissingKey = true
      console.error('[catalog] service role key missing; catalog episode reads return empty')
    }
    return null
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
