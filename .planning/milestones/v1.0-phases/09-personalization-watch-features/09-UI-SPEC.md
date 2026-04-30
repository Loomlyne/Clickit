# Phase 9: Personalization & Watch Features — UI Design Contract

**Generated:** 2026-04-04
**Source:** Codex AI analysis of existing codebase patterns
**Status:** Ready for planning

---

## Global Rules

Inherited from Phase 8 — all surfaces in this phase must comply.

| Token | Value |
|---|---|
| Page shell | `min-h-screen bg-black text-white` |
| Top spacing | `pt-24 md:pt-28` |
| Horizontal gutters | `px-6 md:px-12` |
| Section rhythm | `space-y-10` |
| Section header margin | `mb-4` |
| Page bottom padding | `pb-16` |
| Display headings | `font-display text-3xl sm:text-4xl md:text-5xl` |
| Glass panels | `bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl` |
| Motion duration | `duration-200` to `duration-300` |

---

## 1. Watchlist Toggle Button

### Layout

The button appears in two distinct contexts:

- **Card context** — absolute-positioned over the top-right corner of show artwork on `PortraitShowCard`
- **Hero context** — inline in the CTA button row on `SeriesDetailHero`, beside the Play button

### Components

New reusable client component: `WatchlistToggleButton`

Mount locations:
- `PortraitShowCard` — card overlay variant
- `SeriesDetailHero` — hero CTA row variant

Props interface:
```ts
interface WatchlistToggleButtonProps {
  showId: string
  variant: 'card' | 'hero'
  initialSaved?: boolean
}
```

### Visual Treatment

**Card variant:**
```
absolute right-3 top-3 z-20
flex h-9 w-9 items-center justify-center
rounded-full border border-white/20
bg-black/50 backdrop-blur-md
text-white/80
hover:bg-black/70
transition-all duration-200
```

Active / saved state:
```
bg-white text-black border-white
```

**Hero variant:**

Maintain the existing 44×44 pill-circle button style already present in the hero CTA row. Fill the button (same `bg-white text-black` inversion) when the show is saved.

**Icon:**
- Default (not saved): lucide `Plus` icon
- Saved: lucide `Check` icon
- Transition between icons: crossfade `duration-200`

### Interactions

- Toggle is **optimistic** — update local state immediately, sync with Supabase in the background; revert on error with a `sonner` toast
- Card variant must call `e.stopPropagation()` so the card's navigation link is not triggered
- If the user is **unauthenticated**, clicking redirects to `/auth?next=<current path>` rather than attempting a DB write

### Responsive

- Same dimensions at all breakpoints (button does not scale)
- Hero variant wraps naturally with the surrounding `flex flex-wrap` CTA row

---

## 2. My List Page `/my-list`

### Layout

Copy the `/series` page shell structure:

```
Page header (title + item count)
Portrait show grid
```

No genre filter chips. Route is authenticated-only — unauthenticated visitors redirect to `/auth?next=/my-list`.

### Components

Reuse:
- `SectionHeader` — page title and count
- `ScrollReveal` — staggered grid entrance
- `PortraitShowCard` — each saved show

### Visual Treatment

**Page wrapper:**
```
pb-16
```

**Header block:**
```
relative py-20 px-6 md:px-12 text-center overflow-hidden
```

**Show grid:**
```
grid
grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6
gap-4 md:gap-5
```

**Empty state** (when list has zero items):

```
flex flex-col items-center justify-center gap-4 py-32 text-center
```

- Headline: `"Your list is empty"` — `text-xl font-semibold text-white`
- Body: `"Save shows to watch them later."` — `text-sm text-white/50`
- CTA: ghost button linking to `/series` — `rounded-full border border-white/20 text-white/70 px-6 py-2 text-sm hover:border-white/40 hover:text-white transition-all duration-200`

### Interactions

- Cards use the existing `PortraitShowCard` hover behaviour (scale + overlay fade)
- WatchlistToggleButton is present on each card; removing a show from the list removes it from the grid optimistically

### Responsive

Identical column breakpoints to the `/series` page.

---

## 3. Continue Watching Rail

### Layout

Dedicated `ContinueWatchingEpisodeRail` section rendered on the home page (and optionally the profile page) above the regular show rails, only when the current user has in-progress episodes.

