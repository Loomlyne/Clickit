---
phase: 04-design-system-truth
plan: 04
subsystem: ui
tags: [admin, design-system-page, next-intl, useSyncExternalStore, rtl, node-test]

requires:
  - phase: 04-design-system-truth
    provides: 04-01 SIGNED_TOKENS, normalizeCssValue, contrastRatio and the named radius/shadow/status utilities; 04-02 token guard rule; 04-03 one brand map
provides:
  - Read-only admin page /[locale]/admin/design-system (Colour, Type, Radius roles, Surfaces and shadows, Components) drawn from the running CSS
  - Summary line that counts pinned tokens matching the signed values and lists any that differ
  - Sidebar entry "Design system" in Operations after Audit
  - admin.designSystem messages in en.json and ar.json (114 keys, identical sets, ICU-parsed by a test)
  - token-groups.ts (TOKEN_GROUPS, ALIAS_TOKENS, BRAND_PAIRS, STATUS_SAMPLES, RADIUS_SAMPLES, SHADOW_SAMPLES) proven against globals.css
  - canonicalCssValue and resolveSignedValue in design-truth.ts for comparing live (minified) and signed spellings
affects: [04-05, 04-06, 04-13, phase-05-requireAdmin]

tech-stack:
  added: []
  patterns:
    - "Live CSS reads through useSyncExternalStore with a joined-string snapshot (no effect hook, no setState), server snapshot ''"
    - "Rendered radius measured from a real sample element (data-radius-sample), not by re-reading --uis-r-*"

key-files:
  created:
    - src/app/[locale]/admin/design-system/page.tsx
    - src/components/admin/design-system/design-system-view.tsx
    - src/components/admin/design-system/token-groups.ts
    - tests/unit/design-system-page.test.ts
  modified:
    - src/components/admin/admin-header.tsx
    - src/lib/design-truth.ts
    - src/messages/en.json
    - src/messages/ar.json

key-decisions:
  - "Summary compares canonicalCssValue(live) to canonicalCssValue(resolveSignedValue(name)): the production stylesheet is minified (rgba becomes #rrggbbaa, spaces after commas dropped, #CCCCCC becomes #ccc), and --status-* are var() references the browser resolves"
  - "Fonts are not in the summary count: --font-lbc is injected by next/font with a hashed family name, so a live compare would raise a false difference. The font stacks stay pinned by design-tokens.test.ts"
  - "Shadow rows print the shadow variable's value (what the utility reads), not the composite box-shadow computed from the element"

patterns-established:
  - "A new admin page under src/app/[locale]/admin/ inherits the layout guard; a test pins the single design-system directory and the two guard lines"

requirements-completed: []  # DS-01 is half done (DESIGN.md is 04-06); DS-04 needs the browser UAT below before it can be ticked

duration: 15min
completed: 2026-10-20
---

# Phase 4 Plan 04: Admin design-system page Summary

**An admin-only, data-free page at `/[locale]/admin/design-system` that draws the live colours, type, radius roles, shadows and real primitives from the running CSS in English and Arabic, with a summary line that says how many of the 69 pinned tokens match the signed values.**

## Accomplishments

- Task 1 (owner gate): the 04-GATE.md verify (Q1, Q2, Q5 answered A by Koss) exited 0, so the plan ran as written.
- Task 2 (TDD): RED test first (`a8ce093`), then `token-groups.ts`, 114 `admin.designSystem` keys in both languages, and two pure helpers in `design-truth.ts`. Tests prove every listed token is declared in globals.css, every literal-colour `:root` declaration and all 12 brand values are listed, every `--status-*` is in a group, en/ar key sets are identical, every message parses as ICU (`IntlMessageFormat`), and the plurals format ("62 tokens match the signed values", Arabic dual "رمزان").
- Task 3: server page (metadata, `AdminPageHeader`, view), client view with the five sections, summary line (reading / ok chip / bad chip with the list of differing tokens), in-page nav pills, and the sidebar item with the `Palette` icon. The profile card in `admin-header.tsx` now uses `rounded-card` (same 12px).
- DS-04 pins in the test: page and view exist under `src/app/[locale]/admin/design-system`, no other `design-system` directory under `src/app`, the admin layout still holds `if (!user)` and `admin_user_id !== user.id`, the page and view contain none of `createClient`, `createAdminClient`, `supabase`, `fetch(`, and the view has `useSyncExternalStore` and no `useEffect`.
- Real-stylesheet check: after the production build I read the minified `:root` from `.next/static/chunks/*.css` and ran all 69 `SIGNED_TOKENS` through the same compare the page uses: 0 differences. The built CSS contains `rounded-chip`, `bg-status-success/8`, `border-status-neutral-line`, `shadow-popover`, `rounded-media` and `text-status-danger`, so the page's classes are generated.

