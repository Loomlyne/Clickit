# Hand-over: job R2, Supabase Storage → R2 copy (media still served from Supabase)

Branch: `claude/r2-media-copy-8a1c47` (from `origin/main` f217d9c). Work session.
Nothing deployed, no DNS, no live DB write. Supabase Storage was only read.

## Result (2026-10-20)

R2 bucket `clickit-media`, ClickitStory account `e329b099…`, location WEUR, created 2026-10-20 12:32:58 UTC
with `HOME=/Users/koss/.clickit-cloudflare npx -y wrangler@4.151.2 r2 bucket create clickit-media`.

| Source bucket | Objects | Bytes |
|---|---:|---:|
| show-artwork | 49 | 26,152,781 |
| site-assets | 34 | 94,622,899 |
| avatars | 3 | 669,804 |
| **Total** | **86** | **121,445,484** (~116 MiB) |

Keys are `<supabase bucket>/<object path>`, the same as `workers/media/src/handler.ts` (`${path.bucket}/${path.key}`).
Each object keeps the Supabase `mimetype` as Content-Type and `cacheControl` as Cache-Control (the Worker ignores the stored Cache-Control).

| Run (log in `/Users/koss/.clickit-checks/`) | Result |
|---|---|
| Pass 1 `--execute` (`r2-copy-20261020-1333.log`, 13:33–13:52 CET) | 80 copied-and-verified, 5 verified-existing (put landed, read-back retried), **1 failed** (`show-artwork/shows/56aec18b-…/hero-1781635858883.webp`, wrangler put died 3× with no error line) |
| Pass 2 `--execute` (`r2-copy-20261020-1353-pass2.log`, 13:53–13:57) | 85 verified-existing, 1 copied-and-verified (the failed one), **0 failures**, `exit=0` |
| Pass 3 `--verify`, writes nothing (`r2-copy-20261020-1357-verify.log`, 13:57–14:02) | **86/86 verified-existing**, `"failures": 0`, `exit=0` |

"Verified" = fresh download of the public Supabase object and of the R2 object, equal size, SHA-256 and MD5; size equal to `storage.objects.metadata.size`; MD5 equal to the stored Supabase eTag where it is single-part (84 objects; the 2 hero videos have multipart eTags). Transient `fetch failed` from wrangler happened twice in passes 2–3 and passed on retry.
Final manifest with per-object SHA-256/MD5: `/Users/koss/.clickit-checks/r2-wrangler-manifest-20261020.json`.
`wrangler r2 bucket info` still reported `object_count: 0` at 14:02: that bucket metric is delayed, not the object state (pass 3 downloaded all 86 from R2).

## How it was copied (no keys)

`scripts/copy-supabase-media-to-r2-wrangler.mjs` (`npm run r2:copy`), node built-ins only:

1. Manifest: `supabase db query --linked` SELECT on `storage.objects` (name, size, mimetype, cacheControl, eTag). Written to `.tmp/r2-wrangler-manifest.json` (gitignored), same shape as `migrate-supabase-media-to-r2.mjs` manifests (version 1, `sourceBucket/sourceKey/destinationKey/source`).
2. Per object (4 at a time): download the PUBLIC Supabase URL, SHA-256 + MD5, size must equal the manifest, MD5 must equal a single-part Supabase eTag.
3. `wrangler r2 object get --remote`: if R2 already holds identical bytes → `verified-existing`; if missing → `wrangler r2 object put --remote`, then `get` again and compare size + SHA-256 + MD5 → `copied-and-verified`.
4. An R2 object whose bytes differ from the source is refused unless `--update-changed` (re-sync).
5. `--verify` re-downloads both sides for every object and writes nothing; it warns when the manifest is over 1 h old.
6. Safety: wrangler runs with `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_API_KEY` / `CLOUDFLARE_EMAIL` removed and `CLOUDFLARE_ACCOUNT_ID=e329b099…` pinned; `wrangler whoami` must list only that account or the run aborts. Source downloads and wrangler calls time out after 5 min. `--refresh` is refused with `--execute` / `--verify`. Unit tests: `tests/unit/r2-wrangler-copy.test.ts`.

Logs: `/Users/koss/.clickit-checks/r2-copy-20261020-1333.log` (pass 1), `…-1353-pass2.log` (pass 2), each ending in `exit=`.
Temp bytes lived in `.tmp/r2-copy-work/` and are removed by the script; the manifest stays in `.tmp/` locally.

