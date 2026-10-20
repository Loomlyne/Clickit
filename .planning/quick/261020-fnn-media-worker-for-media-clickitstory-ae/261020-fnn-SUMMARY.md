---
quick_id: 261020-fnn
status: complete
date: 2026-10-20
---

# 261020-fnn summary: media Worker for media.clickitstory.ae (job D)

Built `workers/media/` (R2 first, Supabase original fallback, allow-listed buckets, Range/304, cache headers,
nosniff, sandbox CSP), `npm run media:health`, and `workers/media/DNS-PLAN.md`. 17 new unit tests.

Proof: the live site's 54 media URLs return 0/54 on media.clickitstory.ae today; through the Worker on local
`wrangler dev` all 54 return 200 with bytes equal to the Supabase originals (one needed a retry after a dropped
connection). R2 hit path proven in the local R2 simulator.

Finding: the .ae registry delegates clickitstory.ae to ns3/ns4.tasjeel.ae plus ignat/nataly.ns.cloudflare.com;
the Cloudflare pair answers REFUSED (lame) and is the pair used by invios.online, so it came from that account.

Gate: lint 0 errors, unit 92/92, build exit 0 (with public Supabase URL and a dummy anon key; no env file in the worktree).

Not done (owner/controller): R2 enable + bucket, workers.dev deploy, zone add, NS change at Tasjeel, custom domain.
Hand-over: `.planning/handovers/D-media-now.md`.
