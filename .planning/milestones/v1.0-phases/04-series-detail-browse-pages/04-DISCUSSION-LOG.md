# Phase 4: Series Detail & Browse Pages - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 04-series-detail-browse-pages
**Areas discussed:** Episode card design, Series detail hero, Season selector style, Coming Soon + Schedule page tone, Route structure, Mock data scaling, Series detail layout

---

## Episode Card Design

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal rows | Thumbnail left (~200px, 16:9) + text right. Full-width stacked list. Netflix/Disney+ pattern. | ✓ |
| Small grid tiles | Compact 16:9 tiles in 3-4 col grid. Number + title below. | |
| Large full-width cards | Taller rows with full episode description. | |

**User's choice:** Horizontal rows

---

**Episode info content:**

| Option | Description | Selected |
|--------|-------------|----------|
| Number + Title + Duration + Status badge | Minimal info, no description | |
| Number + Title + Short description + Duration + Status badge | 1-line truncated description | ✓ |
| Number + Title + Duration only | No status badge | |

**User's choice:** Number + Title + Short description + Duration + Status badge

---

**Episode state visual treatment:**

| Option | Description | Selected |
|--------|-------------|----------|
| Reduced opacity + lock/clock icon on thumbnail | ~40-50% opacity, icon overlay, status badge | ✓ |
| Grayscale thumbnail + status badge | Desaturated thumbnail | |
| Full opacity, badge only | Same appearance, badge differentiates | |

**User's choice:** Reduced opacity + lock icon on thumbnail (for locked), clock icon (for coming-soon)

---

## Series Detail Hero

**Hero height:**

| Option | Description | Selected |
|--------|-------------|----------|
| Medium backdrop hero (~45-55vh) | Cinematic but episodes visible without scrolling | ✓ |
| Full viewport (100vh) | Full immersion, must scroll to see episodes | |
| Short banner (~25-30vh) | Compact, prioritizes episodes | |

**User's choice:** Medium backdrop hero (~45-55vh)

---

**Hero content:**

| Option | Description | Selected |
|--------|-------------|----------|
| Title + tagline + metadata chips + Watch CTA | Clean, consistent with home hero slides | ✓ |
| Title + full description + Watch CTA | Longer description, heavier | |
| Title + Watch CTA only | Minimal | |

**User's choice:** Show title + tagline + metadata chips + Watch CTA

---

**Hero visual treatment:**

| Option | Description | Selected |
|--------|-------------|----------|
| Ambient brand color glow | Same pattern as home hero — show's brandColor radiates as soft glow | ✓ |
| Full-bleed backdrop only | Artwork + dark gradient, no ambient glow | |
| You decide | Claude picks | |

**User's choice:** Ambient brand color glow (consistent with Phase 3 visual language)

---

## Season Selector Style

**Initial choice:**

| Option | Description | Selected |
|--------|-------------|----------|
| Tabs | 1-click, shadcn Tabs, works for 1-4 seasons | ✓ (initial) |
| Dropdown | Scales to many seasons | |
| Tabs on desktop, dropdown on mobile | Adaptive by viewport | |

**User's choice:** Initially tabs

---

**Scaled to handle many seasons (follow-up):**

| Option | Description | Selected |
|--------|-------------|----------|
| Scrollable tab row | Tab bar scrolls horizontally when overflow | |
| Tabs for 1-5, dropdown for 6+ | Auto-switches at threshold | ✓ |
| Always dropdown | Predictable, scales to any count | |

**User's choice:** Tabs for 1-5 seasons, dropdown for 6+ (adaptive based on `seasons.length`)
**Notes:** User noted that admin could create 17 seasons and 100 episodes per season — architecture must handle this gracefully.

---

## Coming Soon + Schedule Page

**Coming Soon page content:**

| Option | Description | Selected |
|--------|-------------|----------|
| Two sections: Coming Shows + Upcoming Episodes | Section 1: status=coming-soon shows. Section 2: coming-soon episodes from streaming shows. | ✓ |
| Unified list | Flat mix of shows and episodes | |
| Just coming-soon shows | No upcoming episodes section | |

**User's choice:** Two sections

---

**Coming soon show card treatment:**

| Option | Description | Selected |
|--------|-------------|----------|
| Same ShowCard + Coming Soon badge overlay | Reuses existing component, slight opacity reduction | ✓ |
| Distinct teaser card | Darker, blurred, locked feel | |
| You decide | Claude picks | |

**User's choice:** Same ShowCard + Coming Soon badge overlay

---

**Broadcast schedule (CATL-11):**

| Option | Description | Selected |
|--------|-------------|----------|
| Day-by-day list | 7 sections, one per day | |
| Weekly calendar grid | TV guide style | |
| Show-by-show list | Group by show, show their day/time | |
| No broadcast schedule page | Admin feature only | ✓ |

**User's choice:** No viewer-facing schedule page.
**Notes:** User clarified that broadcast schedule is for admin to manage shows — not a viewer page. No Netflix/Disney+ equivalent exists. CATL-11 moved to Phase 7 (Admin Dashboard).

---

## Route Structure

| Option | Description | Selected |
|--------|-------------|----------|
| /series/[slug] | Keeps all show routes under /series | ✓ |
| /shows/[slug] | Separates catalog from detail pages | |

**User's choice:** /series/[slug]

---

## Series Detail Layout (below hero)

| Option | Description | Selected |
|--------|-------------|----------|
| Season selector + episode list only | Focused, no distraction | |
| Season selector + episodes + More Like This rail | Adds discovery rail at bottom | ✓ |

**User's choice:** Season selector + episode list + "More Like This" horizontal rail (other shows in same genre)

---

## Episode List Scaling

| Option | Description | Selected |
|--------|-------------|----------|
| Paginated by chunks | First 20, Load More button | ✓ |
| Infinite scroll | Auto-loads on scroll | |
| Full list, no pagination | All episodes in DOM | |

**User's choice:** Paginated by chunks (20 per load)
**Notes:** Admin could upload 100+ episodes per season — pagination prevents DOM bloat.

---

## Claude's Discretion

- Exact hero gradient stop values and padding
- Motion timing for episode card hover state
- Episode thumbnail placeholder treatment (brand color fill)
- Loading/empty state for seasons with no episodes
- Episode row hover highlight treatment

## Deferred Ideas

- Broadcast schedule viewer page → Phase 7 admin feature (CATL-11 reassigned)
- Watchlist button on series detail → Phase 9
- Trailer preview on detail hero → out of scope (PROJECT.md)
- Countdown timers on Coming Soon page → out of scope (PROJECT.md)
