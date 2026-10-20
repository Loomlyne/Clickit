import 'server-only'

// YouTube Data API key, read from Supabase Vault through the service-role RPC
// (D-15, D-20). React cache() memoises within one server request only; outside
// a React request (route handlers, cron) it does not memoise, so a changed key
// applies on the next request. Never add a module-level cache, never log the
// key, never return it to a client.
import { cache } from 'react'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  readYouTubeKeyMetaCore,
  resolveYouTubeApiKeyCore,
  type RpcClient,
} from '@/server/youtube/key'

// The cores need only `rpc`; the service-role client satisfies RpcClient.
const adminRpc = (): RpcClient => createAdminClient()

export const readYouTubeApiKey = cache(async () =>
  resolveYouTubeApiKeyCore(adminRpc())
)

export const readYouTubeKeyMeta = cache(async () =>
  readYouTubeKeyMetaCore(adminRpc())
)

export async function hasYouTubeApiKey(): Promise<boolean> {
  return (await readYouTubeKeyMeta()).hasKey
}
