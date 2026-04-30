---
phase: 03-home-page-catalog-ui
plan: 02
subsystem: ui
tags: [motion, framer-motion, hero-banner, carousel, animation, accessibility, reduced-motion]

# Dependency graph
requires:
  - phase: 03-home-page-catalog-ui/plan-01
    provides: "Mock data (Show type, FEATURED_SHOWS, brandColorHexMap, brandColorBgMap), Button component"
provides:
  - "HeroBanner: auto-rotating hero carousel with pause-on-hover/focus"
  - "HeroSlide: single slide with brand artwork, ambient glow, gradient overlay, CTA"
  - "RotationIndicator: thin progress bars for hero rotation state"
affects: [03-home-page-catalog-ui/plan-03, show-detail-page]

# Tech tracking
tech-stack:
  added: []
  patterns: ["AnimatePresence mode='sync' for crossfade (not 'wait')", "useReducedMotion hook for WCAG 2.2.2 compliance", "MotionConfig reducedMotion='user' wrapper", "Negative margin (-mt-16) to extend hero behind fixed navbar"]

key-files:
  created:
    - src/components/home/hero-banner.tsx
    - src/components/home/hero-slide.tsx
    - src/components/home/rotation-indicator.tsx
  modified: []

key-decisions:
  - "Used text-primary-foreground (white) instead of text-primary (brand blue) for hero title -- plan referenced design token name but Tailwind class text-primary maps to brand blue which is unreadable on dark hero"
  - "AnimatePresence mode='sync' allows entering/exiting slides to overlap for true crossfade effect"

patterns-established:
  - "Hero banner extends behind navbar via -mt-16 to negate the pt-16 on <main>"
  - "Pause-on-hover uses onMouseEnter/Leave; pause-on-focus uses onFocus with onBlur checking relatedTarget containment"
  - "Auto-rotation uses setInterval with TICK granularity (50ms) for smooth progress bar fill"

requirements-completed: [CATL-01, DESG-02, DESG-05, DESG-07]

# Metrics
duration: 27min
completed: 2026-03-31
---

# Phase 3 Plan 2: Hero Banner Summary

**Cinematic auto-rotating hero carousel with 800ms crossfade, ambient brand color glow, gradient overlays, Watch Now CTA, and WCAG-compliant reduced motion support**

## Performance

- **Duration:** 27 min
- **Started:** 2026-03-31T08:58:11Z
- **Completed:** 2026-03-31T09:25:35Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments
- Full-viewport hero banner (h-screen) that extends behind the navbar for cinematic immersion
- Auto-rotation every 6 seconds with smooth 800ms crossfade via AnimatePresence mode="sync"
- Each slide displays show brand color as artwork placeholder, ambient radial glow, dual gradient overlay (left-to-right + bottom-to-top), title, tagline, and Watch Now CTA
- Thin 3px progress bar indicator centered at bottom showing rotation position with smooth fill animation
- Pause on hover (D-07) and keyboard focus (accessibility) with smart blur handling
- Reduced motion support: auto-rotation disabled entirely when prefers-reduced-motion is set (WCAG 2.2.2)
- Screen reader announcements via aria-live="polite" region

## Task Commits

Each task was committed atomically:

1. **Task 1: Build HeroSlide and RotationIndicator components** - `0948963` (feat)
2. **Task 2: Build HeroBanner auto-rotating carousel** - `1de83c3` (feat)

## Files Created/Modified
- `src/components/home/hero-slide.tsx` - Single hero slide with brand color artwork, ambient glow (radial-gradient), dual gradient overlay, animated text entrance, and Watch Now CTA button
- `src/components/home/rotation-indicator.tsx` - Thin progress bar indicators (3px height, 30px width each) with smooth fill animation and aria-label for accessibility
- `src/components/home/hero-banner.tsx` - Auto-rotating carousel with AnimatePresence crossfade, pause-on-hover/focus, reduced motion support, and aria-live announcements

## Decisions Made
- Used `text-primary-foreground` (white #FFFFFF) for hero title instead of plan's `text-primary` which maps to brand blue (#2C3569) -- the plan referenced design system token names but the Tailwind CSS class produces the wrong color for readability on dark hero backgrounds
- AnimatePresence `mode="sync"` (not `mode="wait"`) allows both entering and exiting slides to render simultaneously, enabling true crossfade overlap

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Hero title color class corrected for readability**
- **Found during:** Task 1 (HeroSlide implementation)
- **Issue:** Plan specified `text-primary` for hero title, but in the Tailwind config `text-primary` maps to oklch(0.30 0.08 260) which is brand blue (#2C3569) -- barely visible on dark backgrounds
- **Fix:** Used `text-primary-foreground` which maps to white (#FFFFFF) as intended by the UI-SPEC design contract
- **Files modified:** src/components/home/hero-slide.tsx
- **Verification:** Visual inspection of color token mapping confirms white text on dark overlay
- **Committed in:** 0948963 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential color correction for readability. No scope creep.

## Issues Encountered
None

## Known Stubs
None -- all three components are fully implemented with the mock data interface. No placeholder TODO/FIXME patterns. The brand color artwork backgrounds are intentional placeholder treatments per D-19 (solid color + centered title text) that will be replaced with actual show artwork when image assets are available.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Hero banner components are ready to import into the home page in Plan 03
- `HeroBanner` accepts `shows: Show[]` prop -- pass `FEATURED_SHOWS` from mock-data.ts
- Content rails (Plan 03) will render below the hero with 64px vertical space

## Self-Check: PASSED

- [x] src/components/home/hero-banner.tsx exists
- [x] src/components/home/hero-slide.tsx exists
- [x] src/components/home/rotation-indicator.tsx exists
- [x] Commit 0948963 exists (Task 1)
- [x] Commit 1de83c3 exists (Task 2)
- [x] 03-02-SUMMARY.md exists

---
*Phase: 03-home-page-catalog-ui*
*Completed: 2026-03-31*
