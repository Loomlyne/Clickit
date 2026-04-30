# Phase 5: Watch Page UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 05-watch-page-ui
**Areas discussed:** Player layout, Episode navigation, Watch page URL structure, Mock YouTube videos

---

## Player Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Theater mode | Full-width player at top (16:9), episode info below. Netflix-like. | ✓ |
| Sidebar layout | Player on left (70%), episode list sidebar on right (30%). YouTube-like. | |
| Immersive fullscreen | Dark background, player centered at max width, minimal chrome. | |

**User's choice:** Theater mode
**Notes:** Clean, Netflix-like layout where the player dominates the viewport.

---

## Episode Quick-Selector

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse SeasonSelector + EpisodeList | Same components from series detail page, placed below player. | ✓ |
| Compact dropdown picker | Single dropdown "Season 1 > Episode 3" that expands to compact list. | |
| Thumbnail strip | Horizontal scrollable strip of episode thumbnails below player. | |

**User's choice:** Reuse existing components
**Notes:** Consistent UX with series detail page, less code to maintain.

---

## Episode Boundary Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Cross-season navigation | "Next" on last ep of S1 goes to first ep of S2. Keeps binge going. | ✓ |
| Stop at season boundary | "Next" disabled at end of season. User must manually switch. | |
| Loop within season | "Next" on last ep loops back to first ep of same season. | |

**User's choice:** Cross-season navigation
**Notes:** Keeps the binge-watching flow going seamlessly across seasons.

---

## Watch Page URL Structure

| Option | Description | Selected |
|--------|-------------|----------|
| /watch/[episodeId] | Simple flat route. Easy to share, fast to resolve. | ✓ |
| /series/[slug]/watch/[episodeId] | Nested under series. URL shows context. | |

**User's choice:** /watch/[episodeId]
**Notes:** Same pattern used by YouTube, Netflix, Prime Video. Simple and shareable.

---

## Mock YouTube Videos

| Option | Description | Selected |
|--------|-------------|----------|
| Real CIT videos | Use actual CIT YouTube video IDs | (future) |
| Public sample videos | Use Creative Commons placeholders | |
| Placeholders for now | Set up with test IDs, user swaps in real CIT IDs later | ✓ |

**User's choice:** CIT-only content with placeholders for now
**Notes:** Only CIT YouTube content is allowed on the platform — no third-party videos. User will share real video IDs later. Private/unlisted CIT videos can be embedded.

---

## Claude's Discretion

- Loading state while YouTube player initializes
- Breadcrumb styling and spacing
- Mobile responsive behavior
- Whether to show "More Like This" rail at bottom

## Deferred Ideas

- Autoplay next episode (Phase 9)
- Continue watching progress tracking (needs backend)
