# E perf + loading skeletons hand-over

Branch `claude/perf-skeletons-6f6fc9`, base `origin/main` cfbc8fb, then merged with `origin/main` d517ddc (Phase 1.1, no overlapping files). Signed picture: `.planning/perf/skeletons-before-after.png` (Koss: "signed go ahead", 2026-10-20). Numbers: `.planning/perf/BASELINE.md`.

## What changed
- `393396d` perf(viewer):
  - `/watch` hub: auth check and all catalog queries in one `Promise.all` (first-episode map chains off the featured promise inside it).
  - `/series/[slug]`: the auth check starts before the slug lookup; the "more shows" fallback starts before the signed-in wave.
  - `/watch/[episodeId]`: resume point joins the watchlist/like/progress wave (one round trip fewer).
  - Hero carousel: only slide 1 gets `priority`; the other slides load eager at normal priority (`cinematic-backdrop.tsx` `priority` prop, `hero-slide.tsx`, `hero-banner.tsx`).
- `5233f43` feat(viewer): new `src/components/skeletons/viewer-skeletons.tsx` (Hub, Series, MyList, Watch skeletons), `.skeleton-bone` in `globals.css` (token gradient, shimmer, mirrored in RTL, static for reduce-motion). The `loading.tsx` files for watch hub / browse / viewer root, series, my-list and episode render these.
- `7184890` docs: `.planning/perf/` (BASELINE.md, signed picture + mockup).
- No admin, next.config, open-next/wrangler, workers/, proxy, auth/Turnstile/BotID or upload file touched.

## Result
- Episode page HTML 59 ms sooner at +40 ms per Supabase request; hub/series 11–14 ms. First byte unchanged (~60 ms, loading shell).
- Lighthouse within run-to-run noise on every route (mobile LCP ~5 s floor = client JS under Lighthouse's mobile model + preloader; proposals P1–P6 in BASELINE.md).
- `/portfolio` Speed Index rise was checked: base cfbc8fb re-run under the same load reads the same as the branch → not a regression.

## Gates (heavy lock, detached, log `/Users/koss/.clickit-checks/perf-gate.log`)
Run 2026-10-20 14:20:37–14:21:02 on d26c5a5 (after the merge):
- `npx tsc --noEmit`: exit 0.
- `npm run gate:local`: exit 0. Lint 0 errors, 17 warnings (pre-existing). Unit tests 451/451 pass. `next build` exit 0 (59 pages; env from the gitignored `.env.local`, local stack).
- Visual click-through (prod build, en + ar, 375 px and 1440 px; watch, series, episode, my-list, profile): all four skeletons render with shimmer and the status label, RTL anchors right, no horizontal overflow, no React/hydration errors. The only console errors are local environment artifacts: CSP blocking http 127.0.0.1:55321, `_vercel` scripts, 400 from the local favicon/og through next/image, one ytimg 404.

## NOT verified
- Hero image priority fix: local data has no show artwork, so not measurable; check on live data after deploy.
- Real Worker→Supabase latency (only a fixed +40 ms local proxy).
- Playwright e2e not run. Lighthouse on the live site not run (local only, by rule).
- Click-through was done before the merge of d517ddc (admin-only changes merged; viewer files unchanged).

## Local side effects
- One local-only test viewer on the shared `_Clickit` stack: `perf-lighthouse@clickit.local` ("Perf Lighthouse"), created by anon sign-up for signed-in Lighthouse runs. Credentials outside the repo (`/Users/koss/.clickit-checks/perf-tools/test-user.env`). No reset, no stop, no other writes.
- `.env.local` (gitignored) in this worktree points at the local stack.

## For the controller
- P3 (lazy supabase-js in `src/components/layout/auth-section.tsx`, ~60 KB gz off /portfolio and /watch) and the desktop CLS 0.056 navbar cluster sit in the auth area: route to whoever owns it.
- P4 (Vercel analytics/speed-insights in the root layout) belongs to Job C.
- P1 (entry preloader) is Koss's product call.

## UAT (type/click → expected)
1. DevTools → Network "Slow 4G", signed in, open /en/watch → hero block with title/text/two pill bones, a 9:16 shorts row, two 16:9 rails; bones shimmer left→right; page lands with no jump.
2. Same at 375 px width → rails show three stacked 16:9 cards, no sideways scroll.
3. Open /ar/watch on Slow 4G → bones anchored right, shimmer runs right→left.
4. Open a show (/en/series/<slug>) on Slow 4G → tall hero with CTA + two round buttons, season tab bones, four episode rows; desktop shows a side panel bone.
5. Open /en/my-list on Slow 4G → left-aligned header bones, 2:3 poster grid (2 columns on phone).
6. Open an episode (/en/watch/<id>) on Slow 4G → black player with a quiet play mark, top bar and bottom tray bones; no grey flash.
7. macOS Settings → Accessibility → Display → Reduce motion on, repeat step 1 → bones are static grey, no shimmer.
8. VoiceOver on, repeat step 1 → "Loading" announced once.
9. Open an episode, then a show page, normal network → everything loads as before (resume point, like, My List state correct).

## PR
https://github.com/Loomlyne/Clickit/pull/25 (branch `claude/perf-skeletons-6f6fc9`). No merge, no deploy from this session.
