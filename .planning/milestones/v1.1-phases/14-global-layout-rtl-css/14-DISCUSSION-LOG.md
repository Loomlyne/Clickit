# Phase 14: Global Layout + RTL CSS - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 14-global-layout-rtl-css
**Areas discussed:** Hero text anchoring, Watch page RTL layout, Verification approach

---

## Hero text anchoring

| Option | Description | Selected |
|--------|-------------|----------|
| Start-aligned | Text anchors to bottom-right on Arabic pages (`start-0` logical property). Matches Arabic reading direction. Consistent with Shahid and Netflix MENA. Migrate `left-0` → `start-0` in 3 hero components. | ✓ |
| Always bottom-left | Keep `left-0` as-is regardless of locale. Simpler, no migration. Breaks RTL reading flow but some designers prefer visual consistency across both locales. | |

**User's choice:** Start-aligned
**Notes:** Standard decision — migrate the 3 hero text overlay containers to logical `start-0`.

---

## Watch page RTL layout

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror it | Episode list moves to the left side in Arabic (`border-l` → `border-s`, which flips to `border-right` in RTL). Player stays on right. Matches Arabic reading flow. YouTube player chrome itself stays LTR internally (RTL-08). | ✓ |
| Keep player always left | Player stays left, list stays right regardless of locale. YouTube's own player chrome is LTR anyway — consistent LTR watch experience. Simpler. | |

**User's choice:** Mirror it
**Notes:** `border-l` → `border-s` on `watch-page-content.tsx` sidebar separator.

---

## Verification approach

| Option | Description | Selected |
|--------|-------------|----------|
| Vercel preview smoke test | Deploy to preview URL, walk through `/ar/*` pages manually. Check `html dir`, font rendering, hero anchoring, carousel swipe direction, icon mirroring. Human eyes catch visual regressions that code inspection misses. Same pattern used for Phase 13 UAT. | ✓ |
| Code inspection only | Grep-based static checks confirming CSS rules, logical classes, and RTL attributes are present. Faster, no deploy needed. Risk: coded-but-broken rendering goes undetected. | |

**User's choice:** Vercel preview smoke test
**Notes:** 8-item smoke test checklist defined in CONTEXT.md specifics section. Visual audit gate before closing RTL-01..08.

---

## Claude's Discretion

- Whether to split hero migration and watch page migration into separate plans or combine
- Exact smoke test checklist format and which `/ar/` URLs to hit
- `tsc --noEmit` gate sequencing relative to preview deploy

## Deferred Ideas

- Admin RTL visual audit — global CSS rules already apply, but unverified in a browser. Deferred to Phase 17 polish.
- Cairo line-height tuning for Arabic readability — Phase 17 polish.
