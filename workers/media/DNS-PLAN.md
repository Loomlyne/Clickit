# clickitstory.ae DNS: media.clickitstory.ae on Cloudflare

State as measured 2026-10-20 ~11:40 UTC. History of how it got here is in
section 6. DNS changes are owner steps (Koss); deploys are the controller's.

## 1. Why images are broken

The frozen Vercel build renders every image as
`https://media.clickitstory.ae/<bucket>/<key>`. That host has no DNS record.
`npm run media:health` on the live site: **0/54 media URLs ok**. The media
Worker on workers.dev serves all 54 byte-identical to the Supabase originals
(`npm run media:health -- --media-origin https://clickit-media.clickitstory.workers.dev --verify-bytes`).

## 2. Who serves the zone now

- Registrar: Tasjeel.ae (Host Arabia). Registry delegation (`ns1.aedns.ae`,
  `ns2.aedns.ae`): **`brett.ns.cloudflare.com`, `jen.ns.cloudflare.com` only**.
  One anycast mirror (`nsext-pch.aedns.ae`) still listed the old four at 11:37
  UTC and will catch up.
- Cloudflare zone `clickitstory.ae`, ClickitStory account, zone id
  `d8fa01b24f24653a29a0a56431072dc2`, Free plan: **Active** (11:39 UTC).
