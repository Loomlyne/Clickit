# Hand-over: job D, images live now (media.clickitstory.ae)

Branch: `claude/media-worker-now-ea54d5` (from `origin/main` ea94b96). Work session; nothing deployed, no DNS touched.
Final commit: see `git log -1` on the branch / the PR. PR: see PR link in the job report.

## What is in the branch

- `workers/media/` — media Worker (own `wrangler.jsonc`, ClickitStory account `e329b099…`).
  `src/handler.ts` is pure and exported (job C imports `handleMediaRequest`, `parseMediaPath`, `PUBLIC_MEDIA_BUCKETS`).
  R2 binding `MEDIA_BUCKET` → `clickit-media` first, Supabase original on miss/error. Env `supabase-only` = same Worker name, no R2.
- `scripts/media-health.mjs`, `npm run media:health` — crawl `/en`, `/en/watch`, `/en/portfolio`, `/en/series/last-call`,
  HEAD every media URL, exit 1 on any non-200. `--media-origin`, `--verify-bytes`, `--timeout`, `--page`, `--json`.
- `tests/unit/media-worker.test.ts` — 17 tests (path guard, 405/404, R2 hit/range/suffix/HEAD/304, fallback, R2 error, 400→404, 5xx→502, SVG CSP, health extractor).
- `workers/media/DNS-PLAN.md` — public DNS copy, DNS-only import list, ignat/nataly explanation, owner step order.

## Gates (2026-10-20)

- Unit tests: 92/92 pass (17 new).
- Lint: 0 errors; 17 warnings, all pre-existing in other files (the one in `workers/media/src/index.ts` was fixed).
- `wrangler deploy --dry-run`: both envs bundle (7.4 KiB). Top level shows R2 + SUPABASE_URL bindings; `supabase-only` shows SUPABASE_URL only.
- `next build`: see the PR body (this worktree has no `.env.local`; build runs with the public Supabase URL and a dummy anon key).

## Proof (local `wrangler dev`, 2026-10-20 ~10:25–10:35 UTC)

- Live HTML references 54 distinct media URLs (site-assets + show-artwork) across the 4 pages.
- Live host today: `npm run media:health` → 0/54 ok (no DNS for media.clickitstory.ae).
- Through the Worker (local, empty local R2 → Supabase fallback): 53/54 byte-identical in one run with `--verify-bytes`;
  the 54th dropped its connection mid-download in that run ("terminated") and matched SHA-256 3/3 on retry.
- R2 hit path (object put into the local R2 simulator): 200 with `X-Media-Source: r2`, bytes match, suffix range `bytes=-100` → 206 `bytes 812885-812984/812985`.
- Range on the 40 MB hero video: `bytes=0-1023` → 206 `bytes 0-1023/40268819`. Missing object 404, unknown bucket 404, traversal 404, POST 405.

## Not verified

- Nothing on workers.dev or the real domain yet: needs the controller's deploy (owner OK) and DNS (owner steps).
- R2 in the ClickitStory account (not enabled, API code 10042); R2 path proven only in the local simulator.
- Cloudflare edge caching of the Supabase subrequest (`cf.cacheEverything`) only takes effect on the deployed Worker.
- That `--env supabase-only` keeps the script name `clickit-media` (set explicitly in the env block; confirm in the deploy output).

## Owner steps (in order; full detail in `workers/media/DNS-PLAN.md` §5)

1. (Optional now) Enable R2 + create bucket `clickit-media`.
2. Controller deploys to workers.dev: `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 deploy -c workers/media/wrangler.jsonc --env supabase-only`
3. Add zone `clickitstory.ae` (Free), two DNS-only records only.
4. At Tasjeel replace all four NS with the assigned pair.
5. After Active: attach custom domain `media.clickitstory.ae`.

## UAT (after step 5)

1. Run `npm run media:health` → every line `ok  200`, last line `N/N media URLs ok`, exit 0.
2. Open https://www.clickitstory.ae/en → logo, favicon and social icons show.
3. Open https://www.clickitstory.ae/en/watch → every show card has artwork.
4. `curl -sI https://media.clickitstory.ae/site-assets/settings/favicon.png` → `200`, `x-content-type-options: nosniff`, `x-media-source: supabase` (or `r2` after the copy).
5. `curl -s -o /dev/null -w '%{http_code}' https://media.clickitstory.ae/private/x.png` → `404`.
