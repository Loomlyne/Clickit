# clickitstory.ae DNS plan: serve media.clickitstory.ae from Cloudflare

Read-only research, 2026-10-20 10:29 UTC. No DNS record was changed.
Sources: authoritative `ns3.tasjeel.ae` / `ns4.tasjeel.ae`, the .ae registry
servers (`ns1.aedns.ae`, `ns2.aedns.ae`, `nsext-pch.aedns.ae`, `ns4.apnic.net`),
public resolvers 8.8.8.8 and 1.1.1.1, and `whois.aeda.net.ae`.

## 1. Why images are broken

The frozen Vercel build renders every image as
`https://media.clickitstory.ae/<bucket>/<key>`. `media.clickitstory.ae` has no
DNS record, so the browser cannot resolve it. `npm run media:health` against the
live site on 2026-10-20: **0/54 media URLs ok**. The Supabase originals all
return 200.

## 2. Current records (copy of public DNS)

Zone SOA: `ns3.tasjeel.ae. servers.tasjeel.ae. 2026052908 3600 1800 1209600 86400`
(last change 2026-05-29). Zone transfer (AXFR) is refused, so hostnames can only
be found by asking for them. Probed: apex, `www`, `media`, `mail`, `webmail`,
`smtp`, `autodiscover`, `autoconfig`, `resend`, `send`, `bounces`, `em`,
`_dmarc`, `_domainkey`, `resend._domainkey`, `zmail._domainkey`,
`zoho._domainkey`, `google._domainkey`, `default._domainkey`,
`selector1._domainkey`, `api`, `app`, `admin`, `cdn`, `img`, `images`,
`static`, `assets`, `staging`, `dev`, `blog`, `shop`, `ftp`, `cpanel`, `_vercel`.

| Name | Type | Value | Purpose |
|---|---|---|---|
| `clickitstory.ae` | A | `216.198.79.1` | Vercel (apex) |
| `www.clickitstory.ae` | CNAME | `ba211fb55cf67415.vercel-dns-017.com.` (→ 216.198.79.65, 64.29.17.65) | Vercel (site) |

Nothing else answers:

- **No MX, no SPF/TXT, no DKIM, no DMARC** at the apex or the usual selectors.
  The domain does not receive or send mail today. Zoho and Resend are not set up
  on `clickitstory.ae` (the app's `no-reply@clickitstory.ae` exists only in
  planning docs; contact addresses in the app are `@clickitstory.com`).
- No AAAA, no CAA, no `_vercel` verification TXT.
- **No DNSSEC**: no DS at the registry, no DNSKEY at Tasjeel. Nothing to turn
  off before moving nameservers.

Owner check before step 5c: a screenshot of the Tasjeel DNS panel confirms no
hostname exists that the probe list missed.

## 3. The stray Cloudflare nameservers `ignat` / `nataly`

`whois clickitstory.ae` and all four .ae registry servers delegate the domain to
**four** nameservers:

```
ns3.tasjeel.ae
ns4.tasjeel.ae
ignat.ns.cloudflare.com
nataly.ns.cloudflare.com
```

- `ignat` and `nataly` answer **REFUSED** for `clickitstory.ae`, `www` and
  `media`. No active Cloudflare zone stands behind them: a lame delegation.
- `invios.online` is served by the same pair (`ignat` + `nataly`). Cloudflare
  gives each account a fixed nameserver pair, so the pair belongs to the
  **Invios Cloudflare account** (or whichever account owns `invios.online`).
- Most likely history: `clickitstory.ae` was added to that account at some
  point, its two nameservers were added at Tasjeel next to the Tasjeel pair
  instead of replacing them, and the zone was then deleted or never activated.
  A zone that is still *pending* in that account would also answer REFUSED, so
  from outside it cannot be told apart from a deleted one.
- Effect today: about half of first lookups go to a refusing server and must
  retry on Tasjeel. Slower first loads and intermittent failures on some
  resolvers (1.1.1.1 returned an empty answer for the apex once during this
  check; Google returned the record).
- A pending zone in another account does not block adding the zone to the
  ClickitStory account. The ClickitStory account will most likely get a
  **different** pair, and the fix at Tasjeel replaces all four entries with that
  pair, which removes the stray pair too.
- Owner check (read-only): in the Invios Cloudflare dashboard, is a
  `clickitstory.ae` zone listed? If yes, remove it **after** the ClickitStory
  zone is Active, so nobody activates the wrong one.

## 4. Cloudflare zone import list (ClickitStory account, Free plan)

