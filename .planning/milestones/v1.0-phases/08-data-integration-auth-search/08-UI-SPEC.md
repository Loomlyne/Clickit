# Phase 8: Data Integration, Auth & Search — UI Design Contract

**Generated:** 2026-04-04
**Source:** Codex AI analysis of existing codebase patterns
**Status:** Ready for planning

## Global Rules (All Phase 8 Surfaces)

- Page shell: `min-h-screen bg-black text-white`, top spacing for fixed navbar: `pt-24 md:pt-28`
- Horizontal gutters: `px-6 md:px-12`
- Section rhythm: `space-y-10` between major sections, `mb-4` section headers, `pb-16` page bottom
- Display headings: `font-display` with `text-3xl sm:text-4xl md:text-5xl`. Body uses PP Montreal (default sans)
- Chrome: glass panels use `bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl`
- Motion: `duration-200` to `duration-300`; slight lift/scale, not dramatic parallax

---

## 1. Search Page `/search?q=...`

### Layout
Hero-free results page. Top block: query label, results count, optional filter chips. Main body: 2-section stack — "Shows" section with card grid, "Episodes" section with episode rows. No sidebar filter rail for v1.

### Components
- **Reuse:** `Navbar`, `SectionHeader`, `PortraitShowCard` (show results), `EpisodeRow` (episode results)
- **New:** `SearchResultsHeader`, `SearchEmptyState`, `SearchSkeletonGrid`

### Visual Treatment
- Query eyebrow: `text-sm uppercase tracking-[0.3em] text-white/40`
- Result headline: `font-display text-3xl`
- Results area: `mt-8`
- Show cards grid: `grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`
- Episodes list: standard `EpisodeRow` stacked layout with `space-y-3`

### Interactions
- Typing a new query transitions to skeleton state, not flash empty
- Empty state: concise single line + 2 recovery actions (clear query, browse `/series`)
- No-results artwork: subdued, not playful

### Responsive
- `<640px`: full-width stacked layout, 2-column show grid
- `640-1024px`: 3-column show grid
- `>1024px`: 4-5 column show grid, mixed result sections

---

## 2. Search Input in Navbar

### Layout
Desktop: between `NavLinks` and `AuthSection`. Mobile: icon button that expands search field below navbar as second row.

### Components
- **Reuse:** `Input` (shared)
- **New:** `NavbarSearch`, `NavbarSearchToggle` (mobile)

### Visual Treatment
- Desktop input: `h-10 w-[240px] xl:w-[320px] rounded-full bg-white/[0.06] border border-white/[0.08] pl-10 pr-4 text-sm placeholder:text-white/35`
- Search icon: left-aligned `left-3 text-white/45` (lucide `Search` icon)
- Focus: `bg-white/[0.09] border-white/[0.14]`, subtle glow `0 0 0 1px rgba(91,127,255,.25)`

### Interactions
- Enter routes to `/search?q=...`
- ESC clears input if focused, closes overlay on mobile
- Default state: low-contrast glass. Focus state: brightened glass with blue glow

### Responsive
- `<640px`: icon-only trigger, expanded search drops below navbar `px-6 pb-3`
- `640-1024px`: compact `w-[200px]`
- `>1024px`: always visible, full width

---

## 3. Series Listing Page `/series`

### Layout
Browse page with header (title, genre chips, sort control) and dense card grid below. No hero banner.

### Components
- **Reuse:** `PortraitShowCard`, `SectionHeader`, genre chip visual language from `GenresGrid`
- **New:** `SeriesToolbar` (glass bar with filters/sort), `SeriesGridSkeleton`, `SeriesEmptyState`

