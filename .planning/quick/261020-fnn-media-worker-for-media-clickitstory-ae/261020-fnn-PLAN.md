---
quick_id: 261020-fnn
slug: media-worker-for-media-clickitstory-ae
date: 2026-10-20
mode: quick (inline; spec fully defined by .planning/prompts/D-media-now.md, so no separate planner agent)
---

# Job D: make live images load (media.clickitstory.ae)

Goal: the frozen Vercel build points every image at `https://media.clickitstory.ae/<bucket>/<key>`, which has no DNS.
Serve that host from a Cloudflare Worker (ClickitStory account) without Vercel and without a DB rewrite.

## Tasks

1. `workers/media/`: own `wrangler.jsonc` (account e329b099…), `src/handler.ts` + `src/index.ts`.
   GET/HEAD `/<bucket>/<key>`, allow-list show-artwork/site-assets/avatars, R2 binding `MEDIA_BUCKET`
   (bucket `clickit-media`, key `<bucket>/<key>`) first, Supabase public original on miss or R2 error.
   Range, 304, long cache headers, nosniff, CSP `default-src 'none'; style-src 'unsafe-inline'; sandbox`.
   Env `supabase-only` (same Worker name, no R2) so it deploys before R2 is enabled.
   Check: unit tests in `tests/unit/media-worker.test.ts`; `wrangler deploy --dry-run` for both envs.
2. `scripts/media-health.mjs` + `npm run media:health`: crawl home + 3 pages, HEAD every media URL,
   exit 1 on any non-200; `--media-origin` and `--verify-bytes` to prove a Worker before DNS.
   Check: local `wrangler dev` run returns every live URL 200 with bytes equal to Supabase.
3. `workers/media/DNS-PLAN.md`: public DNS copy, DNS-only import list, ignat/nataly explanation, owner step order.
   Read-only; no DNS change.

Out of scope (owner/controller): enable R2, create bucket, deploy, add zone, NS change, custom domain, R2 copy.
