---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Full Bilingual UI (AR/EN)
status: in-progress
stopped_at: Completed 12-01-PLAN.md — next phase = 13 (Route Restructure + Auth Safety)
last_updated: "2026-04-21T00:05:00.000Z"
last_activity: 2026-04-21
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 1
  completed_plans: 1
  percent: 17
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-20)

**Core value:** Viewers enter, discover a show, pick an episode, watch immediately — premium streaming experience for CIT originals.
**Current focus:** v1.1 Full Bilingual UI (AR/EN) — URL-prefix routing, full translation coverage of every visible string, RTL layout.

## Current Position

Phase: 12 COMPLETE — next phase = 13 (Route Restructure + Auth Safety)
Plan: 12-01-PLAN.md shipped (commit af2ab35) — 5 files / 112 LOC, zero page edits
Status: Phase 12 success criteria all green; tsc clean; build green; scope boundary held
Last activity: 2026-04-21 — Phase 12 atomic execution; ready for `/gsd:plan-phase 13`

## Roadmap Summary (v1.1)

| Phase | Goal | Requirements | Criteria |
|-------|------|--------------|----------|
| 12. i18n Infrastructure | next-intl primitives wired with zero page edits | 7 | 5 |
| 13. Route Restructure + Auth Safety | All pages under `[locale]/`, 6 auth pitfalls fixed atomically | 9 | 5 |
| 14. Global Layout + RTL CSS | Arabic dir, Cairo font, logical properties, directional icons | 8 | 5 |
| 15. Viewer Pages Translation | 13 viewer pages fully translated | 14 | 5 |
| 16. Admin Pages Translation | 5 admin views fully translated | 5 | 5 |
| 17. Content + Polish | Dynamic strings, metadata, QA, human review | 19 | 5 |

**Coverage:** 55/55 v1.1 requirements mapped. No orphans. No duplicates. Phases 15/16 parallel-eligible after 14.

## Accumulated Context

### v1.0 shipped (2026-04-16)
- 11 phases, 27 plans, 60/60 requirements, 13,259 LOC
- Next.js 16.2 + Supabase + Tailwind CSS v4 + shadcn/ui
- Cookie-based locale infrastructure exists but mostly unwired
- `next-intl@4.9.1` already installed (unwired)
- `proxy.ts` already exists with Next.js 16 naming convention
- Supabase session helper in `src/lib/supabase/middleware.ts` (library, not middleware entrypoint)

### v1.1 research findings (see .planning/research/SUMMARY.md)
- Zero new dependencies required
- Migration is mechanical once Phase 12-13 (infrastructure + auth-safe route restructure) land
- 6 latent auth/routing breaks identified — must fix atomically in Phase 13
- Existing `dirFor()` and `pickLocalized()` helpers stay
- `locale-actions.ts` + cookie switcher + profile `LanguagePreference` become dead code

### v1.1 risk profile
- **Highest risk:** Phase 13 (route restructure + 6 auth fixes atomic). Must deploy + smoke-test auth flows on preview before merge.
- **Medium risk:** Phase 14 logical-property migration across ~114 components — potential for visual regression on English.
- **Low risk:** Phase 12 (additive, safe), Phase 15/16 (mechanical string extraction), Phase 17 (additive polish).

## Session Continuity

Last session: 2026-04-21
Stopped at: Completed 12-01-PLAN.md (commit af2ab35); awaiting `/gsd:plan-phase 13`
Resume file: `.planning/phases/12-i18n-infrastructure/12-01-SUMMARY.md` — Phase 12 → Phase 13 handoff notes

## Decisions Made

- **2026-04-21 (Phase 12):** `localePrefix: 'always'` — both /en/ and /ar/ URL segments required; no bare-root exception for the default locale.
- **2026-04-21 (Phase 12):** Arabic dictionary values remain empty objects (not English placeholders) so missing keys surface as next-intl MISSING_MESSAGE warnings — prevents silent English fallback on /ar/ pages during later translation phases.
- **2026-04-21 (Phase 12):** No `createNextIntlPlugin()` added to `next.config.ts`; next-intl v4 auto-detects `src/i18n/request.ts` — preserves zero-config-change invariant.
- **2026-04-21 (Phase 12):** `src/lib/locale.ts` kept byte-identical (dirFor / pickLocalized / getLocale) — remains canonical for bilingual DB field rendering in existing viewer code.

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files | Commit |
|-------|------|----------|-------|-------|--------|
| 12 | 01 | auto | 6 | 5 | af2ab35 |