### Visual Treatment
- Page header: restrained radial glow, title "All Series" in `font-display`
- Toolbar: `rounded-2xl p-4 bg-white/[0.03] border border-white/[0.08]`
- Grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-5`

### Interactions
- Genre chips filter grid in place
- Cards use existing `PortraitShowCard` hover (scale, overlay)
- Loading: poster-ratio skeleton cards with bottom gradient shimmer
- Empty state: offers reset filters action

### Responsive
- `<640px`: stacked title/controls, horizontal scroll genre chips, 2-col grid
- `640-1024px`: 3-4 columns, toolbar wrapping
- `>1024px`: single-line toolbar, 5-6 columns

---

## 4. Schedule Page `/schedule`

### Layout
Editorial schedule, not admin table. Top hero block with title + current week context. Segmented control: `Today`, `This Week`, `All`. Main body: vertical list grouped by day, each day section has show entries with broadcast time.

### Components
- **Reuse:** `SectionHeader`, `ScrollReveal`
- **New:** `ScheduleHero`, `ScheduleSegmentedControl`, `ScheduleDateGroup`, `ScheduleShowRow`, `ScheduleEmptyState`

### Visual Treatment
- Date headers: `text-xs uppercase tracking-[0.24em] text-white/40`
- Date title: `text-2xl font-display`
- Show rows: dark glass card `bg-white/[0.03] rounded-xl p-4` with show poster thumbnail, title, time badge
- Time badges: brand-color tinted `rounded-full px-3 py-1 text-xs`

### Interactions
- Segment switch slides active pill
- Date groups fade in via `ScrollReveal`
- Loading: list skeleton, not cards
- Empty state: "No broadcasts scheduled."

### Responsive
- `<640px`: stacked date sections, `space-y-6`, no timeline spine
- `640-1024px`: list layout with more breathing room
- `>1024px`: wider content rows, optional left date column feel

---

## 5. Auth Error Messages

### Layout
Keep current placement: server/auth errors as top banner above form fields. Field validation inline under each field.

### Components
- **Reuse:** `LoginForm`, `SignupForm` form structures, `Input` with invalid styles
- **New:** `mapAuthErrorMessage()` utility function

### Visual Treatment
- Error banner: `rounded-lg px-4 py-3 text-sm bg-[#DB3F34]/10 border border-[#DB3F34]/25 text-red-300`
- Leading icon: `AlertCircle` in `flex gap-2.5 items-start`
- Inline field errors: `text-xs text-brand-red-safe mt-1`
- Field with error: `aria-invalid` + red ring via Input invalid styles

### Error Copy Map
| Supabase Error | User-Facing Copy |
|---------------|-----------------|
| Invalid login credentials | Email or password is incorrect |
| User already registered | An account with this email already exists |
| Password should be at least 6 characters | Password must be at least 6 characters |
| Email not confirmed | Please check your email to confirm your account |
| For security purposes, you can only request this after X seconds | Too many attempts. Please wait a moment and try again |
| (fallback) | Something went wrong. Please try again |

### Interactions
- Error banner fades in (motion `animate-in fade-in`), no aggressive reflow
- Same pattern at all breakpoints

---

## 6. Coming Soon Page (Live Data Rewire)

### Layout
**No visual changes.** Preserve current structure: anticipation header, upcoming shows grid, upcoming episode list grouped by show.

### Components
**No new components.** Keep `ComingSoonShowCard`, `EpisodeRow`, `SectionHeader`, `ScrollReveal`.

### Visual Treatment
Unchanged. Maintain purple radial glow, "What's Next" eyebrow, current grid/list spacing, current empty-state.

### Interactions
Unchanged. Add loading skeletons matching existing card and row silhouettes during server fetch.

---

## Implementation Constraints

- Search and Series must feel like first-class browse surfaces, not utility/admin pages
- Reuse existing motion and card primitives before adding new card variants
- New filter/tabs/search chrome must visually rhyme with `GenresGrid` and navbar glass, not shadcn defaults
- Maintain `px-6 md:px-12`, `h-16` navbar offset, dark-cinematic contrast, brand-color accents as invariant system

---

*Phase: 08-data-integration-auth-search*
*UI-SPEC generated: 2026-04-04 via Codex AI codebase analysis*
