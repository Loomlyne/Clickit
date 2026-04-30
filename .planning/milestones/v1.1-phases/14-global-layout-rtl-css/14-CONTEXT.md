# Phase 14: Global Layout + RTL CSS - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

RTL visual correctness for Arabic pages. Three layers of work:

1. **Already shipped (RTL-01..04, 06, 07)** — Coded during Phase 13; Phase 14 verifies + closes these requirements via Vercel preview smoke test.
2. **Logical property migration (RTL-05)** — Surgical: 3 hero text anchors (`left-0` → `start-0`) and the watch page sidebar separator (`border-l` → `border-s`). Most of the ~114-component migration already happened organically during Phase 12-13 work (83 files already use logical properties).
3. **Verification gate** — Vercel preview deploy, walk through `/ar/*` pages visually before closing all 8 RTL requirements.

English experience is byte-identical after this phase — all changes are locale-conditional (logical props auto-flip, `rtl:` variant, `html[dir="rtl"]` CSS scoping).

</domain>

<decisions>
## Implementation Decisions

### Hero text anchoring (RTL-05 — partial)
- **D-01:** Hero text overlays use `start-0` (logical) instead of `left-0` (physical). In Arabic (`dir="rtl"`) this anchors to the bottom-right — matching Arabic reading direction and Shahid/Netflix MENA conventions.
- **Files to migrate:** `src/components/series/series-detail-hero.tsx`, `src/components/home/hero-slide.tsx`, `src/components/landing/landing-hero.tsx` — change `left-0` to `start-0` on the text container divs.

### Watch page RTL layout (RTL-05 — partial)
- **D-02:** Watch page episode list panel separator uses `border-s` (logical) instead of `border-l` (physical). In Arabic (`dir="rtl"`), `border-s` renders on the right side — so the episode list sits on the left and the player on the right, matching Arabic reading flow.
- **File to migrate:** `src/components/watch/watch-page-content.tsx` — change `lg:border-l` to `lg:border-s`.
- **Note:** The YouTube IFrame player chrome itself stays LTR regardless (RTL-08 — inherent in the embed).

### Already-done infrastructure (close via verification, not code)
- **D-03:** RTL-01 (`<html dir="rtl">`), RTL-02 (Cairo display: swap), RTL-03 (font-stack via `[dir="rtl"]` in globals.css), RTL-04 (letter-spacing strip), RTL-06 (icon mirroring via `rtl:scale-x-[-1]`), RTL-07 (Embla direction: rtl) — all coded during Phase 13. Phase 14 verifies these work in a real browser on a Vercel preview, then closes the requirements.

### Verification approach
- **D-04:** Vercel preview smoke test (same pattern as Phase 13 UAT). Walk through `/ar/*` pages and confirm: `<html dir="rtl">` in devtools, Cairo renders without FOIT, hero text anchors to right, carousel swipes RTL, chevrons/arrows mirror, watch page episode list appears on left.
- Code inspection alone is not sufficient — cascade/specificity bugs only surface visually.

### Not in scope (already done or deferred)
- Shadcn primitive components (`sheet.tsx`, `avatar.tsx`, `dropdown-menu.tsx`) — their `left-0`/`right-0` are for animation slide directions and absolute badge anchoring, not reading-direction layout. Keep physical properties.
- Progress bars and full-width overlays (`left-0 right-0` pairs) — these span the full width regardless of direction; no migration needed.
- Admin pages RTL — admin has zero physical-direction properties needing migration (confirmed by grep); admin pages render fine under `dir="rtl"` with the global CSS rules already in place.
- String translation — Phases 15/16.

### Claude's Discretion
- Whether to combine the hero and watch page migrations into a single plan or split them
- Exact smoke test URL list and checklist items (follow Phase 13 UAT format)
- Whether to add a `tsc --noEmit` gate before the smoke test

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope
- `.planning/ROADMAP.md` — Phase 14 success criteria (5 criteria), RTL-01..08 requirement list
- `.planning/REQUIREMENTS.md` — RTL-01..08 full requirement text with acceptance conditions
- `.planning/PROJECT.md` — v1.1 milestone goal and RTL polish scope

