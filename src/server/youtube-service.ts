import 'server-only'

// Server-side YouTube client factory, reused by the daily re-check (06-08),
// the admin import and verify actions (06-13) and the key test (06-16). The key
// comes only from Supabase Vault through readYouTubeApiKey (D-20) and travels
// only in the x-goog-api-key header (the 06-03 client has no other transport).
// It is never logged, returned or sent to a client.
import { createYouTubeClient, type YouTubeClientLike } from '@/server/youtube/client'
import { readYouTubeApiKey } from '@/server/youtube-key'

export type ServerYouTubeClient = { client: YouTubeClientLike } | { missing: true }

export async function getServerYouTubeClient(): Promise<ServerYouTubeClient> {
  const apiKey = await readYouTubeApiKey()
  if (!apiKey) return { missing: true }
  return { client: createYouTubeClient({ apiKey }) }
}
