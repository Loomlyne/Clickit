# clickit-media Worker

Serves `https://media.clickitstory.ae/<bucket>/<key>` for the public Supabase
buckets `show-artwork`, `site-assets` and `avatars`.

- GET/HEAD only; anything else is 405. Unknown bucket, traversal or empty key is 404.
- R2 first (binding `MEDIA_BUCKET` → bucket `clickit-media`, object key `<bucket>/<key>`),
  then the Supabase public original. With no binding (env `supabase-only`) it serves
  Supabase only. An R2 error also falls back to Supabase.
- Range requests (206), conditional requests (304), `X-Media-Source: r2|supabase`.
- `Cache-Control`: one year immutable when the URL carries `?v=` or a variant is served;
  otherwise the R2 object's own value if set, else `public, max-age=3600`.
- `?w=640|1280|1920` serves the AVIF or WebP variant from R2 key
  `_v/<w>/<avif|webp>/<bucket>/<key>` chosen from `Accept` (avif, then webp), falls back
  to the original, and adds `Vary: Accept`. Variants are never read from Supabase.
  `/_v/...` cannot be requested directly (404). If-Match / If-Unmodified-Since
  failures answer 412; cache validators answer 304.
- `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none';
  style-src 'unsafe-inline'; sandbox` on every response (SVG cannot run script).
- `/healthz` answers `ok`.

Code: `src/handler.ts` (pure, testable), `src/index.ts` (Worker entry).
Tests: `tests/unit/media-worker.test.ts` (run by `npm run test:unit`).

Local run (local R2 simulator, empty, so it exercises the Supabase fallback):

    cd workers/media && HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 dev --env=""
    npm run media:health -- --media-origin http://127.0.0.1:8787 --verify-bytes --timeout 180

Deploy and DNS: see `DNS-PLAN.md`. Deploys are the controller's job, ClickitStory
account only.
