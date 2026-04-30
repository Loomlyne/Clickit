# Phase 10: Empty State Polish — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 10 — Empty State Polish
**Areas discussed:** Browse empty state, Series detail empty state, CTA Banner copy, Scope confirmation

---

## A — Browse Page Zero-Content State

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to home | Send to `/` if catalog empty. Landing page handles the story. | ✓ |
| Minimal inline state | Keep `/browse`, show centered "catalog is being prepared" + Coming Soon CTA | |
| Full CatalogLaunchHero | Build premium pre-launch hero from Codex plan. Overlaps with landing page. | |

**User's choice:** Redirect to home
**Notes:** User initially asked for plain explanation of all options before deciding. After explanation, chose redirect as the cleanest option.

---

## B — Series Detail with No Episodes

| Option | Description | Selected |
|--------|-------------|----------|
| Glass setup panel | Cinematic glass card with "Season details are being prepared" + Coming Soon CTA | |
| Nothing — hero only | Just show the hero, page ends there | |
| Redirect to /coming-soon | Treat no-content show as unreleased, redirect | |
| Text-only setup message | Panel without glass card — simple cinematic text, same visual rhythm as hero | ✓ |

**User's choice:** Text-only — "Set up the panel as the cinematic and everything, but without the glass cart. Like keep a text simple. Same as the hero of all ones."
**Notes:** Explicitly rejected the glass card container. Wants the text to match the hero's visual language — small caps label, display headline, soft body copy. No borders, no backdrop-blur box.

---

## C — CTA Banner Copy

| Option | Description | Selected |
|--------|-------------|----------|
| Catalog-aware copy | Query DB, swap headline by content stage (zero/growing/full) | ✓ |
| Keep static copy | Current "Stream original programming" headline stays | |

**User's choice:** Catalog-aware copy
**Notes:** No additional questions needed — decision was clear.

---

## D — Scope Confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| That's it — create context | 4 changes: browse redirect, series text state, catalog-aware CTA, getCatalogStage() | ✓ |
| Add something else | Another empty state or page to handle | |

**User's choice:** Confirmed — no additions.

---

## Claude's Discretion

- Exact copy strings per CTA stage (follow Codex plan table unless tonally off)
- Whether `CtaBanner` fetches stage internally or receives prop from parent page
- Layout/spacing of series empty state relative to `SeriesDetailHero`

## Deferred Ideas

- `CatalogLaunchHero` full-bleed hero — superseded by marketing landing page
- Search catalog-awareness — already implemented
- ROADMAP Phase 10 description update
