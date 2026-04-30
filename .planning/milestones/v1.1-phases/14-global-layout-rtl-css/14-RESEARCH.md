# Phase 14 Research — Global Layout + RTL CSS

**Date:** 2026-04-24
**Status:** Ready for planning

## Summary

The CONTEXT.md scope holds up under investigation. Six of eight RTL requirements (RTL-01/02/03/04/06/07) are already implemented and can be closed by verification alone — evidence cited below. RTL-05 reduces to exactly 4 surgical edits, all confirmed with exact line matches. RTL-08 is inherent to the YouTube IFrame embed and requires no code. One small wrinkle worth flagging for the planner: every hero text container also has `w-full` alongside `absolute bottom-0 left-0` — swapping `left-0` → `start-0` is safe because `w-full` already fixes width independent of inset anchoring, so there is no paired `right-0` to reconcile. The `watch-page-content.tsx` `lg:border-l` swap to `lg:border-s` is safe in LTR (Tailwind v4 compiles `border-s` to `border-inline-start`, which resolves to physical `border-left` under `dir="ltr"`). No Tailwind v4 / Next.js 16 gotchas detected.

## Verification of Already-Done Infrastructure

| Req | Status | Evidence |
|-----|--------|----------|
| RTL-01 | DONE | `src/app/[locale]/layout.tsx` line 101: `<html lang={locale} dir={dir} ...>` where `dir = dirFor(locale as Locale)` (line 98). Not a cookie read — driven by the route segment. |
| RTL-02 | DONE | `src/app/[locale]/layout.tsx` lines 24-29: `Cairo({ subsets: ['arabic', 'latin'], variable: '--font-cairo', weight: [...], display: 'swap' })`. `display: 'swap'` explicit — no FOIT. |
| RTL-03 | DONE | `src/styles/globals.css` lines 79-81: `--font-sans: var(--font-jakarta), ...` in `@theme inline` (default English). Lines 201-204: `[dir="rtl"], [lang="ar"] { font-family: var(--font-cairo), system-ui, sans-serif; }` — direction-scoped override. CSS variables from `next/font` are attached in layout.tsx line 101 via `${jakarta.variable} ${cairo.variable}` on `<html>`. |
| RTL-04 | DONE | `src/styles/globals.css` lines 206-210: `html[lang="ar"] [class*="tracking-["] { letter-spacing: 0 !important; }`. Scoped to Arabic only; English tracking classes preserved. |
| RTL-06 | DONE | `rtl:scale-x-[-1]` applied at: `src/components/ui/carousel.tsx` lines 202 (ArrowLeft) + 232 (ArrowRight); `src/components/watch/episode-nav.tsx` lines 34, 50, 71, 82 (ChevronLeft/Right); `src/components/primitives/section-header.tsx` line 48 (ChevronRight). Media-control icons (play/pause/volume) are not mirrored per RTL-06 acceptance. |
| RTL-07 | DONE | `src/components/ui/carousel.tsx` lines 55-62: `const locale = useLocale(); const direction = locale === 'ar' ? 'rtl' : 'ltr'; useEmblaCarousel({ ..., direction })`. Embla config receives runtime-resolved direction. |
| RTL-08 | DONE | YouTube IFrame chrome is owned by Google's iframe; no app code needed. |

Nothing missing.

## Implementation Notes for the 4 Edits

### Edit 1 — `src/components/series/series-detail-hero.tsx` (line 111)

- **Current:** `<div className="absolute bottom-0 left-0 px-6 md:px-12 pb-16 md:pb-20 max-w-3xl z-10">`
- **Target:** `<div className="absolute bottom-0 start-0 px-6 md:px-12 pb-16 md:pb-20 max-w-3xl z-10">`
- Adjacent: `max-w-3xl` caps width — no paired `right-0` to remove. Padding classes `px-*` and `pb-*` are already symmetric. Safe.
- Note: line 107 has a decorative left→right gradient overlay (`from-black/70 ... to-transparent`). Under RTL, the text will sit bottom-right, so the darkening gradient will be on the opposite side of the text. Out of scope per CONTEXT (hero compositions mirror via logical properties only), but flag for smoke-test visual check.
- Line 114's `motion.div` uses `initial={{ x: -12 }}` — LTR-biased slide-in. Not a layout bug; acceptable for this phase.

### Edit 2 — `src/components/home/hero-slide.tsx` (line 54)

- **Current:** `<div className="absolute bottom-0 left-0 w-full px-6 pb-10 md:px-12 md:pb-12">`
- **Target:** `<div className="absolute bottom-0 start-0 w-full px-6 pb-10 md:px-12 md:pb-12">`
- `w-full` means inset anchor is cosmetically irrelevant (left:0 + width:100% == right:0 + width:100%). Swap is a no-op in LTR and correctness-only in RTL (keeps the inset shorthand consistent). Nested `max-w-[42rem]` on line 55 governs actual text width — sits at the start edge.
- Same overlay-gradient caveat as Edit 1 (lines 49, 52). Out of scope.

