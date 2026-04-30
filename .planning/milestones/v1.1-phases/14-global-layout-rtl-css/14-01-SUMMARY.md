---
plan: 14-01
phase: 14
status: executed (pending human smoke test)
commit: 850f630
date: 2026-04-24
---

# Plan 14-01 — SUMMARY

## What shipped (commit 850f630)

4 surgical Tailwind className swaps — zero logic changes, zero new files, zero new imports:

| File | Before | After |
|------|--------|-------|
| `src/components/series/series-detail-hero.tsx:111` | `bottom-0 left-0` | `bottom-0 start-0` |
| `src/components/home/hero-slide.tsx:54` | `bottom-0 left-0 w-full` | `bottom-0 start-0 w-full` |
| `src/components/landing/landing-hero.tsx:109` | `bottom-0 left-0 w-full` | `bottom-0 start-0 w-full` |
| `src/components/watch/watch-page-content.tsx:151` | `lg:border-l` | `lg:border-s` |

## Must-Haves verified via T03 grep gate

| MH | RTL | Evidence | Status |
|----|-----|----------|--------|
| MH-01 | RTL-01 | `[locale]/layout.tsx:101` has `dir={dir} lang={locale}` on `<html>` | ✓ |
| MH-02 | RTL-02 | `[locale]/layout.tsx:21,28` both fonts have `display: 'swap'` | ✓ |
| MH-03 | RTL-03 | `globals.css:203` has `font-family: var(--font-cairo)` under `[dir="rtl"]` | ✓ |
| MH-04 | RTL-04 | `globals.css:208` has `html[lang="ar"] [class*="tracking-["]` rule | ✓ |
| MH-05 | RTL-05 | 4 edited lines contain `start-0` / `lg:border-s`; zero residual `left-0` / `lg:border-l` | ✓ |
| MH-06 | RTL-06 | `rtl:scale-x-[-1]` present in carousel (2×), episode-nav (4×), section-header (1×) | ✓ |
| MH-07 | RTL-07 | `carousel.tsx:56,61` wires `direction: locale === 'ar' ? 'rtl' : 'ltr'` into Embla opts | ✓ |
| MH-08 | RTL-08 | YouTube IFrame embed has no `dir` attribute — inherits document direction | ✓ |

## Gates passed

- T03 atomic grep gate: 8/8 checks green (2 regression + 6 invariant)
- T04 `npx tsc --noEmit`: exit 0 (1.14s)
- T04 `npm run build`: exit 0, all 44 locale routes prerender
- T05 atomic commit: `git log -1 --stat` shows exactly 4 files, commit `850f630`

## Pre-existing diagnostics (not introduced here)

- `landing-hero.tsx:2` — unused `Link` import (TS 6133)
- `series-detail-hero.tsx:37` — unused `tCommon` (TS 6133)

Pre-existed this phase. Defer to cleanup sweep.

## T06 — Vercel preview smoke test (human gate)

Pending user. 8-item checklist in `14-01-PLAN.md`. Run after Vercel preview deploys.

## Requirements closed pending smoke test

RTL-01, RTL-02, RTL-03, RTL-04, RTL-05, RTL-06, RTL-07, RTL-08 — all 8.
