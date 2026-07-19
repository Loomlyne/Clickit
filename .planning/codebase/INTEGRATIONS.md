---
last_mapped_commit: de36f69
---
# External Integrations

**Analysis Date:** 2026-07-19

## APIs & External Services

**Backend platform:**
- Supabase, database, authentication, realtime, and public object storage for the viewer and admin app.
  - SDK/Client: `@supabase/ssr` and `@supabase/supabase-js` via `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`, and `src/lib/supabase/admin.ts`.
  - Auth: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`.

**Video and metadata:**
- YouTube, embedded playback, thumbnails, IFrame API duration detection, and administrative Data API metadata lookup.
  - SDK/Client: native browser embeds and fetches in `src/lib/youtube.ts`, `src/components/watch/youtube-player.tsx`, and `src/app/api/youtube-meta/route.ts`.
  - Auth: the YouTube Data API key is held server-side in the `app_config.youtube_api_key` database column, read by `src/lib/config.ts`; it is not exposed in public config reads.
- Google Cloud Translation API v2, automatic English-to-Arabic translation for admin content and fallback viewer text.
  - SDK/Client: direct server-side `fetch` in `src/lib/translate.ts`, with per-text Next cache for 30 days.
  - Auth: `GOOGLE_TRANSLATE_API_KEY`.

**Email:**
- Resend, transactional support and contact-email delivery from `src/app/actions/contact.ts`.
  - SDK/Client: direct HTTPS POST implementation in `src/lib/resend.ts`, not an installed Resend package.
  - Auth: `RESEND_API_KEY`; sender can be configured with `RESEND_FROM_EMAIL`.

**Analytics and bot protection:**
- Vercel Analytics and Speed Insights, mounted in `src/app/[locale]/layout.tsx`.
  - SDK/Client: `@vercel/analytics` and `@vercel/speed-insights`.
  - Auth: Vercel deployment context; no application environment variable is read.
- Vercel BotID, configured through `withBotId` in `next.config.ts` and checked before password sign-in or sign-up in `src/app/[locale]/(viewer)/auth/actions.ts`.
  - SDK/Client: `botid`.
  - Auth: Vercel BotID edge challenge headers.
- Google Analytics and Meta Pixel, conditionally injected from validated IDs stored in Supabase `app_config`, in `src/app/[locale]/layout.tsx`.
  - SDK/Client: provider scripts loaded by `next/script`.
  - Auth: no API key is used by the client scripts; IDs are validated before interpolation.

## Data Storage

**Databases:**
- Supabase PostgreSQL, schema and RLS policies tracked in `supabase/migrations/`.
  - Connection: browser and server requests use `NEXT_PUBLIC_SUPABASE_URL`; CI migration access uses the GitHub Actions secret `SUPABASE_DB_URL` in `.github/workflows/supabase-migrations.yml`.
  - Client: typed generated database interface at `src/lib/database.types.ts`.

**File Storage:**
- Supabase Storage public buckets: `show-artwork`, `site-assets`, and `avatars`, created and policy-controlled by `supabase/migrations/20260401000002_create_storage.sql`, `supabase/migrations/20260408000002_create_avatars_storage.sql`, and `supabase/migrations/20260508000000_fix_site_assets_video_uploads.sql`.
- `src/app/api/cdn/storage/route.ts` proxies allowlisted public Supabase objects through Vercel with range-request support and a one-year edge cache.

**Caching:**
- Next.js Data Cache and `unstable_cache` for translated text in `src/lib/translate.ts` and server data queries in `src/lib/queries.ts`.
- Vercel edge cache is explicitly used for Supabase media through `src/app/api/cdn/storage/route.ts`.

## Authentication & Identity

**Auth Provider:**
- Supabase Auth, password sign-in and sign-up through Server Actions in `src/app/[locale]/(viewer)/auth/actions.ts`.
  - Implementation: `@supabase/ssr` cookie-backed clients, session refresh in `src/lib/supabase/middleware.ts`, and route access control in `src/proxy.ts`.
  - Admin operations use a service-role client only in server-side code, `src/lib/supabase/admin.ts`.

## Monitoring & Observability

**Error Tracking:**
- Not detected.

**Logs:**
- Server routes and actions use `console.error` and `console.warn`, including cron routes in `src/app/api/cron/` and BotID-gated auth actions.
- Vercel Analytics and Speed Insights are enabled from `src/app/[locale]/layout.tsx`.

## CI/CD & Deployment

**Hosting:**
- Vercel, configured by `vercel.json` for `fra1` and cron execution.

**CI Pipeline:**
- GitHub Actions workflow `.github/workflows/supabase-migrations.yml` deploys committed Supabase migrations on pushes to `main` that change `supabase/migrations/**`.

## Environment Configuration

**Required env vars:**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` for Supabase.
- `CRON_SECRET` for `src/app/api/cron/cleanup-media/route.ts` and `src/app/api/cron/publish-scheduled/route.ts`.
- `GOOGLE_TRANSLATE_API_KEY` for `src/lib/translate.ts`.
- `RESEND_API_KEY` for `src/lib/resend.ts`; `RESEND_FROM_EMAIL` is optional.

**Secrets location:**
- Local runtime values are expected in `.env.local`, present but not inspected.
- Production values are configured in the Vercel dashboard; the migration database URL is a GitHub Actions repository secret named `SUPABASE_DB_URL`.
- The YouTube Data API key is managed as an admin-only field in Supabase `app_config`, guarded in `src/lib/config.ts` and `src/app/api/youtube-meta/route.ts`.

## Webhooks & Callbacks

**Incoming:**
- `src/app/auth/callback/route.ts` is a Supabase Auth callback route.
- `src/app/api/cron/cleanup-media/route.ts` and `src/app/api/cron/publish-scheduled/route.ts` accept Vercel Cron requests only when the `CRON_SECRET` bearer token matches.

**Outgoing:**
- `src/lib/resend.ts` posts transactional messages to Resend.
- `src/lib/translate.ts` posts translation requests to Google Cloud Translation API.
- `src/app/api/youtube-meta/route.ts` fetches YouTube Data API v3 metadata for authenticated administrators.

---

*Integration audit: 2026-07-19*