### Edit 3 — `src/components/landing/landing-hero.tsx` (line 109)

- **Current:** `<div className="absolute bottom-0 left-0 w-full px-6 pb-16 md:px-12 md:pb-20">`
- **Target:** `<div className="absolute bottom-0 start-0 w-full px-6 pb-16 md:px-12 md:pb-20">`
- Same `w-full` reasoning as Edit 2. Safe.

### Edit 4 — `src/components/watch/watch-page-content.tsx` (line 151)

- **Current:** `className="w-full lg:w-[380px] lg:flex-shrink-0 border-t border-white/[0.06] lg:border-t-0 lg:border-l lg:border-white/[0.06] bg-black"`
- **Target:** `className="w-full lg:w-[380px] lg:flex-shrink-0 border-t border-white/[0.06] lg:border-t-0 lg:border-s lg:border-white/[0.06] bg-black"`
- Only `lg:border-l` changes to `lg:border-s`. `border-t` and `lg:border-t-0` stay physical (top/bottom are not flipped by direction). `lg:border-white/[0.06]` is color-only — Tailwind v4's `border-s` sets `border-inline-start-width` but does NOT set `border-inline-start-color`. The existing `border-white/[0.06]` applies to all sides via the generic `border-color` shorthand, so color will resolve correctly on the inline-start edge in both LTR and RTL.
- In LTR, `border-inline-start` == `border-left` — identical rendering. In RTL, it flips to the right edge, matching the sidebar sitting at page-start side visually.
- Downstream check: no other `border-l-*` class exists on the same element, so no residue.

### Test implications