The rail is horizontal-scroll with episode-level resume cards.

### Components

New:
- `ContinueWatchingCard` — single resume card
- `ContinueWatchingEpisodeRail` — rail shell with header and scroll container

Reuse:
- `SectionHeader` — rail title ("Continue Watching")
- Embla carousel shell (optional, same pattern as existing rails)

### Visual Treatment

**Card dimensions:**
```
basis-[320px] flex-shrink-0
```

**Card art:**
```
aspect-video w-full rounded-xl overflow-hidden relative
```
Aspect ratio `16/9`.

**Metadata block below art:**
```
mt-3 flex flex-col gap-1
```

- Show title: `text-xs font-medium text-white/50 uppercase tracking-wide`
- Season + Episode label (e.g. `S1 E4`): `text-sm font-semibold text-white`
- Episode title: `text-sm text-white/70 truncate`

**Progress bar:**
```
mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden
```
Fill element uses the show's brand color (CSS variable `--brand-color` injected per card, fallback `bg-white/60`).

**Resume CTA pill** (overlaid bottom-right of art on hover):
```
rounded-full bg-white text-black px-4 py-2 text-xs font-semibold
opacity-0 group-hover:opacity-100 transition-opacity duration-200
```

Progress percentage text (bottom-left of art, always visible):
```
text-[11px] text-white/60
```

### Interactions

- The entire card is a link to `/watch/[episodeId]`
- On navigation, the player should initialise at the saved timestamp via query param or Zustand store
- Rail is **hidden** for anonymous users and hidden when the list is empty (no empty state shown — simply omit the section)
- Progress bar fill width derived from `(resumeSeconds / durationSeconds) * 100`%

### Responsive

- **Mobile:** single-card viewport width, horizontal swipe (touch-action: pan-x)
- **Desktop:** show 2–3 cards visible, left/right arrow buttons from carousel shell

---

## 4. Autoplay Countdown Overlay

### Layout

Full-player overlay rendered inside the watch page's video frame container, layered above the YouTube iframe via `z-20`.

Activates automatically when the current episode ends and a next published episode exists.

### Components

New: `AutoplayOverlay`

```ts
interface AutoplayOverlayProps {
  nextEpisode: { id: string; title: string; seasonNumber: number; episodeNumber: number }
  onPlayNow: () => void
  onCancel: () => void
}
```

### Visual Treatment

**Container:**
```
absolute inset-0 z-20
flex items-end justify-between
bg-gradient-to-t from-black/90 via-black/50 to-transparent
p-4 md:p-6
```

**Left column — next episode info:**
```
flex flex-col gap-2
```

- Label: `"Up next"` — `text-xs font-medium text-white/50 uppercase tracking-widest`
- Episode identifier (e.g. `S1 E5`): `text-sm text-white/70`
- Episode title: `text-lg font-semibold text-white`
- Countdown chip:
  ```
  inline-flex items-center gap-1.5
  rounded-full bg-white/10 px-3 py-1
  text-xs text-white/70
  ```
  Content: `"Playing in {n}s"`

**Right column — action buttons:**
```
flex flex-col gap-2 items-end
```

- Play now button:
  ```
  rounded-full bg-white text-black px-6 py-2 text-sm font-semibold
  hover:bg-white/90 transition-colors duration-200
  ```
- Cancel button:
  ```
  rounded-full border border-white/20 text-white/70 px-4 py-2 text-sm
  hover:border-white/40 hover:text-white transition-all duration-200
  ```

### Interactions

- Overlay appears when YouTube player fires `onStateChange` with state `YT.PlayerState.ENDED`
- Condition: next published episode must exist (queried from Supabase episode list)
- Countdown: 8-second timer using `setInterval`, decrement displayed value each second
- On countdown reaching 0: navigate to `/watch/[nextEpisodeId]`
- **Play now:** navigate immediately
- **Cancel:** dismiss overlay, timer cleared, no navigation

### Responsive

On mobile (`< sm` breakpoint), restructure to vertical stack:

```
flex-col items-stretch gap-4
```

- Left column stacks above right column
- Both action buttons become `w-full` (full-width)

---

## 5. Profile Page Enhancements

### Layout

Expand the current narrow single-card layout to a two-section page:

