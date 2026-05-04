---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: Immersive Watch
status: roadmap_ready
last_updated: "2026-05-05T00:00:00.000Z"
last_activity: 2026-05-05
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-24)

**Core value:** Viewers enter, discover a show, pick an episode, watch immediately -- premium streaming experience for CIT originals.
**Current focus:** Milestone v2.2 -- Immersive Watch (fullscreen-first watch page + swipe-up episode tray)

## Current Position

Phase: 32 (not started)
Plan: —
Status: Roadmap created, awaiting plan-phase
Last activity: 2026-05-05 — v2.2 roadmap drafted (3 phases, 15 requirements mapped)

## Roadmap Summary (v2.2)

3 phases (32-34), 15 requirements, fullscreen watch milestone.

| Phase | Scope | Requirements |
|-------|-------|---------------|
| 32 | Watch Route Isolation & Fullscreen Shell | WATCH-01..06 |
| 33 | Auto-Hide Chrome Layer | CHROME-01, CHROME-02 |
| 34 | Episode Tray | TRAY-01..07 |

## Traceability (v2.2)

| Requirement | Phase | Status |
|-------------|-------|--------|
| WATCH-01 | Phase 32 | Pending |
| WATCH-02 | Phase 32 | Pending |
| WATCH-03 | Phase 32 | Pending |
| WATCH-04 | Phase 32 | Pending |
| WATCH-05 | Phase 32 | Pending |
| WATCH-06 | Phase 32 | Pending |
| CHROME-01 | Phase 33 | Pending |
| CHROME-02 | Phase 33 | Pending |
| TRAY-01 | Phase 34 | Pending |
| TRAY-02 | Phase 34 | Pending |
| TRAY-03 | Phase 34 | Pending |
| TRAY-04 | Phase 34 | Pending |
| TRAY-05 | Phase 34 | Pending |
| TRAY-06 | Phase 34 | Pending |
| TRAY-07 | Phase 34 | Pending |

**Coverage:** 15/15 mapped, no orphans.

## Accumulated Context

### v1.0 shipped (2026-04-16)

- 11 phases, 27 plans, 60/60 requirements, 13,259 LOC
- Next.js 16.2 + Supabase + Tailwind CSS v4 + shadcn/ui

### v1.1 partial (Phases 12-13 shipped, 14-17 superseded)

- i18n infrastructure: next-intl routing, request.ts, navigation.ts, messages/
- Route restructure: all pages under [locale]/
- Auth safety: 6 latent breaks fixed (cookie merge, locale-aware redirects, OAuth callback)
- Phases 14-17 superseded by v2.0 -- will redo on new components in v2.1

### v2.1 in progress

- Phases 28-31: support + newsletter persistence, CTA repair, company pages, live audit

### v2.2 architecture decisions (2026-05-05)

- **Route group escape:** `[locale]/(watch)/watch/[id]` is its own route group; bare layout, no Navbar/Footer/Silk/Lenis. `(viewer)/layout.tsx` untouched.
- **Fullscreen shell:** CSS `fixed inset-0 h-dvh min-h-svh overflow-hidden bg-black`; `data-lenis-prevent` belt-and-suspenders.
- **Player stability:** `loadVideoById()` for every episode switch — iframe DOM node never rekeyed; progress writer cancelled before switch and restarted in `onReady`.
- **YouTube ToS:** `controls=1` always; chrome and tray must NEVER overlay player controls. Tray squeezes player at half snap, never covers it.
- **Chrome auto-hide:** `useIdleTimer` 3s; motion fade ~200ms; `pointer-events: none` when hidden so YouTube controls receive taps; `onStateChange` state=2 (paused) forces chrome visible.
- **Edge arrows:** 50% viewport Y, left/right anchored, fade with top overlay, hidden when no prev/next exists.
- **Tray:** Vaul drawer via shadcn/ui; snap points [0, 0.5, 0.95]; peek handle (24px pill) always visible; player and tray are sibling DOM, never parent-child.
- **Stack additions:** Zero. motion + vaul + CSS dvh all already installed.

## Decisions Made

- **2026-04-24:** v2.0 supersedes v1.1 Phases 14-17 and v1.2 entirely
- **2026-04-24:** Reviews stored in Supabase with real-time visibility (grouped with series detail in Phase 22)
- **2026-04-24:** Shorts built with placeholder data from existing shows
- **2026-04-24:** Admin portal visual refresh only -- functionality unchanged
- **2026-04-24:** Arabic/RTL for new components deferred to v2.1
- **2026-04-29:** Support and newsletter must persist to Supabase and degrade gracefully when email delivery is unavailable
- **2026-04-29:** Dead or misleading CTAs should become reachable flows, not placeholders
- **2026-05-05:** v2.2 reuses existing stack — zero new libraries; route group escape is the architectural primitive.
- **2026-05-05:** Tray will SQUEEZE player at half snap, never overlay it (YouTube ToS hard constraint).
- **2026-05-05:** Episode switches use `loadVideoById()` only; iframe is never remounted across the entire watch session.

## Session Continuity

Last session: 2026-05-05
Stopped at: v2.2 roadmap created; ready for `/gsd-plan-phase 32`
Resume file: None
