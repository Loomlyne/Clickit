---
phase: 02-app-shell-navigation
plan: "02"
subsystem: ui
tags: [nextjs, react, shadcn, radix-ui, tailwind, auth, dropdown, avatar]

# Dependency graph
requires:
  - phase: 02-01
    provides: Glass-effect Navbar server component with placeholder slot for auth section

provides:
  - AuthSection client component toggling between Sign In ghost button and authenticated avatar state
  - UserAvatar component (36px circle, first initial, bg-secondary, hover:bg-border)
  - UserDropdown component (Radix DropdownMenu, 200px, align=end, email label + My List/Profile/Sign Out)
  - Wired Navbar: server component shell + AuthSection client island

affects: [phase-08-auth-integration, phase-09-personalization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server component shell with client island: Navbar stays a server component, AuthSection is the only client component in the nav"
    - "Mock auth state toggle: useState(false) in AuthSection, no real auth yet -- wired during Phase 8"
    - "Radix DropdownMenuTrigger asChild merges trigger into UserAvatar button (adds aria-haspopup, aria-expanded automatically)"
    - "onSelect (not onClick) on DropdownMenuItem for Radix-compliant close-on-select behavior"

key-files:
  created:
    - src/components/layout/auth-section.tsx
    - src/components/layout/user-avatar.tsx
    - src/components/layout/user-dropdown.tsx
  modified:
    - src/components/layout/navbar.tsx

key-decisions:
  - "AuthSection is a client island inside a server component Navbar -- keeps RSC boundary clean while enabling useState for mock auth toggle"
  - "Mock auth state (useState) resets on hard refresh -- accepted per plan decision D-06; real Supabase auth wired in Phase 8"
  - "UserDropdown uses onSelect prop (not onClick) on Sign Out item to correctly trigger Radix close-on-select behavior"

patterns-established:
  - "Client island pattern: server nav shell imports client auth component -- zero 'use client' pollution on Navbar"
  - "Avatar as DropdownMenuTrigger asChild: button gets aria-haspopup and aria-expanded for free from Radix"

requirements-completed: [NAVG-05, DESG-01, DESG-06, DESG-10]

# Metrics
duration: 30min
completed: 2026-03-31
---

# Phase 02 Plan 02: Auth Section Summary

**Radix-powered Sign In / avatar dropdown client island wired into server component Navbar, completing the full CIT app shell**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-03-31
- **Completed:** 2026-03-31
- **Tasks:** 2 (1 auto, 1 checkpoint)
- **Files modified:** 4

## Accomplishments

- Built three client components (AuthSection, UserAvatar, UserDropdown) that complete the navbar auth section
- UserAvatar renders a 36px circle with the user's first initial, using CIT design tokens (bg-secondary, hover:bg-border, ring-ring)
- UserDropdown uses Radix DropdownMenu with email label, My List (Bookmark), Profile (User), and Sign Out (LogOut, red #DF544A) at 200px width aligned end
- AuthSection toggles between unauthenticated ghost button and authenticated avatar+dropdown via useState mock state
- Navbar remains a pure server component -- AuthSection is the only client island, preserving RSC boundary
- Visual verification approved by user on Vercel preview deployment (https://clickit-cit.vercel.app)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create auth client components and wire into Navbar** - `35a9733` (feat)
2. **Task 2: Visual verification of app shell** - checkpoint approved by user (no code changes)

## Files Created/Modified

- `src/components/layout/auth-section.tsx` - Client island: toggles between Sign In ghost button and authenticated UserDropdown+UserAvatar
- `src/components/layout/user-avatar.tsx` - 36px circle button with first initial, bg-secondary, hover:bg-border, WCAG focus ring
- `src/components/layout/user-dropdown.tsx` - Radix DropdownMenu with email label, My List, Profile, Sign Out (red text)
- `src/components/layout/navbar.tsx` - Server component updated to import and render AuthSection (replaced placeholder div)

## Decisions Made

- **AuthSection as client island:** Navbar stays a server component for RSC correctness; only AuthSection needs `use client` for useState. This is the established server-component-shell-with-client-islands pattern from Phase 02 research.
- **Mock auth state with useState:** Resets on hard refresh, which is acceptable for Phase 2. Real Supabase session auth will replace this in Phase 8.
- **onSelect for Sign Out:** Used Radix's `onSelect` prop (not `onClick`) on the Sign Out DropdownMenuItem so the dropdown closes correctly on selection.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full app shell complete: glass-effect Navbar, CIT logo, Sign In / avatar toggle, dropdown menu
- Phase 3 (Home Page & Catalog UI) can begin immediately -- the shell is the layout foundation for all viewer-facing pages
- Auth components are stubs: AuthSection uses mock state. Phase 8 will replace useState with Supabase session checks

## Self-Check: PASSED

- User visually approved the app shell on https://clickit-cit.vercel.app (Vercel preview deployment)
- Task 1 commit `35a9733` confirmed present in git history
- All four layout files confirmed created/modified as specified

---
*Phase: 02-app-shell-navigation*
*Completed: 2026-03-31*
