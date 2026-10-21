# Phase 2 code scan (read-only, 2026-10-20)

Line numbers from grep on the branch cut from main at be6e221; they drift (Phase 01.1 rewrites `admin/actions.ts`). Match by symbol.

## 1. Vercel-only code
- BotID: `next.config.ts` import `withBotId` + wrapping export. `src/proxy.ts` `BOTID_PREFIX`, `isBotIdPath`, rewrite branch. `src/components/auth/botid-init.tsx` (`botid/client/core`). `src/app/[locale]/(viewer)/auth/page.tsx` (renders BotIdInit). `src/app/[locale]/(viewer)/auth/actions.ts` `checkBotId` (log-only). `src/app/actions/contact.ts` `checkBotId` (log-only).
- Analytics: `src/app/[locale]/layout.tsx` imports `@vercel/analytics/next`, `@vercel/speed-insights/next`.
- `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`: `src/lib/site-url.ts`.
- Client IP: `src/app/actions/contact.ts` `getClientIp` (`x-forwarded-for`, `x-real-ip`).
- `vercel.json` (fra1, crons), `.vercelignore`, `scripts/check-cron.sh`.
- CSP Vercel hosts in `next.config.ts` script-src and connect-src.

## 2. Images
- 25 files import `next/image`. `unoptimized` already on: `components/admin/cast-editor.tsx`, `components/admin/settings/image-upload-field.tsx`, `components/admin/settings/footer-editor.tsx`, `components/layout/footer.tsx`.
- No custom loader. `images` config: avif/webp, minimumCacheTTL 30d, remotePatterns YouTube/Unsplash/Picsum/hardcoded Supabase host/media origin.
- `sharp`: static import at top of `src/app/[locale]/admin/actions.ts`, used by `uploadArtwork` (WebP/PNG re-encode). Breaks the whole `'use server'` module on workerd.

## 3. Storage and media
- Supabase Storage calls in `admin/actions.ts`: list (1), remove (3), upload (7), download (3), getPublicUrl (7). Also `(viewer)/profile/actions.ts` avatars, `api/cron/cleanup-media/route.ts` remove.
- `src/lib/r2-media-core.ts`: `@aws-sdk/client-s3`, `node:crypto randomUUID`, `Buffer`; `mirrorPublicMediaObject` dual-write after Supabase upload. `src/lib/r2-media.ts` wrapper. Callers: `uploadArtwork`, `saveHeroVideoUpload`, `savePreloaderVideoUpload`, `saveShowVideoUpload`, `uploadSiteImage`, `uploadSocialIcon`, `uploadCastImage`.
- `src/lib/supabase-media.ts` helpers; callers `src/lib/config.ts`, `src/lib/queries.ts`, `components/layout/entry-preload.tsx`, `components/primitives/hero-video-with-audio.tsx`, `components/landing/landing-hero.tsx`, `components/admin/hero-media-picker.tsx`, `components/admin/settings/preloader-video-field.tsx`, ~15 avatar/image components.
- `src/app/api/cdn/storage/route.ts` + `src/lib/storage-range-proxy.ts` (fetch-only range proxy for Supabase videos).
- DB media URL columns (`src/lib/database.types.ts`): `app_config` favicon_url, favicon_dark_url, og_image_url, hero_video_url, hero_video_mobile_url, preloader_video_url, auth_image_url; `shows` hero_url, hero_image_mobile_url, poster_url, card_image_url, logo_url, hero_video_url, hero_video_mobile_url; `show_cast.image_url`; `profiles.avatar_url`; `shorts.thumbnail_url`; view `episodes_view.show_poster_url`. (Also check legal/FAQ HTML and footer/social JSON in app_config at copy time.)

## 4. Upload paths
- `bodySizeLimit: '55mb'`.
- File-in-FormData actions: `uploadArtwork`, `uploadSiteImage`, `uploadSocialIcon`, `uploadCastImage` (admin), `uploadAvatar` (viewer profile, 2 MB cap).
- Videos already use a signed-upload pattern: `createHeroVideoUpload` / `createPreloaderVideoUpload` / `createShowVideoUpload` return a Supabase signed URL; `save*` then downloads from Supabase and mirrors to R2.
- `src/lib/mp4-audio.ts` uses `File.slice` (Workers-safe).

## 5. `src/proxy.ts`
- No runtime export (Node). next-intl routing, `updateSession` (`src/lib/supabase/middleware.ts`), coming-soon gate (`getAppConfig`), auth gate, admin gate (`checkIsAdmin`), BotID rewrite. No direct Node-only API.

## 6. Cron routes
- `api/cron/cleanup-media/route.ts`: plain string compare on `Bearer ${CRON_SECRET}`; deletes unreferenced Supabase Storage objects.
- `api/cron/publish-scheduled/route.ts`: same compare; publishes due episodes; `revalidatePath('/')`, `('/coming-soon')`.

## 7. Rate limiting
- `contact.ts` `withinRateLimit` counts rows in Supabase `rate_limits` (migration `20260530000002_rate_limits.sql`); fails OPEN. Used by support + newsletter. Auth actions have no rate limit.

## 8. Turnstile targets (none today)
- Sign-in `auth/actions.ts signInAction` + `components/auth/login-form.tsx`; sign-up `signUpAction` + `signup-form.tsx`; reset `login-form.tsx` `resetPasswordForEmail` + `reset-password-form.tsx`; contact `submitSupportMessage` + `components/support/contact-form.tsx`; newsletter `subscribeToNewsletter` + `components/layout/newsletter-signup-form.tsx`. No OTP yet.

## 9. Caching
- ~33 `{ revalidate, tags }` cached reads (`queries.ts`, `config.ts`, `supabase/public.ts`), ~48 `revalidatePath`, `updateTag` in admin actions, publish cron, settings. No `runtime` exports; one `force-dynamic` (admin audit page).

## 10. Env
- App: NEXT_PUBLIC_SITE_URL, VERCEL_PROJECT_PRODUCTION_URL, VERCEL_URL, GOOGLE_TRANSLATE_API_KEY, NEXT_PUBLIC_MEDIA_ORIGIN, NEXT_PUBLIC_MEDIA_CUTOVER_READY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, RESEND_API_KEY, RESEND_FROM_EMAIL. R2: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY. No `.env.example`.

## 11. Tests and CI
- `tests/unit/` (6 files incl. `r2-media-migration`, `r2-media`, `storage-range-proxy`), `tests/e2e/` 8 Playwright specs.
- `.github/workflows/supabase-migrations.yml` runs `supabase db push --include-all` on push to main touching `supabase/migrations/**` (Phase 1 SAFE item; flag to control).

## 12. Node-only in request paths
- `sharp` (admin actions), `r2-media-core.ts` (`@aws-sdk/client-s3`, `node:crypto`, `Buffer`). No `fs`/`child_process`. No `timingSafeEqual`.
