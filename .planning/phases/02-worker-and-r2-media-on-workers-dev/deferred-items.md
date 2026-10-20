# Deferred items (phase 02)

Found during plan 02-01. Out of scope for that plan; not fixed.

1. **Unknown path under an allow-listed prefix returns 500.** `GET /en/auth/sign-in` (no such route) gives 500 on `next start` (Next 16.4.2, local Supabase) and under OpenNext preview; live site gives 404. Likely the root `src/app/not-found.tsx` (`getTranslations` without a locale in the request context). Unknown whether the Next 16.2.9 to 16.4.2 upgrade caused it. Static misses (`/_next/static/x.js`) become 500 under preview for the same reason. Look at it before any gate test asserts 404.
2. **Four `react-hooks/set-state-in-effect` findings** (now warnings): `src/components/admin/shorts-table.tsx:73`, `src/components/admin/shows-table.tsx:87,126`, `src/components/ui/carousel.tsx:103`. Refactor and restore the rule to error.
3. **npm `supabase` package binary is killed on start (exit 137)** in this worktree; Homebrew `supabase` works. Check the install-script approval (npm 11 `allowScripts`) before relying on `npx supabase`.

Found during plan 02-13 (out of scope; not fixed).

4. **Newsletter form without `?show=` never submits.** `NewsletterSignupForm` registers hidden inputs `interestSlug` / `interestTitle` with `value=""`; `newsletterSignupSchema` has `.min(1).optional()` on both, so an empty string fails validation and `handleSubmit` stops silently (only the email error is rendered). Seen on local preview at `/en/updates` (no status, no network call); with `/en/updates?show=<slug>` the same form submits and shows the status line. Fix: send `undefined` (not `""`) for empty hidden values, or accept `""` in the schema. Predates 02-13.
5. **`/en/updates` (the only page that renders `NewsletterSignupForm` today) is behind the sign-in gate.** There is no footer newsletter on this branch, so the signed "footer newsletter" placement is applied through the shared form component and was checked on `/en/updates` only.
6. **Local preview CSP blocks the local Supabase** (`connect-src` / `img-src` allow only `https://*.supabase.co`), so browser-side Supabase calls (password reset request) and Supabase-hosted images fail on `cf:preview` against the local stack. 02-14 owns the CSP builder: add the local origin for preview builds only.

_Item 6 resolved by plan 02-14: the preview build CSP now carries the local Supabase and loopback media origins (preview target only)._
