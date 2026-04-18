# TODOS

Deferred work from CEO + Eng review of post-v1.0 hero media + landing redesign (2026-04-18/19).

---

## Resolved 2026-04-19

- ✅ **prefers-reduced-motion support** — `reducedMotion` prop threaded from `HeroBanner` (where `useReducedMotion()` runs) through `HeroSlide` to `CinematicBackdrop`. `<video>` omits `autoPlay`/`loop` and YouTube iframe URLs use `autoplay=0&loop=0` when true. `motion/react` animations already gated via `MotionConfig reducedMotion="user"` in `HeroBanner`. Iframe also gained a `title` attribute.
- ✅ **Hero media test coverage** — `resolveHeroMedia` extracted to `src/lib/hero-media.ts` and tested with `node:test` (14 tests, all pass). Playwright E2E spec written at `tests/e2e/hero-media.spec.ts` covering viewport-aware rendering and iframe accessibility. Run with `npm run test:unit`.
- ✅ **Storage cleanup for orphaned hero media files** — `/api/cron/cleanup-media` route + `vercel.json` schedule (Mondays 04:00 UTC). Diffs referenced DB URLs against Supabase Storage; deletes orphan files older than 24h matching the versioned-path pattern. Guarded by `CRON_SECRET`. **Deployment TODO:** set `CRON_SECRET` env var in Vercel (`vercel env add CRON_SECRET production`).
- ✅ **YouTube iframe lazy loading** — Investigated and retracted. `HeroBanner` uses `AnimatePresence` with one `HeroSlide` keyed by active show ID, so only the active slide's iframe ever mounts. The real double-load issue was the desktop+mobile variant mount, fixed by server-side UA detection.

---

## Active — nothing outstanding

All P2 and P3 items from the original review are now resolved or invalidated.

---

## Operational follow-ups (not code TODOs)

- Set `CRON_SECRET` Vercel env var before the next deploy so the cron auth guard works.
- Monitor the first few cron runs via Vercel function logs (`[cron/cleanup-media]` prefix) to confirm the file counts look sensible.

---

*Last updated: 2026-04-19 (eng review + Codex outside-voice + TODO sweep)*
