# Quick 261019-img: images not showing

- `images.unoptimized: true`: images load straight from source and skip /_next/image (no sharp on Workers, no transform quota).
- The Supabase storage host comes from NEXT_PUBLIC_SUPABASE_URL; the legacy `lajguozmtissnnfccmej` host stays allowed.
- CSP img-src adds the Supabase origin only for local http.
- Gate: lint 0 errors (17 existing warnings), unit 75/75, build OK. The built config shows `unoptimized: true` and both Supabase hosts.
- Not done: deploy and live check (owner-gated). If images still fail after deploy, the DB rows point at objects missing from the connected project's Storage, which needs a data or bucket step Koss approves.

## Update 2026-10-19
- The live site is still on Vercel (`server: Vercel`), and its optimizer works (YouTube thumbnails return 200).
- Real cause of the broken images: the media URLs point at `media.clickitstory.ae`, which has no DNS record. The Supabase originals return 200.
- Koss: park this change until the planned Cloudflare move (Phase 2).