- No automated unit test for these — Phase 14 verification is visual Vercel preview smoke.
- `tsc --noEmit` must stay green after edits (Tailwind is string-level, so it'll compile regardless; typecheck catches accidental JSX breakage).
- Grep guard after edit: `git grep -nE "\bleft-0\b" src/components/{series,home,landing}` should return zero hits on the modified lines (other `left-0` hits elsewhere — e.g., sheet.tsx animation anchors — are out of scope).

## Tailwind v4 Logical Property Semantics

Tailwind v4 ships the full logical-property axis natively (no plugin needed):

- `start-0` → `inset-inline-start: 0` → resolves to `left: 0` under `dir="ltr"` and `right: 0` under `dir="rtl"`. Requires the element (or an ancestor) to be positioned (`relative`/`absolute`) — our 4 files all use `absolute`, so no issue.
- `border-s` → `border-inline-start-width: 1px` (plus `border-style: solid` from Tailwind's border preflight). Pairs cleanly with existing `border-white/[0.06]` which resolves via generic `border-color` to all sides, including the newly-defined inline-start edge.
- `border-e` → `border-inline-end-width: 1px`. Not used in this phase.

Browser support: `inset-inline-start` and `border-inline-start` are in all modern browsers (Safari 14.5+, Chrome 87+, Firefox 66+). Universal coverage for the CIT target matrix.

Gotcha none of the files trigger: if an element set `left-0` AND `right-0` (to span full width via inset), swapping only `left-0` to `start-0` would break — in RTL, `start-0` becomes `right: 0`, which conflicts with the existing `right: 0`. None of the 4 target files pair `left-0` with `right-0`, so no issue.

## Validation Architecture

### Vercel preview smoke test (primary gate)

Deploy a preview (git push the branch; Vercel auto-builds). Walk through these URLs on the preview domain:

1. `/ar/` → Open DevTools → Elements → confirm `<html lang="ar" dir="rtl" class="dark <jakarta> <cairo>">`. Hero text anchored bottom-right. Carousel swipes RTL (drag left → goes to next). Chevron in section headers mirror.
2. `/en/` → Confirm `<html lang="en" dir="ltr">`, hero bottom-left, carousel swipes LTR. Visual parity vs pre-phase baseline.
3. `/ar/series/<slug>` (pick any existing show, e.g., `/ar/series/moje`) → Hero text bottom-right, title/metadata right-aligned (already handled by logical `text-start` in existing components).
4. `/en/series/<slug>` → Visual parity check.
5. `/ar/watch/<episode-id>` (pick any episode) → Desktop ≥`lg` breakpoint: episode-list aside appears on LEFT, player on RIGHT, `border-s` renders on the right edge of the aside. Mobile <`lg`: `border-t` stacks vertically (no change).
6. `/en/watch/<episode-id>` → Episode list on RIGHT, border on LEFT. Visual parity.
7. Open a paragraph with Arabic text that uses `tracking-[0.2em]` or higher → glyph joining is continuous (no broken letter connections). Spot-check any uppercase-tracked heading on `/ar/`.
8. `/ar/coming-soon` (if gate is on or toggled on temporarily) → RTL layout renders, font is Cairo, no FOIT flash on first paint.

Browser matrix: Chrome desktop (primary), Safari desktop, mobile Safari iOS (historical RTL viewport quirks around sticky + overflow). iOS Safari ≥15 handles `inset-inline-*` correctly; the watch page uses `lg:sticky` on an inner wrapper (line 153) — test sticky behavior on iOS ≥`lg` breakpoint physical device or DevTools device emulation.

### Automated regression guard

Add to the plan's static-invariant batch (Phase 13 pattern):

- `git grep -nE "\\b(left-0|right-0)\\b" src/components/{series/series-detail-hero,home/hero-slide,landing/landing-hero}.tsx` → must return zero matches.
- `git grep -nE "\\blg:border-l\\b" src/components/watch/watch-page-content.tsx` → must return zero matches.
- Optional tighter invariant: `git grep -nE "absolute .*(left-0|right-0).*(bottom|top)" src/components` — sanity check nothing new re-introduces physical anchoring for hero-like patterns. Expect non-zero hits (sheet.tsx animation anchors, legit full-width bars) — not a hard gate, just review the list.

## Pitfalls

### Do NOT migrate

- `src/components/ui/sheet.tsx` — `left-0` / `right-0` on slide-in drawers map to slide-in directions, not reading direction. Keep physical.
- `src/components/ui/avatar.tsx`, `dropdown-menu.tsx` — absolute positioning for badge/indicator anchoring; not reading-direction layout. Keep physical.
- Full-width overlay pairs like `absolute inset-0` or `left-0 right-0 top-0 bottom-0` — they span the full viewport regardless of direction. No value in migrating.
- Decorative left-to-right gradients on hero backdrops (`bg-gradient-to-r from-black/70`) — these visually balance the LTR text anchor. Under RTL they'll be on the "wrong" side. Per CONTEXT this is out of scope; flag in smoke test if visual quality is poor enough to warrant a follow-up (Phase 17 polish).

### Cascade/specificity concerns

- `html[lang="ar"] [class*="tracking-["]` in globals.css uses `!important` (line 209). This only matches `tracking-[…]` arbitrary-value classes, not Tailwind's named tracking scale (`tracking-wide`, `tracking-widest`). If any `/ar/` heading uses a NAMED tracking utility and exhibits broken glyph joining, the CSS rule needs broadening — unlikely given pre-existing Phase 13 verification, but worth the smoke-test eye.

### LTR safety of `border-s`

- `lg:border-l` → `lg:border-s` produces byte-identical rendering under `dir="ltr"` (both compile to `border-left-width` in the physical direction). Confirmed by Tailwind v4 logical-property mapping. Zero risk of breaking English layout.

### `start-0` without `position`

- All 4 hero edits are on elements already `absolute`-positioned. `start-0` requires a positioning context to take effect; confirmed present in every case.

## References

Files verified (line-numbered):

- `/Users/koss/Desktop/Develop/Clickit/src/app/[locale]/layout.tsx` — lines 17-29 (font loaders), 98-101 (dir/lang wiring)
- `/Users/koss/Desktop/Develop/Clickit/src/styles/globals.css` — lines 79-81 (English font-sans), 201-210 (RTL font + letter-spacing)
- `/Users/koss/Desktop/Develop/Clickit/src/components/ui/carousel.tsx` — lines 55-62 (Embla direction), 202, 232 (arrow mirroring)
- `/Users/koss/Desktop/Develop/Clickit/src/components/watch/episode-nav.tsx` — lines 34, 50, 71, 82 (chevron mirroring)
- `/Users/koss/Desktop/Develop/Clickit/src/components/primitives/section-header.tsx` — line 48 (chevron mirroring)
- `/Users/koss/Desktop/Develop/Clickit/src/components/series/series-detail-hero.tsx` — line 111 (edit target)
- `/Users/koss/Desktop/Develop/Clickit/src/components/home/hero-slide.tsx` — line 54 (edit target)
- `/Users/koss/Desktop/Develop/Clickit/src/components/landing/landing-hero.tsx` — line 109 (edit target)
- `/Users/koss/Desktop/Develop/Clickit/src/components/watch/watch-page-content.tsx` — line 151 (edit target)
- `/Users/koss/Desktop/Develop/Clickit/.planning/phases/14-global-layout-rtl-css/14-CONTEXT.md` — locked decisions

## RESEARCH COMPLETE
