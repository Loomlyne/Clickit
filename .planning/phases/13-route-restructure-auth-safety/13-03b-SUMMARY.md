---
phase: 13-route-restructure-auth-safety
plan: 03b
subsystem: i18n / routing
tags: [i18n, navigation, next-link, v1.1]
requires:
  - 13-01 (route restructure, [locale]/ tree)
  - 13-02 (proxy composition, locale-aware middleware)
  - 13-03a (navigation-hook + Server-redirect swaps — 4 shared files landed first)
provides:
  - locale-preserving <Link> click navigation across every client component and page in the viewer + admin surface
affects:
  - RTE-04 (Link half closed; combined with 13-03a, RTE-04 fully closed)
tech-stack:
  added: []
  patterns:
    - "import { Link } from '@/i18n/navigation' — drop-in replacement for next/link's default export"
key-files:
  created: []
  modified:
    - src/app/not-found.tsx
    - src/app/[locale]/(viewer)/coming-soon/page.tsx
    - src/app/[locale]/(viewer)/design-system/layout.tsx
    - src/app/[locale]/(viewer)/my-list/page.tsx
    - src/app/[locale]/(viewer)/profile/page.tsx
    - src/app/[locale]/(viewer)/search/page.tsx
    - src/app/[locale]/(viewer)/series/[slug]/not-found.tsx
    - src/app/[locale]/(viewer)/series/[slug]/page.tsx
    - src/app/[locale]/(viewer)/watch/[episodeId]/not-found.tsx
    - src/app/[locale]/admin/shows/[id]/page.tsx
    - src/components/admin/admin-header.tsx
    - src/components/admin/shows-table.tsx
    - src/components/home/continue-watching-card.tsx
    - src/components/home/cta-banner.tsx
    - src/components/home/genres-grid.tsx
    - src/components/home/hero-slide.tsx
    - src/components/landing/genre-pills.tsx
    - src/components/landing/landing-faq.tsx
    - src/components/landing/landing-hero-animations.tsx
    - src/components/landing/landing-hero.tsx
    - src/components/landing/shows-portfolio.tsx
    - src/components/layout/auth-section.tsx
    - src/components/layout/footer.tsx
    - src/components/layout/mobile-nav.tsx
    - src/components/layout/nav-links.tsx
    - src/components/layout/navbar.tsx
    - src/components/primitives/section-header.tsx
    - src/components/profile/profile-header.tsx
    - src/components/profile/profile-history-row.tsx
    - src/components/series/episode-row.tsx
    - src/components/series/series-detail-hero.tsx
    - src/components/shows/episode-art-card.tsx
    - src/components/shows/episode-card.tsx
    - src/components/shows/portrait-show-card.tsx
    - src/components/shows/reel-card.tsx
    - src/components/shows/show-card.tsx
    - src/components/watch/episode-nav.tsx
    - src/components/watch/watch-page-content.tsx
decisions:
  - "Accepted 1 drift file (src/app/[locale]/(viewer)/design-system/layout.tsx) into scope — grep found 38 next/link imports vs frontmatter's 37. Drift file was legitimately renamed into [locale]/ by plan 13-01 and now lives under the localized tree; swap is identical and in line with the plan's stated goal."
  - "Single atomic commit for all 38 files — the swap is mechanical (1 line per file, no prop or API changes), so splitting into smaller commits adds no reviewable signal."
metrics:
  duration: "~4 minutes"
  completed: 2026-04-21
---

# Phase 13 Plan 03b: next/link → @/i18n/navigation Sweep Summary

**One-liner:** Swapped every `<Link>` import across 38 viewer/admin client components and pages from `next/link` to `@/i18n/navigation` so every click auto-prepends the active locale prefix — `/ar/` users no longer bounce to `/en/` on navigation.

## What Shipped