## Task Commits

1. **Task 2 RED:** `a8ce093` (test) - failing coverage and access pins
2. **Task 2 GREEN:** `66b7d3b` (feat) - token groups, messages, canonicalCssValue/resolveSignedValue
3. **Task 3:** `6bd0366` (feat) - page, view, sidebar entry
4. Task 1 changes no files (gate check)

## Verification

- Verified: `tests/unit/design-system-page.test.ts` 17/17; `npm run test:unit` 605/605; `npm run typecheck` clean; eslint on the page, view, token-groups, admin-header and design-truth: 0 errors and 0 `no-raw-design-values` messages (1 existing `exhaustive-deps` warning in admin-header's prefetch effect, not from this plan); acceptance greps (one `/admin/design-system` in admin-header, no `rounded-[` there, no data access words, `find src/app -type d -name design-system` prints only the admin one); `npm run build` exit=0 (log `/Users/koss/.clickit-checks/p04-04-build.log`, lock released) and the route `/[locale]/admin/design-system` is in the route list; 69/69 pinned tokens equal in the production CSS.
- Not verified: anything in a browser. No dev server was started (no heavy-lock session for it). Still open, and it is Koss's UAT per 04-VALIDATION.md: (1) signed out, open `/en/admin/design-system`, expect to be sent away with no page content; (2) signed in as a viewer, expect `/watch`; (3) as admin, expect five sections and 0 differences, `/ar/admin/design-system` mirrored, Arabic samples in LBC; (4) 375px width, no sideways page scroll; (5) open the Select and press the toast button.
- Failed: none.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plain `normalizeCssValue` would report false differences against the production stylesheet**
- **Found during:** Task 2 (planning the compare), confirmed on the built CSS after Task 3
- **Issue:** The minifier writes `rgba(255,255,255,.08)` as `#ffffff14`, `0 10px 32px rgba(...), inset ...` as `0 10px 32px #00000047, inset ...`, and `#CCCCCC` as `#ccc`. `normalizeCssValue` only handles a whole-string hex or rgb() syntax, so about 20 shadow and line tokens would have shown as "differs". `--status-*` signed values are `var(--...)` while the browser returns the resolved colour.
- **Fix:** Added two pure, import-free exports to `src/lib/design-truth.ts` (additive; no existing export changed): `canonicalCssValue` (converts embedded hex to rgba/#RRGGBB, one space after commas) and `resolveSignedValue` (follows `var()` references). Both are tested.
- **Files modified:** `src/lib/design-truth.ts`, `tests/unit/design-system-page.test.ts`
- **Commit:** `66b7d3b`

**2. [Rule 2 - Missing critical functionality] Labels the plan did not list**
- **Issue:** Section headings for the component groups, state labels, the Live/Signed words in the difference list, the Matches/Differs chip words and a few more had no message key, and the plan requires every visible string to come from `t()`.
- **Fix:** Added 24 keys beyond the UI-SPEC table (for example `groupButtonVariants`, `stateRest`, `liveValue`, `chipMatch`, `radiusBase`, `selectAria`, `mixedTitle`) with English and Arabic text in the same style. Wording is planner wording for Koss to review in UAT.
- **Files modified:** `src/messages/en.json`, `src/messages/ar.json`
- **Commit:** `66b7d3b`

**Other small choices, within the plan:** fonts are not part of the summary count (see key-decisions); `ALIAS_TOKENS` is a test-pinned list and is not drawn as swatches (UI-SPEC shows no alias section); button size samples and badge variants print their code identifiers (`xs`, `icon-lg`, `outline`) because they are names of the thing shown, not copy.

## Issues Encountered

- The shared heavy lock was free when the build started, no queue wait. The build script removes the lock through an exit trap.

## Known Stubs

None.

## Threat Flags

None. The page adds no endpoint, reads no data and writes nothing (the sample toast is client-only). T-04-08 and T-04-09 are mitigated by the pins above; T-04-11 transfers to Phase 5 `requireAdmin` + TOTP as planned.

## Self-Check: PASSED

- Files exist: `src/app/[locale]/admin/design-system/page.tsx`, `src/components/admin/design-system/design-system-view.tsx`, `src/components/admin/design-system/token-groups.ts`, `tests/unit/design-system-page.test.ts`.
- Commits exist in `git log`: `a8ce093`, `66b7d3b`, `6bd0366`.
