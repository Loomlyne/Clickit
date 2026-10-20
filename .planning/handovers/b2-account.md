# B2 account — design(b2-account): UI System pass

Branch `claude/design-b2-account-91fbe1` (base `main` merged in at `53e2598`). Signed picture: `.planning/design/b2-account-before-after.html` (Koss: "Signed as is", 2026-10-20).

## What changed (signed scope)
- `(viewer)/auth`: shared `PasswordField` (44px tabbable eye, right side in LTR / mirrors in RTL, strength meter on new-password fields), real `Button` for submits (blue hover gone), `AuthAlert` (8px / 12px radius, token red/green, `role=alert|status`), hero scrim, forgot-link under the field, terms phrases linked to `/terms` and `/privacy` (en + ar message markup only), tab triggers 44px, empty `<div data-turnstile-slot className="empty:hidden">` in sign-in, sign-up and forgot (Job C mounts Turnstile there; BotID untouched).
- `(viewer)/auth/reset-password`: calm panel (no blue backdrop / "CIT" watermark), real h1, description as paragraph, both fields with eye + strength meter, errors via `mapAuthError`.
- `(viewer)/profile`: 44px targets, real labels, inline errors (toasts kept), eye + strength on password change, permanent avatar camera badge, h2 section titles, 2-line history rows that fit 375px (no sideways scroll), RTL rail fade, empty-state "Watch Shows" buttons.
- Skeletons for auth and profile match the pages. Deleted unused `components/auth/show-collage.tsx`.
- Password minimum 8 for every new password (sign-up, reset, profile) via `components/auth/password-rules.ts`; sign-in only checks non-empty so older accounts still get in. `tErrors('passwordMin'|'nameMin')` now receive `{min}`.
- Review fixes (controller's reviewer, Opus): terms Label `block`; eye has fixed `aria-label` + `aria-pressed`; strength is `weak` below the minimum length; `signUpAction` rejects passwords under 8 server-side (returns `passwordMin`, shown localized); `auth-errors.ts` copy says 8; profile inline errors go through `mapAuthError`; scrims use the `--bg-0` token via `color-mix`; removed unused `auth.passwordStrengthAria`; `method="post"` on the auth forms.
- Shared files (B2 owns): `ui/tabs` (trigger `min-h-11`, list `h-auto`: **admin tabs also grow ~8px — B4 should look**), `ui/checkbox` (20px on every width, 6px radius). Not touched: `globals.css`, `ui/button.tsx`, `PortraitShowCard` (consumed only).

## Commits
`fc66f14` tabs · `370b278` checkbox · `cb562b5` PasswordField/AuthAlert/rules + unit test · `a2f73ab` auth · `c295aea` profile · `53e2598` merge of `origin/main`. Hand-over/PR commits follow.

## Deviations from the picture (no new copy invented)
- History progress shows "62%" (existing `progressLabel`), not "62% watched" (would need new en/ar copy).
- Added a "Watch Shows" button to the empty My List as well as Liked.

## Gates
`npm run gate:local` under the shared lock, 2026-10-20 11:36 CET: lint 0 errors (15 warnings, none new from B2 except the pre-existing avatar `<img>`), unit tests 78 pass / 0 fail (3 new in `tests/unit/password-rules.test.ts`), `next build` compiled and exit 0. Log: `/Users/koss/.clickit-logs/b2/gate.log` (`exit=0`). Build needs placeholder Supabase env (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, dummy keys) — without it `legal/[slug]` fails with `supabaseUrl is required` (unchanged code, same as B3). Merge commit of `origin/main` at `53e2598`; main had not moved after.

## Verified in a real dev server (placeholder Supabase env, 375px, Chrome pane; measured in the DOM)
- `/en/auth`: eye 44×44, tabbable, `aria-pressed` flips and input type toggles; tab triggers 44px; forgot link 44px; submit yellow rgb(255,204,0) 44px; form `method=post`; no horizontal scroll; one `data-turnstile-slot` per form.
- Sign-up: inline errors with `{min}` filled ("at least 8"); strength "weak" for `Ab1!` (short); two eyes; terms row 44px, checkbox 20px, sentence on one line in en and ar.
- `/ar/auth`: **found and fixed** — Radix `Tabs` forced `dir="ltr"` so the whole Arabic form rendered left-to-right (pre-existing). `auth-panel.tsx` now passes `dir={dirFor(locale)}`; afterwards the form is RTL and the eye sits on the left edge (the logical end), no overflow.
- `/en/auth/reset-password`: one h1 "Reset password", two 44px eyes, strength meter, no overflow.
- Profile pieces (header, account settings, history rows, rendered from a temporary preview route that is **not** committed): buttons 44px, avatar 80px target with camera badge, h1/h2 order, history rows 301px wide (no scroll), progress bar `aria-valuenow=62`, password change shows two labelled fields with 44px eyes, inline errors for short/mismatch, strength "strong" for `Abcdef1!`, email inline error `role=alert`. Arabic: eye on the left, badge mirrored, no overflow.

## NOT verified
- Anything needing a real Supabase session: real sign-in/sign-up/reset round trip, the actual `/profile` page (the pieces were rendered with mock data), My List / Liked rails with real posters.
- Hero scrim contrast over a real admin-uploaded image (no image in the placeholder env); desktop two-column layout was not re-measured after the changes.
- Screen-reader announcements (`role=alert` / `status`).

## Owner step (Koss) — Supabase Auth server-side password length
The app now enforces 8 characters in the browser, but Supabase Auth has its own minimum (default 6) that applies to API calls that skip our forms. Changing it on the live project is an owner step; I did not touch it.
1. Open the Supabase dashboard for project `lajguozmtissnnfccmej` → Authentication → Sign In / Providers → Email (the password settings; wording varies by dashboard version).
2. Set "Minimum password length" to 8 and save. Existing users keep working (the setting only checks passwords being set).

## UAT (type/click → expected), on the deployed preview
1. Open `/en/auth`, press Tab until the eye in the password field is focused → yellow ring; press Space → text shows, icon flips; click it again → hidden.
2. Sign In tab, enter `x@example.com` + a wrong password, submit → red alert "Email or password is incorrect." above the form, announced by a screen reader; button hover stays yellow→white (no blue).
3. Sign Up tab, type password `abc` and submit → "Password must be at least 8 characters" under the field; type `Abcdef1!` → strength bar 4/4, "strong"; confirm mismatch → "Passwords do not match".
4. Sign Up, click the words "Terms of Service" → `/terms` opens in a new tab and the form is untouched; click the sentence (not the links) → checkbox toggles; row is ≥44px tall.
5. Forgot password → enter an email, submit → green "Check your email" box.
6. Open the reset link from the email → page shows the "Reset password" h1, two fields with eyes, strength meter; set a new 8+ char password → toast "Password updated" and redirect.
7. `/en/profile` at 375px width → no horizontal scroll; Recently Watched rows show title, show line and progress under it.
8. Profile → Password "Change" → two labelled fields each with an eye; short password → inline error under the field (plus toast); matching 8+ → "Password updated".
9. Profile → Email "Change" → type `bad` → inline "Enter a valid email address".
10. Profile avatar shows a camera badge without hovering; tap → file picker.
11. `/ar/profile` and `/ar/auth`: eye sits on the left edge of the field, rail fade on the left of the lists' end side.
12. Job C check: DevTools → Elements → `[data-turnstile-slot]` exists in sign-in, sign-up and forgot, empty, no visible gap.

## Heads-up for B4 (shared UI changes)
- `ui/checkbox` lost `sm:size-4`: admin checkboxes (`categories-manager`, `reviews-table`, `shows-table`, `shorts-table`, `archive-table`) grow from 16px to 20px on desktop.
- `ui/tabs` trigger is now `min-h-11`: admin season pills grow 32px→44px and `season-tabs.tsx:127` `h-8!` no longer has effect (dead class, B4 file, left alone).

## Follow-ups (not in this PR)
- Expired/invalid reset link state (needs copy).
