# clickit-media Worker

Serves `https://media.clickitstory.ae/<bucket>/<key>` for the public Supabase
buckets `show-artwork`, `site-assets` and `avatars`.

- GET/HEAD only; anything else is 405. Unknown bucket, traversal or empty key is 404.
- R2 first (binding `MEDIA_BUCKET` → bucket `clickit-media`, object key `<bucket>/<key>`),
  then the Supabase public original; an R2 error also falls back to Supabase. The binding
  exists only in `--env r2`. The top level and `--env supabase-only` have no binding and
  serve Supabase only.
- Range requests (206), conditional requests (304), `X-Media-Source: r2|supabase`.
- `Cache-Control` is decided from the URL only (stored R2 values are ignored): one year
  immutable when the URL carries `?v=`, one day plus a week stale-while-revalidate without it.
- Only the `v` query param is forwarded to Supabase. Edge cache of the Supabase fetch:
  2xx one day, 404 one minute, other errors not cached. 412 for failed If-Match/If-Unmodified-Since.
- `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none';
  style-src 'unsafe-inline'; sandbox` on every response (SVG cannot run script).
- `/healthz` answers `ok`.

Code: `src/handler.ts` (pure, testable), `src/index.ts` (Worker entry).
Tests: `tests/unit/media-worker.test.ts` (run by `npm run test:unit`).

Local run (local R2 simulator, empty, so it exercises the Supabase fallback):

    cd workers/media && HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 dev --env r2
    npm run media:health -- --media-origin http://127.0.0.1:8787 --verify-bytes --timeout 180

**Production deploys use `--env supabase-only` until the R2 mirror gate in `DNS-PLAN.md` §5d
passes; never deploy `--env r2` before that.** Deploys are the controller's job, ClickitStory
account only:

    HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 deploy -c workers/media/wrangler.jsonc --env supabase-only

DNS and the R2 gate: see `DNS-PLAN.md`.