Task 1 — Target freeze:
- Ran authoritative grep: `grep -rnl "from ['\"]next/link['\"]" src` → 38 files, saved to `/tmp/phase-13-03b-link-files.txt`.
- Diffed against frontmatter list (37 entries) — 1 file in grep not in frontmatter: `src/app/[locale]/(viewer)/design-system/layout.tsx`. Added to the swap list per plan's drift rule ("new next/link import introduced since planning; add it to the swap list").
- `LinkProps` usage check: none across the codebase — no type-side adaptation needed.

Task 2 — Sweep (commit `b10a964`):
- For each of 38 files, swapped `import Link from 'next/link'` → `import { Link } from '@/i18n/navigation'` via `sed -i ''` in a single loop.
- Handled both single-quote and double-quote import shapes.
- Per-file acceptance loop confirmed every file has the new import, zero residue.
- Total diff: 38 files, 38 insertions, 38 deletions (1-line swap per file, mechanically uniform).

Task 3 — Build gate:
- `npx tsc --noEmit` → exit 0.
- `npm run build` → exit 0, 44 routes generated (same as 13-03a baseline).
- `grep -rE "from ['\"]next/link['\"]" src --include='*.tsx' --include='*.ts'` → EMPTY.
- No "Module not found" or "has no exported member 'Link'" errors in the build log.

## Verification

- Task 1 invariant: `test -s /tmp/phase-13-03b-link-files.txt` → 38 files, within the ±3 of 38 window specified by the plan.
- Task 2 invariant: every file in frozen list imports from `@/i18n/navigation`; no file imports from `next/link`.
- Task 3 invariants: tsc clean, build green, final grep empty.
- Sanity: 4 shared files with 13-03a (`auth-section.tsx`, `nav-links.tsx`, `mobile-nav.tsx`, `watch-page-content.tsx`) now import BOTH `{ useRouter/usePathname }` AND `{ Link }` correctly from `@/i18n/navigation` — both plans additive, no collisions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Drift file `design-system/layout.tsx` not in frontmatter list**
- **Found during:** Task 1 (target freeze diff).
- **Issue:** Grep returned 38 files; frontmatter enumerated 37. The extra was `src/app/[locale]/(viewer)/design-system/layout.tsx`. Plan 13-03a already modified this file for `usePathname`; the `next/link` import was legitimately present and in-scope for the Phase 13 mandate.
- **Fix:** Per the plan's drift-handling rule ("File in grep but NOT in frontmatter → add it to the swap list"), included the file in Task 2's sweep. Treatment is identical — the same 1-line import swap.
- **Files modified:** `src/app/[locale]/(viewer)/design-system/layout.tsx`.
- **Commit:** b10a964.

No other deviations — no new code paths, no architectural changes, no Rule 4 escalations. The plan was mechanical and executed as written.

## Auth Gates

None. No secrets, external credentials, or runtime auth flows touched.

## Known Stubs

None. Every call site retains the same prop shape as before the swap; next-intl's `Link` is a drop-in replacement.

## Self-Check: PASSED

- All 38 files in `/tmp/phase-13-03b-link-files.txt` contain `from '@/i18n/navigation'` — verified via per-file grep loop.
- ZERO `next/link` imports remain in `src/` — verified via `grep -rE "from ['\"]next/link['\"]" src`.
- Commit `b10a964` exists in git log: `git log --oneline | grep b10a964` → present.
- Build green: `npm run build` → exit 0, 44 routes.
- tsc clean: `npx tsc --noEmit` → exit 0.

## Hand-off Notes for Wave 4+

- RTE-04 fully closed now (hook half from 13-03a + Link half from 13-03b). Every `<Link>` click, every `router.push`, every `usePathname` compare, every Server `redirect` in the in-scope files preserves or correctly scopes the locale.
- Combined static-analysis gate from plan 13-06 Task 1 (`grep -rE "from ['\"]next/(navigation|link)['\"]" src/components src/app src/hooks --include='*.tsx' --include='*.ts' | grep -vE "notFound" | grep -vE "auth/callback/route\.ts"`) now returns only the two files explicitly deferred to 13-05: `locale-switcher.tsx`, `language-preference.tsx`.
- Wave 4 can safely take over — no residual nav-primitive surface to worry about.
