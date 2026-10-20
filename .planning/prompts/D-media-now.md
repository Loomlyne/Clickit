# Job D: make live images load now (media.clickitstory.ae)

Why: the frozen Vercel build (Koss has no Vercel access; deploys blocked) renders every image as `https://media.clickitstory.ae/<supabase-bucket>/<key>` (e.g. `/site-assets/settings/...`) because `NEXT_PUBLIC_MEDIA_CUTOVER_READY=verified` is baked in. `media.clickitstory.ae` has no DNS record (zone NS = ns3/ns4.tasjeel.ae; no Cloudflare zone exists). The Supabase originals at `https://lajguozmtissnnfccmej.supabase.co/storage/v1/object/public/<bucket>/<key>` return 200.
Fix without Vercel and without a DB rewrite: serve `media.clickitstory.ae` from Cloudflare.

Base: `origin/main`. GSD: `/gsd-quick`.
Build:
1. A small media Worker (e.g. `workers/media/`, its own `wrangler.jsonc` with `account_id = e329b099b6e4272fc0915a99832e47fe`): GET/HEAD `/<bucket>/<key>` → R2 binding first (bucket `clickit-media`, layout `<bucket>/<key>`), on miss fetch the Supabase public original, stream it with correct content-type, Range support, long cache headers, `X-Content-Type-Options: nosniff`, CSP `default-src 'none'; style-src 'unsafe-inline'` (SVG safety). Allow-list the Supabase buckets that exist; 404 otherwise. Unit tests. This is the same media Worker Phase 2 (job C) will use; keep it in its own folder so C imports it.
2. Prove it on workers.dev: every image URL in the live HTML (`curl -s https://www.clickitstory.ae/en | grep -o 'https://media.clickitstory.ae/[^"]*'`) returns 200 with the right bytes via the workers.dev host (Supabase fallback is enough before R2 is on).
3. DNS plan (read-only research, no changes): copy of every current record of clickitstory.ae (www, apex, MX/Zoho, SPF/DKIM/DMARC, Resend, verification TXT) from public DNS; the Cloudflare zone import list with every record DNS-only (grey) so www stays on Vercel; explain the stray Cloudflare NS pair `ignat`/`nataly` (check `dig NS clickitstory.ae @<.ae registry servers>` and whois) and whether a pending zone exists elsewhere; then the Worker custom domain `media.clickitstory.ae`.
4. A media-health script: fetch the live home + 3 pages, HEAD every image URL, exit non-zero on any non-200 (later run on a schedule).

Owner steps (stop with `NEEDS KOSS:` and numbered clicks, one at a time): enable R2 in the ClickitStory dashboard; create bucket `clickit-media`; deploy the media Worker to workers.dev (give the exact command); add zone clickitstory.ae; change NS at tasjeel.ae; attach the custom domain. Never change a DNS record yourself. Optional later: copy objects to R2 (`npm run r2:media` dry run first, `0 put` check) on Koss's word.
Open one PR for the Worker + scripts + DNS plan doc.