- **Tasjeel no longer serves the zone**: `ns3.tasjeel.ae` / `ns4.tasjeel.ae`
  answer REFUSED for `clickitstory.ae` (their DNS Manager shows "could not find
  any existing DNS zone"). Do not click "Yes, Create" there.
- No DNSSEC (no DS at the registry).

Records in the Cloudflare zone at 11:40 UTC:

| Name | Type | Value | Proxy | State |
|---|---|---|---|---|
| `www` | CNAME | `ba211fb55cf67415.vercel-dns-017.com` | **proxied (orange)** | wrong: must be DNS only, see 5a |
| `@` (apex) | AAAA | `100::` | proxied | placeholder for the redirect rule (11:52 UTC), see 5b |
| `media` | Worker custom domain | `clickit-media` | managed | **live since 11:46:28 UTC** |

Records that existed at Tasjeel before the move (public DNS, 10:29 UTC): apex
A `216.198.79.1`, `www` CNAME `ba211fb55cf67415.vercel-dns-017.com`. Nothing
else (no MX, SPF, DKIM, DMARC, AAAA, CAA, `_vercel` TXT) across 35 probed names.
The domain sends and receives no mail.

## 3. The stray `ignat` / `nataly` nameservers (resolved)

Before the move the registry listed four nameservers: `ns3`/`ns4.tasjeel.ae`
plus `ignat`/`nataly.ns.cloudflare.com`. The Cloudflare pair answered REFUSED (a
lame delegation) and is the pair `invios.online` uses, so it came from the
Invios Cloudflare account: the domain was added there once and never activated
or was deleted. The NS change at Tasjeel removed it. Optional owner check: in
the Invios Cloudflare account, delete any leftover `clickitstory.ae` zone so it
can never be activated by mistake.

## 4. Records the zone should have

| Name | Type | Value | Proxy | Why |
|---|---|---|---|---|
| `www` | CNAME | `ba211fb55cf67415.vercel-dns-017.com` | **DNS only (grey)** | the live site, until job C's site Worker replaces it |
| `@` | A `216.198.79.1` DNS only, **or** a redirect to `www` | see 5b | | Koss decides (no-Vercel rule) |
| `media` | Worker custom domain `clickit-media` | — | managed by Cloudflare | images |

`www` must not be proxied while it points at Vercel: Cloudflare's edge
certificate was not issued yet at activation (TLS handshake failure through
172.67.171.221 / 104.21.29.215), and Vercel renews its own certificate only
when traffic reaches it directly.

## 5. Owner and controller steps (one at a time)

a. **`www` to DNS only (urgent).** Cloudflare → `clickitstory.ae` → DNS →
   Records → `www` → Edit → click the orange cloud so it is grey → Save.
   Check: `dig +short +norec www.clickitstory.ae @brett.ns.cloudflare.com`
   returns the `vercel-dns-017.com` CNAME, not Cloudflare IPs; same at `jen`.

b. **Apex (Koss decides).** Either
   - redirect, no Vercel: DNS → Add record `AAAA`, name `@`, `100::`, proxied;
     then Rules → Redirect Rules → Create → "Redirect from root to WWW"
     template (`https://clickitstory.ae/*` → `https://www.clickitstory.ae/${1}`,
     301, preserve query string) → Deploy. Works once Cloudflare's edge
     certificate is issued for the apex; or
   - `A`, name `@`, `216.198.79.1`, DNS only → Save (Vercel; works in minutes).

   Check: `dig +short +norec A clickitstory.ae @brett.ns.cloudflare.com` (and
   `@jen`) returns the expected answer; `curl -sI https://clickitstory.ae/`
   is 200 or 301 to www.

c. **Attach `media.clickitstory.ae` (controller deploys).** `workers/media/wrangler.jsonc`
   has `"routes": [{ "pattern": "media.clickitstory.ae", "custom_domain": true }]`
   at the top level and in `env.supabase-only`. Command:
   `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 deploy -c workers/media/wrangler.jsonc --env supabase-only`.
   Cloudflare creates the `media` record and its certificate.
   Check: `curl -sI https://media.clickitstory.ae/site-assets/settings/favicon.png`
   → 200, `x-media-source: supabase`; then `npm run media:health` → every URL ok.

d. **R2 later (gate).** Enable R2 + create bucket `clickit-media`, copy objects
   (`npm run r2:media` dry run, then `--execute` on Koss's word). Before any
   default-env (R2-first) deploy, prove that the app writes every upload to
   this bucket: all four of `CLOUDFLARE_ACCOUNT_ID` (= `e329b099…`),
   `CLOUDFLARE_R2_BUCKET` (= `clickit-media`), `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY` are set in the running app, **and**
   `NEXT_PUBLIC_MEDIA_CUTOVER_READY=verified` (`src/lib/r2-media-core.ts`
   `getR2Configuration` / `mirrorRequired`). Otherwise an admin overwrite of a
   fixed key (avatars, `settings/og.png`, the hero video) updates Supabase but
   not R2, and the Worker keeps serving old bytes. Until proven: `supabase-only`.

e. **Standing check.** Schedule `npm run media:health` (cron or a Worker cron).

## Rollback

Tasjeel no longer serves the zone, so rolling back nameservers would take the
whole domain down. Roll back **inside Cloudflare** instead:
- a site problem after a record change: restore the record in the table in
  section 4 (Cloudflare DNS changes apply within the record TTL, Auto = 5 min);
- a media problem: Workers → `clickit-media` → Domains → remove
  `media.clickitstory.ae` (images go back to broken, the site is unaffected);
- a proxy problem: set the record to DNS only.

Moving nameservers back to Tasjeel would first need the zone re-created there
with the records above, and can take up to ~24 h to settle (Cloudflare NS TTL
86400 s).

## 6. History (2026-10-20, UTC)

- 10:29 Research: four registry nameservers (two lame), records only at Tasjeel.
- ~10:40 Worker `clickit-media` deployed to workers.dev (supabase-only).
- ~11:20 Zone added in Cloudflare (pending), assigned `brett` / `jen`.
- ~11:30 At Tasjeel, `ignat`/`nataly` replaced by `brett`/`jen`; the Tasjeel
  zone disappeared (ns3/ns4 REFUSED). Apex lost its record; `www` kept working
  from the Cloudflare zone.
- 11:37 `ns3`/`ns4` removed at Tasjeel; registry lists only `brett`/`jen`.
- 11:39 Zone Active. `www` found proxied; apex still missing.
- 11:45 Koss deployed `clickit-media` with the custom domain (version `a0f75eb6`).
- 11:46:28 `https://media.clickitstory.ae` serves through the Worker; all 54 live
  media URLs 200 via the Cloudflare edge. Resolvers that cached the old "no such
  host" answer catch up within their negative-cache time.
- 11:47 `www` (still proxied) answers 200 through the Cloudflare edge: the edge
  certificate is issued. Apex still has no record.
- 11:52 Apex `AAAA @ 100::` proxied added; redirect rules "root to WWW" and
  "HTTP to HTTPS" (templates) deployed. 11:54 checks: `https://clickitstory.ae/en`
  → 301 `https://www.clickitstory.ae/en` (path and query kept) → 200; `http://`
  → 301 to `https://`; `www` 200; `media` 200. No Vercel record added.