Every record **DNS-only (grey cloud)** so `www` and the apex keep going straight
to Vercel, exactly as today.

| Type | Name | Content | Proxy | TTL |
|---|---|---|---|---|
| A | `@` | `216.198.79.1` | DNS only | Auto |
| CNAME | `www` | `ba211fb55cf67415.vercel-dns-017.com` | DNS only | Auto |

When Cloudflare scans the old zone during "Add a domain", it may guess extra
records or set the proxy on. Keep only the two rows above, both grey. Do not
add `media` by hand: attaching the Worker custom domain creates it.

Zone settings to leave alone: DNSSEC off (enable later, as its own step),
SSL/TLS mode is irrelevant for DNS-only records.

Why Vercel keeps working: with DNS-only records, visitors still reach Vercel's
IPs directly, and Vercel keeps renewing the `www` certificate over HTTP. No
change in the Vercel project is needed (and none is possible: access is lost).

## 5. Order of owner steps (one at a time, controller relays each)

a. **R2 (optional for this fix)**: enable R2 in the ClickitStory dashboard and
   create bucket `clickit-media`. Images go live without it; the Worker serves
   the Supabase originals until objects are copied (`npm run r2:media` dry run
   first, then `--execute` on Koss's word).

   **Gate before any default-env (R2-first) deploy:** prove that the app's
   `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_R2_BUCKET` (the values the admin
   uploads mirror to) point at the ClickitStory account `e329b099…` and bucket
   `clickit-media`. Otherwise an admin overwrite of a fixed key (avatars,
   `settings/og.png`, the hero video) updates Supabase but not this bucket, and
   the Worker would keep serving the old bytes (with a one-year immutable cache
   on `?v=` URLs). Until that is proven, deploy only `--env supabase-only`.

b. **Deploy the Worker to workers.dev**: done 2026-10-20, https://clickit-media.clickitstory.workers.dev
   (account subdomain `clickitstory`), `supabase-only`, 54/54 media URLs byte-identical. Redeploy commands:
   - without R2: `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 deploy -c workers/media/wrangler.jsonc --env supabase-only`
   - with R2 on, the bucket created and the gate in step a passed: `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 deploy -c workers/media/wrangler.jsonc --env=""`

   Proof: `npm run media:health -- --media-origin https://clickit-media.clickitstory.workers.dev --verify-bytes --timeout 180`
   must print every URL ok with `bytes=match`.

c. **Add the zone**: Cloudflare dashboard (ClickitStory account) → Add a domain
   → `clickitstory.ae` → Free → keep only the two DNS-only records in section 4
   → note the two nameservers Cloudflare assigns.

   **Hard gate before step d** (replace `<ns1>`/`<ns2>` with the assigned pair):
   - `dig +short A clickitstory.ae @<ns1>.ns.cloudflare.com` → `216.198.79.1`
   - `dig +short CNAME www.clickitstory.ae @<ns1>.ns.cloudflare.com` → `ba211fb55cf67415.vercel-dns-017.com.`
   - the same two queries against `<ns2>` give the same answers.
   If any answer is empty or different, stop and fix the zone records first.

d. **Change nameservers at Tasjeel**: replace all four entries (`ns3.tasjeel.ae`,
   `ns4.tasjeel.ae`, `ignat.ns.cloudflare.com`, `nataly.ns.cloudflare.com`) with
   the two from step c. Then press **Check nameservers now** in the Cloudflare
   dashboard right away.

e. **Wait for Active**: `dig +norec NS clickitstory.ae @ns1.aedns.ae` shows only
   the new pair, and the dashboard shows the zone Active. Check
   `curl -sI https://www.clickitstory.ae/en` is still 200 from Vercel.

f. **Attach the custom domain**: uncomment the `routes` line in
   `workers/media/wrangler.jsonc` and redeploy (step b command), or Dashboard →
   Workers → `clickit-media` → Domains → Add `media.clickitstory.ae`.
   Cloudflare creates the `media` record and its certificate.

g. **Prove it**: `npm run media:health` (no flags) prints every media URL ok.
   Then schedule it (cron or Worker cron) as the standing check.

Rollback for d: set the nameservers at Tasjeel back to `ns3.tasjeel.ae` and
`ns4.tasjeel.ae`; the records there are unchanged. Plan for **up to about 24
hours** to settle: the registry delegation TTL is 3600 s, but Tasjeel serves its
own NS records with TTL 86400 s and Cloudflare's NS records are 86400 s too, so
resolvers that cached either side can keep it for a day. This is why the hard
gate before step d matters: the Cloudflare zone must already answer correctly.
