# Phase 1: live read-only audit (SAFE-04, SAFE-05)

Read: 2026-10-20 13:17–13:18 CET, project `lajguozmtissnnfccmej` (Clickit Story, ap-southeast-1, Postgres 17.6).
Path: `supabase db query --linked --project-ref lajguozmtissnnfccmej -f <file>` (Supabase CLI 2.119.0, Management API, the CLI login on Koss's Mac).
Statements: SELECT only (files in `audit/`, raw results next to them). No INSERT/UPDATE/DELETE/DDL was sent.
Side effect to know: the CLI prints "Initialising login role..." on each call. Supabase's CLI creates a short-lived login role on the project to run the query; that is Supabase's own mechanism, not a data or schema change made by this session. Three calls were made.

## 1. Applied migrations vs files — MATCH

- Live `supabase_migrations.schema_migrations`: 58 versions. Repo `supabase/migrations/`: 58 files.
- Versions only on live: none. Files not applied on live: none. Version with a different name: none.
- So the next `supabase db push` would apply nothing old: `20260401000000_create_schema` (DROP block) and the seed migrations are recorded as applied and will not re-run **as long as this history row set stays intact**. The risk is a future history change (`migration repair`, rename, re-timestamp), which SAFE-01 neutralisation and the SAFE-02 guard cover.

## 2. Admin check used by RLS — `private.is_admin()`

- `private.is_admin()` exists, SECURITY DEFINER, body: `select (select auth.uid()) = (select admin_user_id from public.app_config where id = 1)`.
- `public.is_admin()`: gone (dropped by `20260724115941`).
- Policies: public schema 35 use `private.is_admin()`, 34 have no admin reference; storage 3 use `private.is_admin()`, 5 none.
- One storage policy checks admin **inline** instead of through the function: `Admin manage site-assets` (`auth.uid() = (select admin_user_id from app_config where id = 1)`). Same source, same result today; it must move with the function when Phase 5 introduces the two-admin `admins` table.
- `app_config.admin_user_id` is set (1 row). Single-admin model: today only one user is admin.

## 3. Every column holding a media URL (live hosts)

| Column | Live values |
|---|---|
| app_config.hero_video_url, hero_video_mobile_url, og_image_url, favicon_url, favicon_dark_url, auth_image_url | Supabase Storage (1 each) |
| app_config.preloader_video_url | null |
| app_config.live_stream_url | www.youtube.com (not media to move) |
| app_config.footer_content (jsonb) | 4 Supabase Storage URLs, plus instagram/youtube/tiktok links |
| shows.hero_url, hero_image_mobile_url, card_image_url | Supabase Storage (15 each) |
| shows.poster_url | 1 Supabase Storage, **3 picsum.photos (seed placeholders)**, 11 null |
| shows.logo_url, hero_video_url, hero_video_mobile_url | null (15) |
| show_cast.image_url | Supabase Storage (1) |
| profiles.avatar_url | Supabase Storage (1), null (1) |
| shorts.thumbnail_url | empty string (9) |
| categories.icon | icon names, not URLs (13), null (2) |
| episodes_view.show_poster_url | view over shows.poster_url |
| auth.users raw_user_meta_data.avatar_url | none (3 users) |

Other jsonb columns (`cta_copy`, `genre_config`, `feature_flags`, `top_ticker`) hold no http URLs. Storage buckets (all public): `show-artwork` 49 objects, `site-assets` 34, `avatars` 3.
Phase 3's URL rewrite must include `app_config.footer_content` (jsonb), not only text columns.

## 4. Fake seed data on live

- Example shorts from `seed_example_shorts` (incl. `dQw4w9WgXcQ`): 0 rows on live. Fake cast (Amina Rahman, Omar Haddad, Layla Mansour): 0 rows.
- 3 shows still have `picsum.photos` posters (seed placeholders). Cleanup is a live write: not this phase.
- Counts: shows 15 (15 active), seasons 13, episodes 39, shorts 9, show_cast 1, profiles 2, auth users 3.

## 5. Supabase plan and backups

- `supabase backups list`: `pitr_enabled: false`, `backups: []` (no scheduled backups listed), WAL-G enabled.
- Plan tier: not exposed by the CLI. An empty backup list with PITR off matches the Free plan, where no daily backup is downloadable. **[OWNER]** confirm plan and backup status in the dashboard (one numbered step), and treat "no restorable backup" as the working assumption: a local `pg_dump` before any live migration is required.

## 6. SAFE-05 — closed by the NS move (re-checked 2026-10-20 14:05 CET)

Registry (authoritative for `.ae`, no recursion):
```
dig +norec NS clickitstory.ae @ns1.aedns.ae  ->  jen.ns.cloudflare.com, brett.ns.cloudflare.com
dig +norec NS clickitstory.ae @ns2.aedns.ae  ->  brett.ns.cloudflare.com, jen.ns.cloudflare.com
```
Public resolvers 1.1.1.1 and 8.8.8.8: jen + brett only. jen/brett answer apex A (Cloudflare proxy IPs) and `www` CNAME `ba211fb55cf67415.vercel-dns-017.com`.

Stray pair ruled out:
- `ignat`/`nataly` are no longer in the registry delegation (`ns3/ns4.tasjeel.ae` are gone too).
- Asked directly, `ignat` and `nataly` now return the **same** zone as jen/brett: SOA `brett.ns.cloudflare.com. dns.cloudflare.com. 2417983238`, same apex A. A made-up zone on `ignat` gets REFUSED. So the only active Cloudflare zone for clickitstory.ae is the ClickitStory account's (Cloudflare's nameservers answer for any active zone); no other account holds a live rival zone. Earlier REFUSED answers (2026-10-04) were from before any active Cloudflare zone existed.
- Who first added ignat/nataly at the registry: not found, and no longer matters, because they are not delegated and serve no other zone.