## Re-sync later (the frozen Vercel admin still writes to Supabase only)

From the main checkout (any folder with this script works; needs the Supabase CLI login and the ClickitStory wrangler login):

```bash
npm run r2:copy -- --refresh
npm run r2:copy -- --execute --update-changed
npm run r2:copy -- --verify
```

The last command must end with `"failures": 0`. Notes:
- `--update-changed` overwrites R2 objects whose Supabase source changed under the same key (e.g. `site-assets/settings/favicon.png`). Supabase is the source of truth until go-live.
- Objects deleted in Supabase are NOT deleted in R2 (wrangler 4 has no object list). Under R2-first such orphans would still be served at their old URL. The app uses versioned file names and DB references, so this is low risk; list orphans with the S3 API before go-live if it matters.
- A full run takes about 20 min (each object is two downloads plus wrangler calls).

## Go-live step for the controller (job C, Phase 2)

Only when the Cloudflare app is the one taking uploads (the frozen Vercel admin would keep writing to Supabase only):

1. Job C app live with R2 writes enabled: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_R2_BUCKET=clickit-media`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `NEXT_PUBLIC_MEDIA_CUTOVER_READY=verified` set on the app Worker (gate in `workers/media/DNS-PLAN.md` §5d), or uploads paused.
2. Fresh re-sync (the three commands above), `--verify` → `"failures": 0`.
3. Re-run `npm run r2:copy -- --verify` immediately before the `--env r2` deploy (no uploads in between) → `"failures": 0` and no manifest-age warning.
4. `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 deploy -c workers/media/wrangler.jsonc --env r2`
5. Check: `curl -sI https://media.clickitstory.ae/site-assets/settings/og.png | grep -i x-media-source` → `r2`; `npm run media:health -- --verify-bytes` all ok.
6. Rollback: `… deploy -c workers/media/wrangler.jsonc --env supabase-only`.

## Frozen live admin: do uploads fail? (read-only check, nothing tested on the live site)

Yes, almost certainly, unless the four R2 variables were set in the Vercel project (cannot be read: no Vercel access).

- The live HTML (`GET https://www.clickitstory.ae/en`) renders `https://media.clickitstory.ae/site-assets/settings/favicon.png?v=…`, `og.png`, social icons, while the live DB rows (`app_config`, `shows`, `profiles`, `show_cast`) all still hold `https://lajguozmtissnnfccmej.supabase.co/…` URLs. That rewrite only happens in `toPublicR2MediaUrl` / `getPublicMediaOrigin` (`src/lib/supabase-media.ts`) when `NEXT_PUBLIC_MEDIA_ORIGIN` is a valid https origin **and** `NEXT_PUBLIC_MEDIA_CUTOVER_READY=verified`. Nothing in `src/` hardcodes `media.clickitstory.ae`. So both are baked into the frozen build (handover D also saw these URLs before the Worker existed).
- With both set, `mirrorRequired()` is true and `assertPublicMediaWriteReady()` (`src/lib/r2-media-core.ts:170`) throws unless `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` are all set. R2 was enabled on the account only today and no R2 API token is known, so they are most likely unset.
- It is the first line (after `assertAdmin`) of every media write: admin `uploadArtwork`, `createHeroVideoUpload`, `createPreloaderVideoUpload`, `createShowVideoUpload`, `uploadSiteImage`, `uploadSocialIcon`, `uploadCastImage`, and viewer `uploadAvatar`.
- What the admin sees: the action returns `{ success: false, error: err.message }`, and the upload UI shows a red toast, e.g. in `artwork-upload-zone.tsx` "Upload failed: R2 media mirroring is required while NEXT_PUBLIC_MEDIA_ORIGIN is enabled. Configure CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_BUCKET, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY." Nothing reaches Supabase. Non-media edits (titles, episodes, links) are unaffected.
- Side effect: if uploads are blocked, Supabase cannot drift from R2 through the admin, which makes the re-sync before go-live cheap. If the Vercel project does have the four variables (and a bucket named `clickit-media`), uploads would now succeed and mirror into this new bucket.
- Caveat: the frozen build's exact commit is unknown; this reading is from `main` (code unchanged since 81371cb, 2026-08-01).

## Not verified

- Stored Content-Type / Cache-Control read back from R2 (wrangler `get` returns bytes only). They were passed on `put`; the Worker falls back to `guessContentType` and decides Cache-Control itself.
- Serving through the Worker from R2 (`--env r2` is not deployed, by design).
- Vercel env values (no access).
