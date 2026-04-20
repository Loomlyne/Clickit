---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Full Bilingual UI (AR/EN)
status: roadmap-ready
stopped_at: Roadmap drafted — next phase = 12 (i18n Infrastructure)
last_updated: "2026-04-20T23:00:00.000Z"
last_activity: 2026-04-20
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-20)

**Core value:** Viewers enter, discover a show, pick an episode, watch immediately — premium streaming experience for CIT originals.
**Current focus:** v1.1 Full Bilingual UI (AR/EN) — URL-prefix routing, full translation coverage of every visible string, RTL layout.

## Current Position

Phase: Not started — Phase 12 is next (`/gsd:plan-phase 12`)
Plan: —
Status: Roadmap ready; requirements fully mapped; awaiting plan-phase kickoff
Last activity: 2026-04-20 — Roadmap drafted (Phases 12-17)

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

Last session: 2026-04-20
Stopped at: Roadmap drafted; awaiting `/gsd:plan-phase 12`
Resume file: `.planning/ROADMAP.md` — Phase 12 details
