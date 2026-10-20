Continue Clickit Story (CIT) from the cloud session of 2026-10-19. Read CLAUDE.md, CLAUDE.local.md, .hermes.md and .planning/STATE.md before editing anything. GSD rules apply: Koss signs discuss, plan, UAT and ship, so stop at each gate. Do not start a new GSD project, because .planning/ already exists.

## Get the work
1. `git fetch origin && git checkout fix/images-unoptimized-supabase-host && git pull`
   This branch is draft PR #16 (Loomlyne/Clickit). It carries `images.unoptimized: true`, the Supabase image host read from `NEXT_PUBLIC_SUPABASE_URL`, and the STATE.md blocker notes.
2. Install with `npm install`. Do not commit the lockfile: it is out of sync with package.json (`npm ci` fails on @swc/helpers). Fix that separately.
3. Run `npm run gate:local`. At handoff, lint had 0 errors, unit tests were 75/75 and the build passed.

## Facts found in the cloud session
- The live site was still served by Vercel (`server: Vercel`; the www CNAME points to vercel-dns). Koss says he has deleted Vercel. Check first with `curl -sI https://www.clickitstory.ae`. If it is down, restoring the site is the top priority.
- The live images are broken because pages request `https://media.clickitstory.ae/...`, and that hostname has no DNS record (NXDOMAIN). The zone's nameservers are ns3/ns4.tasjeel.ae, not Cloudflare.
- The files themselves are safe: the same paths return 200 on Supabase Storage at `lajguozmtissnnfccmej.supabase.co/storage/v1/object/public/<path>`.
- The rewrite to media.clickitstory.ae is env-driven at build time, not in the DB. `NEXT_PUBLIC_MEDIA_ORIGIN` plus `NEXT_PUBLIC_MEDIA_CUTOVER_READY=verified` make `src/lib/supabase-media.ts` rewrite the URLs. `scripts/migrate-supabase-media-to-r2.mjs` only copies files and never updates rows. The DB was not read; the cloud Supabase connector had no permission.
- Rule: never set `NEXT_PUBLIC_MEDIA_CUTOVER_READY=verified` until media.clickitstory.ae resolves and serves every file.

## Next: Phase 2 (Worker and R2 media on workers.dev)
The roadmap is in .planning/ROADMAP.md. Phase 2 depends on Phase 1. Proposed for Koss to sign at the discuss gate:
1. Order: start Phase 2 now. The Phase 1 CI gates go first as plan 1. The Phase 1 DNS move and Resend can run in parallel, but must finish before Phase 3.
2. Workers Free first and measure CPU per page. Workers Paid ($5/mo) is Koss's decision only.
3. Images: keep PR #16 (unoptimized) and add free-tier resizing later. R2 media only after media.clickitstory.ae works.
4. Deploys go through GitHub Actions with a token scoped to the ClickitStory Cloudflare account. Never use the default (Vamos) wrangler login. Check with `wrangler whoami` before any wrangler command.

## Owner steps (one numbered step at a time, then wait)
- Create a Cloudflare API token in the ClickitStory account and store it as GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Never paste it in chat.
- Create the R2, D1 and Queue resources and the media custom domain (needs the zone on Cloudflare, which is Phase 1 DNS).
- Live DB writes, DNS, secrets and production deploys are owner-gated.

## Start by
1. Checking whether the live site is up.
2. Then showing Koss the Phase 2 discuss decisions above and waiting for his signature.