### Prior phase outputs (already-done infrastructure)
- `.planning/phases/13-route-restructure-auth-safety/13-CONTEXT.md` — Phase 13 decisions; `[locale]/layout.tsx` built here sets `<html lang dir>`, loads Cairo, applies `dirFor()`
- `src/app/[locale]/layout.tsx` — already has Cairo + Jakarta fonts, `dir={dirFor(locale)}`, `lang={locale}` on `<html>`
- `src/styles/globals.css` — already has `[dir="rtl"]` font-stack rule + `html[lang="ar"] [class*="tracking-["]` letter-spacing strip
- `src/components/ui/carousel.tsx` — already handles `direction: rtl` via `useLocale()` + `rtl:scale-x-[-1]` on arrow icons
- `src/components/watch/episode-nav.tsx` — already has `rtl:scale-x-[-1]` on chevrons
- `src/components/primitives/section-header.tsx` — already has `rtl:scale-x-[-1]` on chevron

### Files to migrate (RTL-05)
- `src/components/series/series-detail-hero.tsx` — line 111: `left-0` → `start-0`
- `src/components/home/hero-slide.tsx` — line 54: `left-0` → `start-0`
- `src/components/landing/landing-hero.tsx` — line 109: `left-0` → `start-0`
- `src/components/watch/watch-page-content.tsx` — line 151: `border-l` → `border-s`

### Project conventions
- `CLAUDE.md` — project-level guidelines

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dirFor(locale)` from `src/lib/locale.ts` — returns `'rtl'` for `'ar'`, `'ltr'` for `'en'`. Already used in `[locale]/layout.tsx`.
- `useLocale()` from `next-intl` — used in carousel for runtime RTL direction. Pattern available for any client component that needs locale.
- `rtl:` Tailwind variant — already used in carousel and episode-nav. Use `rtl:scale-x-[-1]` on directional icons, `rtl:text-right` etc. for one-off cases.

### Established Patterns
- Logical properties are already the convention (83 components use them). The 4 remaining physical-property cases are the exception, not the rule.
- Icon mirroring convention is `rtl:scale-x-[-1]` on the `className` — consistent across all existing cases. Do not use conditional React rendering for this.
- Font routing via CSS variables: `--font-jakarta` (Plus Jakarta Sans) and `--font-cairo` (Cairo) are both loaded on `<html>`. The `globals.css` `[dir="rtl"]` rule switches the active font-family. No per-component font logic needed.

### Integration Points
- Tailwind v4 supports `rtl:` variant natively via `dir="rtl"` on the `<html>` element — no plugin needed.
- `border-s` in Tailwind v4 = `border-inline-start` = physical `border-left` in LTR, `border-right` in RTL. Browser support is universal (all modern browsers).
- `start-0` in Tailwind v4 = `inset-inline-start: 0` = physical `left: 0` in LTR, `right: 0` in RTL.

</code_context>

<specifics>
## Specific Ideas

### Smoke test checklist for Vercel preview (Phase 14 verification)

1. Visit `/ar/` — `<html dir="rtl" lang="ar">` confirmed in DevTools Elements
2. Open a show on `/ar/series/<slug>` — hero text anchored to bottom-right; title/metadata align right
3. Home page `/ar/` — hero slides text on right, carousel swipes right-to-left, chevron arrows mirror
4. Watch page `/ar/watch/<id>` — episode list on the left side, player on the right; border separator appears on the right edge of the list
5. Navigation chevrons in section headers, episode nav — all mirror correctly (`rtl:scale-x-[-1]`)
6. Typography check — Cairo renders at correct weight, no FOIT flash on Arabic pages, English tracking is preserved on `/en/*` pages
7. Locale switch `/en/` → `/ar/` — font and direction change without full page reload artifacts
8. Coming soon gate (if on) — `/ar/coming-soon` renders RTL

No automated E2E test needed for this phase — visual smoke test is the gate.

</specifics>

<deferred>
## Deferred Ideas

- Admin RTL deep-audit — admin renders correctly under the global CSS rules but has not been visually verified in Arabic. Deferred to Phase 17 polish or post-v1.1.
- Cairo line-height fine-tuning — Arabic script may need slightly larger line-height than Jakarta for readability. Not a blocker; defer to Phase 17 polish.
- `prefers-reduced-motion` + RTL carousel — already handled (carousel has existing prefers-reduced-motion support); no action needed.
- String extraction — Phases 15/16.

</deferred>

---

*Phase: 14-global-layout-rtl-css*
*Context gathered: 2026-04-24*
*Depends on: Phase 13 (complete, commit 33b65a8)*
