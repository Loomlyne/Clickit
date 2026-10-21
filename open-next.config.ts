// Source: opennext.js.org/cloudflare/caching
import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache'
import { withRegionalCache } from '@opennextjs/cloudflare/overrides/incremental-cache/regional-cache'
import d1NextTagCache from '@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache'
import doQueue from '@opennextjs/cloudflare/overrides/queue/do-queue'

export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: 'long-lived' }),
  queue: doQueue,
  tagCache: d1NextTagCache,
  // Interception runs after the proxy in OpenNext's routingHandler
  // (handleMiddleware first, then cacheInterceptor), so the gates stay in
  // force; it only replaces the Next server render with the prerendered
  // R2 entry (phase 02.1 RESEARCH "Order", D-64). On by default; the spike
  // (plan 02.1-01) builds once with CLICKIT_SPIKE_INTERCEPTION=off to compare.
  // This file is read at build time and again at runtime (the compiled
  // open-next.config.mjs runs inside the Worker), so the off run needs the
  // value in both: the build env (scripts/cf/build-target.mjs passes it for
  // the preview target only) and the preview's
  // `--var CLICKIT_SPIKE_INTERCEPTION:off`. Plan 02.1-06 turns this into a constant.
  enableCacheInterception: process.env.CLICKIT_SPIKE_INTERCEPTION !== 'off',
})