1. **Top section** — existing settings card (account info, preferences)
2. **Bottom section** — My List preview + Recently Watched history

```
Page container
└── Settings card (existing)
└── sections gap-12
    ├── My List preview (up to 6 cards)
    └── Recently Watched history (up to 10 rows)
```

### Components

Reuse:
- `ProfileForm` — existing account settings form
- `PortraitShowCard` — 4–6 cards in watchlist preview grid
- `SectionHeader` — titles for each sub-section

New:
- `ProfileHistoryRow` — single row in the Recently Watched list

### Visual Treatment

**Page container:**
```
relative z-10 mx-auto w-full max-w-7xl px-6 md:px-12 py-24
```

**Bottom sections wrapper:**
```
mt-12 space-y-12
```

**Content cards (both sections):**
```
rounded-2xl border border-white/10 bg-[rgba(17,17,22,0.7)] backdrop-blur-xl p-6 md:p-8
```

**My List preview grid:**
```
grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3
```
"See all" link beside section header → `/my-list`

**`ProfileHistoryRow`:**
```
flex items-center gap-4 py-3 border-b border-white/[0.06] last:border-0
```

- Thumbnail: `w-20 aspect-video rounded-lg overflow-hidden flex-shrink-0`
- Text block: show title + episode label + watch date
- Right: `Completed` badge or progress bar (same tokens as `ContinueWatchingCard`)
- Completed badge:
  ```
  rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/60
  ```

### Interactions

- My List section header "See all" links to `/my-list`
- Each `PortraitShowCard` in the preview navigates to `/series/[slug]`
- `ProfileHistoryRow` items link to `/watch/[episodeId]`
- Rows with saved progress resume from saved position
- Completed badge shows when `resumePercent >= 90`

### Responsive

- My List grid: `grid-cols-3` → `grid-cols-6` as above
- History rows: full width on mobile, truncate long titles with `truncate`
- Settings card remains full-width at all breakpoints

---

## 6. Resume Position Indicator on Episode Cards

### Layout

Progress bar added directly beneath the episode metadata block in `EpisodeRow`, visible only when `resumePercent` is defined and greater than 0.

### Components

Extend `EpisodeRowProps`:

```ts
interface EpisodeRowProps {
  // ...existing props
  resumePercent?: number  // 0–100, undefined means no saved progress
  isCompleted?: boolean   // true when resumePercent >= 90
}
```

### Visual Treatment

**Progress bar container:**
```
mt-2 h-1 rounded-full bg-white/10 overflow-hidden
```

**Progress bar fill:**
```
h-full rounded-full transition-all duration-300
```
Color: show brand color via inline style `style={{ width: `${resumePercent}%`, backgroundColor: brandColor }}`.

**Completed state** — replace bar with badge:
```
mt-2 inline-flex items-center
rounded-full bg-white/10 px-2.5 py-0.5
text-[11px] text-white/50
```
Text: `"Completed"`

### Interactions

- Clicking an `EpisodeRow` that has `resumePercent` defined navigates to `/watch/[episodeId]` and the player initialises at the saved timestamp
- No visible interaction on the bar itself — it is display-only

### Responsive

Progress bar and completed badge render within the text column only (not full card width). On mobile the text column is already the dominant layout element — no additional changes needed.

---

## Implementation Constraints

- Watchlist and continue watching must feel **native** to the existing dark cinematic design — no bright backgrounds, no card borders that differ from the glass panel system
- **Reuse existing primitives** — `PortraitShowCard`, `SectionHeader`, `ScrollReveal`, carousel shell — before creating new components
- New chrome (overlays, history rows, profile sections) must **rhyme with the glass panel system**: `bg-white/[0.04]` surfaces, `border-white/[0.08]` borders, `backdrop-blur-xl`
- All personalization features **gracefully degrade for unauthenticated users**: either hidden entirely or redirected to `/auth?next=<path>` — no broken states, no empty errors
- Maintain `px-6 md:px-12` gutters across all new surfaces
- Maintain `h-16` navbar offset — new sections must not overlap the fixed nav
- Optimistic UI patterns (watchlist toggle, continue watching removal) must always have an error recovery path via `sonner` toast
- Brand color per show is available as a design token — use it consistently in progress bars across all surfaces (continue watching rail, episode rows, profile history)
