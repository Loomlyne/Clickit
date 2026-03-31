# Phase 4: Series Detail & Browse Pages - Research

**Researched:** 2026-03-31
**Domain:** Next.js dynamic routes, series detail page UI, episode list patterns, Coming Soon browse page
**Confidence:** HIGH

## Summary

Phase 4 builds two new routes (`/series/[slug]` and `/coming-soon`) and extends the mock data layer with `Season` and `Episode` types. The technical domain is well-understood: Next.js 16 dynamic route segments, shadcn Tabs and Select components for the adaptive season selector, CSS-based hover states on episode rows, and simple `useState` pagination for the episode list. All animation patterns, brand color maps, and component conventions are established by Phase 3 -- Phase 4 extends rather than invents.

The series detail page follows a hero-then-content pattern similar to the home page but with a static (non-rotating) hero, a season selector widget, a paginated episode list, and a "More Like This" content rail. The Coming Soon page is a simpler browse page with two sections: show cards and episode rows. Both pages consume mock data from `src/lib/mock-data.ts` which must be extended with Season and Episode interfaces and helper functions.

**Primary recommendation:** Build incrementally: (1) extend mock data with Season/Episode types, (2) install shadcn Tabs + Select, (3) build the series detail page top-to-bottom (hero, season selector, episode list, More Like This rail), (4) build the Coming Soon page reusing existing components. All patterns from Phase 3 are directly reusable.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Route: `/series/[slug]` -- keeps all show-related routes under `/series`
- **D-02:** Medium backdrop hero, ~45-55vh height
- **D-03:** Hero content: show title (large, bold) + tagline (1 line) + metadata chips (genre, episode count, season count) + primary "Watch" CTA button
- **D-04:** Ambient brand color glow -- same visual pattern as the home hero slides
- **D-05:** Dark gradient overlay ensures text legibility. Gradient fades into `--background` (`#0A0A0F`)
- **D-06:** Adaptive season selector: tabs for 1-5 seasons, dropdown for 6+
- **D-07:** Uses shadcn Tabs component for tab variant, shadcn Select for dropdown variant
- **D-08:** Horizontal row layout for episode cards -- thumbnail left (16:9, ~200px desktop) + text right
- **D-09:** Episode row content: episode number + title + 1-line description + duration chip + status badge
- **D-10:** Episode states: `published` (full opacity, play icon hover), `coming-soon` (45% opacity, clock icon, badge), `locked` (45% opacity, lock icon, badge)
- **D-11:** Paginated by chunks of 20, "Load More" button, `useState` managed
- **D-12:** Page structure below hero: season selector, episode list, "More Like This" rail (reuses ContentRail)
- **D-13:** Coming Soon route: `/coming-soon`
- **D-14:** Two sections on Coming Soon: shows with `status: 'coming-soon'` as ShowCards + episodes with `status: 'coming-soon'` from streaming shows as episode rows
- **D-15:** CATL-11 (broadcast schedule) moved to Phase 7 -- no `/schedule` page in Phase 4
- **D-16:** Extend `src/lib/mock-data.ts` with Season and Episode interfaces matching future Supabase schema shape
- **D-17:** Mock data volume: 2 seasons for multi-season shows, 1 for others, 4-6 episodes per season, realistic status mix
- **D-18:** Paginated episode list (D-11) and adaptive season selector (D-06) handle large counts

### Claude's Discretion
- Exact hero padding, text positioning, gradient stop values
- Motion timing for episode card hover (consistent with ShowCard ~0.25s ease-out)
- Episode thumbnail placeholder treatment (brand color fill + episode number)
- ContentRail section header wording for "More Like This" rail
- Loading/empty state when a season has no episodes
- Whether episode rows have a hover state beyond cursor change (recommend subtle `bg-surface-2` highlight)

### Deferred Ideas (OUT OF SCOPE)
- Broadcast schedule viewer page -- reclassified as admin feature, moved to Phase 7
- Watchlist button on series detail page -- Phase 9
- Trailer preview on detail hero -- out of scope per PROJECT.md (ENGM-01)
- Episode countdown timers on Coming Soon page -- out of scope (ENGM-04)
- Genre/status filters on Coming Soon page -- deferred
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CATL-03 | Series detail page shows full backdrop hero with show artwork and info | SeriesDetailHero component with ambient glow, gradient overlay, metadata chips, CTA. Pattern established in hero-slide.tsx (Phase 3). |
| CATL-04 | Series detail page has season selector (dropdown or tabs) | SeasonSelector adaptive component: shadcn Tabs (1-5 seasons) / shadcn Select (6+). Both components confirmed available via shadcn CLI. |
| CATL-05 | Series detail page shows horizontal episode cards with thumbnail, number, title, duration | EpisodeRow horizontal layout + EpisodeList paginated container. D-08/D-09/D-11 specify exact design. |
| CATL-06 | Episode cards display status badges (published, coming soon, locked) | Three states with distinct visual treatment per D-10. Badge component already installed. Status colors defined in UI-SPEC. |
| CATL-07 | Coming Soon page shows unreleased shows and upcoming episodes | Two-section Coming Soon page at `/coming-soon`. Reuses ShowCard + EpisodeRow. Mock data helpers filter by status. |
| CATL-11 | Broadcast schedule displayed showing day/time per show | **RECLASSIFIED per D-15**: Moved to Phase 7 admin dashboard. No viewer-facing schedule page in Phase 4. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Stack**: Next.js 16 (App Router) + Supabase + Tailwind CSS v4, deployed on Vercel
- **Video**: YouTube embed only
- **Brand colors**: Use static `brandColorBgMap` / `brandColorTextMap` / `brandColorHexMap` -- never construct dynamic Tailwind classes
- **Animation**: Use `motion` package (not `framer-motion` package name), import from `motion/react`
- **Components**: shadcn/ui vendored components, Radix UI primitives, lucide-react icons
- **`'use client'`**: Only on components that need interactivity (useState, event handlers, motion animations)
- **No Prisma**: Supabase JS client only
- **No NextAuth**: Supabase Auth only
- **Tailwind v4**: CSS-first config, `@theme` block in globals.css, no JS config file

## Standard Stack

### Core (already installed, verified in package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.1 | App Router, dynamic routes (`[slug]`) | Confirmed installed. Dynamic route segments for `/series/[slug]`. |
| React | 19.2.4 | UI library | Confirmed installed. Server Components for static pages, Client Components for interactive widgets. |
| motion | 12.38.0 | Staggered hero reveal, scroll-reveal animations | Confirmed installed. Same `CINEMA_EASE` pattern from hero-slide.tsx. |
| shadcn/ui | 4.1.1 | Component primitives (Badge, Button, Tabs, Select) | Confirmed installed. Tabs + Select need to be added via CLI. |
| lucide-react | 1.7.0+ | Icons (Play, Clock, Lock, ChevronDown) | Confirmed installed. Used for episode status overlays. |
| embla-carousel-react | 8.6.0 | ContentRail carousel (reuse) | Confirmed installed. Powers the "More Like This" rail. |
| Tailwind CSS | 4.x | Utility-first styling | Confirmed installed. CSS-first config with OKLCH tokens. |

### shadcn Components to Install (Phase 4)

| Component | Install Command | Purpose |
|-----------|----------------|---------|
| Tabs | `npx shadcn@latest add tabs` | Season selector (1-5 seasons variant) |
| Select | `npx shadcn@latest add select` | Season selector (6+ seasons variant) |

Both confirmed available via `--dry-run`. `radix-ui` dependency already satisfied.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn Tabs | Custom tab buttons | shadcn Tabs provides Radix keyboard nav + ARIA for free. No reason to hand-roll. |
| shadcn Select | Custom dropdown | Radix Select handles positioning, keyboard, scroll-into-view. Complex to replicate. |
| useState pagination | Virtualization (react-window) | Overkill for 20-item chunks of mock data. useState + "Load More" is simpler and matches decision D-11. |

## Architecture Patterns

### New Files to Create

```
src/
├── app/
│   ├── series/
│   │   └── [slug]/
│   │       └── page.tsx            # Series detail page (Server Component)
│   └── coming-soon/
│       └── page.tsx                # Coming Soon page (Server Component)
├── components/
│   └── series/
│       ├── series-detail-hero.tsx  # Server Component - hero with ambient glow
│       ├── season-selector.tsx     # Client Component - adaptive tabs/select
│       ├── episode-row.tsx         # Client Component - single episode row
│       └── episode-list.tsx        # Client Component - paginated list + Load More
│   └── shows/
│       └── coming-soon-show-card.tsx # Client Component - ShowCard + badge overlay
└── lib/
    └── mock-data.ts                # EXTEND (not replace) with Season, Episode
```

### Existing Files to Modify

| File | Change |
|------|--------|
| `src/lib/mock-data.ts` | Add `Season` and `Episode` interfaces, `MOCK_SEASONS`, `MOCK_EPISODES`, helper functions |

### Pattern 1: Server Component Page with Client Islands

**What:** Page files (`page.tsx`) are Server Components. Interactive sub-components are Client Components imported into the page.
**When to use:** Every page in this phase.
**Established in:** Phase 3 -- home page is server component, HeroBanner/ContentRail are client islands.

```typescript
// src/app/series/[slug]/page.tsx -- Server Component
import { SeriesDetailHero } from '@/components/series/series-detail-hero'
import { SeasonSelector } from '@/components/series/season-selector'
import { EpisodeList } from '@/components/series/episode-list'
import { ContentRail } from '@/components/home/content-rail'
import { getShowBySlug, getSeasonsByShowId, getEpisodesBySeasonId, MOCK_SHOWS } from '@/lib/mock-data'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function SeriesDetailPage({ params }: Props) {
  const { slug } = await params
  const show = getShowBySlug(slug)
  if (!show) notFound()
  // ... render components
}
```

**Critical Next.js 16 detail:** In Next.js 16, `params` is a Promise and must be awaited. This changed from Next.js 15 where params was synchronous. The pattern is `const { slug } = await params`.

### Pattern 2: Static Brand Color Maps (Tailwind v4)

**What:** Never construct dynamic Tailwind class names. Always use pre-defined static maps.
**Why:** Tailwind v4 CSS-first compilation cannot detect dynamically constructed class strings.
**Established in:** Phase 3 -- `brandColorBgMap`, `brandColorTextMap`, `brandColorHexMap` in mock-data.ts.

```typescript
// CORRECT: static lookup
import { brandColorHexMap } from '@/lib/mock-data'
const glowColor = brandColorHexMap[show.brandColor]

// WRONG: dynamic construction
const glowColor = `bg-${show.brandColor}` // Will not be included in CSS output
```

### Pattern 3: Staggered Motion Reveal (Cinema Ease)

**What:** Content elements appear sequentially with increasing delays.
**Established in:** Phase 3 hero-slide.tsx with `CINEMA_EASE = [0.16, 1, 0.3, 1]`.

```typescript
const CINEMA_EASE = [0.16, 1, 0.3, 1] as const

// Genre label: 300ms delay
// Title: 450ms delay
// Tagline: 650ms delay
// CTA: 850ms delay
// Duration: 600-850ms each element
```

The series detail hero replicates this exact pattern. The hero is static (no Ken Burns, no rotation) but uses the same staggered content reveal on mount.

### Pattern 4: Adaptive Component (Tabs vs Select)

**What:** A single `SeasonSelector` component that renders shadcn Tabs when `seasons.length <= 5` and shadcn Select when `seasons.length > 5`.
**Decision:** D-06 and D-07.

```typescript
// season-selector.tsx
'use client'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface SeasonSelectorProps {
  seasons: Season[]
  activeSeason: string
  onSeasonChange: (seasonId: string) => void
}

export function SeasonSelector({ seasons, activeSeason, onSeasonChange }: SeasonSelectorProps) {
  if (seasons.length <= 5) {
    return (
      <Tabs value={activeSeason} onValueChange={onSeasonChange}>
        <TabsList>
          {seasons.map(s => (
            <TabsTrigger key={s.id} value={s.id}>Season {s.seasonNumber}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    )
  }
  return (
    <Select value={activeSeason} onValueChange={onSeasonChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {seasons.map(s => (
          <SelectItem key={s.id} value={s.id}>Season {s.seasonNumber}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

### Pattern 5: Pagination via useState

**What:** Simple chunk-based pagination with "Load More" button.
**Decision:** D-11.

```typescript
'use client'
import { useState } from 'react'

const CHUNK_SIZE = 20

export function EpisodeList({ episodes, showBrandColor }: EpisodeListProps) {
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE)
  const visibleEpisodes = episodes.slice(0, visibleCount)
  const hasMore = visibleCount < episodes.length

  return (
    <section aria-label="Episodes">
      {visibleEpisodes.map(ep => (
        <EpisodeRow key={ep.id} episode={ep} showBrandColor={showBrandColor} />
      ))}
      {hasMore && (
        <Button variant="secondary" onClick={() => setVisibleCount(c => c + CHUNK_SIZE)}>
          Load More Episodes
        </Button>
      )}
    </section>
  )
}
```

### Pattern 6: notFound() for Invalid Slugs

**What:** When a slug does not match any show, call Next.js `notFound()` to render the 404 page.
**Why:** Graceful handling of invalid URLs. An optional `not-found.tsx` in the `[slug]` directory can provide a custom "Show Not Found" page.

```typescript
import { notFound } from 'next/navigation'

const show = getShowBySlug(slug)
if (!show) notFound()
```

### Anti-Patterns to Avoid

- **Dynamic Tailwind classes:** Never `bg-${color}`. Always use `brandColorBgMap[show.brandColor]`.
- **Putting `'use client'` on page.tsx:** Page files should remain Server Components. Only interactive children need `'use client'`.
- **Using `useEffect` for data fetching:** Mock data is synchronous and available at import time. No fetch needed.
- **Building a custom tab/select component:** shadcn Tabs + Select provide Radix accessibility for free.
- **Using Link for non-interactive episodes:** Coming Soon and Locked episodes must NOT be wrapped in `<Link>` or `<a>`. They use `aria-disabled="true"`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Season tab navigation | Custom tab buttons with manual ARIA | shadcn Tabs (Radix TabsList) | Keyboard nav, focus management, aria-selected handled automatically |
| Season dropdown | Custom dropdown with state | shadcn Select (Radix Select) | Positioning, scroll-into-view, typeahead, keyboard all handled |
| Carousel for "More Like This" | Custom horizontal scroll | Existing ContentRail component | Already built, tested, and styled in Phase 3 |
| Show card | New show card component | Existing ShowCard component | Already built with brand ribbon, hover overlay, badges |
| Accessible focus ring | Manual focus styles | `group-focus-within` pattern from ShowCard | Established pattern that works with keyboard nav |

**Key insight:** Phase 4 is primarily an assembly phase. The component primitives (Badge, Button, ContentRail, ShowCard) and patterns (brand color maps, cinema ease, scroll-reveal) already exist. The main new work is the EpisodeRow layout, SeasonSelector adaptive logic, and the SeriesDetailHero -- all of which follow established visual conventions.

## Common Pitfalls

### Pitfall 1: Next.js 16 Async Params

**What goes wrong:** Using `params.slug` directly without awaiting causes a type error in Next.js 16.
**Why it happens:** Next.js 16 changed `params` to be a Promise to support streaming and parallel data loading.
**How to avoid:** Always `const { slug } = await params` in page components.
**Warning signs:** TypeScript error "Property 'slug' does not exist on type 'Promise<...>'"

### Pitfall 2: Hero Negative Margin with Main Padding

**What goes wrong:** The series detail hero needs `-mt-16` to bleed behind the navbar (same as home hero), but the `<main>` element has `pt-16`. If the hero does not account for this, it renders 16px too low.
**Why it happens:** Root layout has `<main className="pt-16">` to push content below the fixed navbar. The home hero uses `-mt-16` on the hero container to counteract this and bleed behind the navbar.
**How to avoid:** Apply `-mt-16` on the outermost container of the series detail page (or on the hero component itself), matching the home page pattern.
**Warning signs:** Visible gap between navbar and hero top edge.

### Pitfall 3: Episode Row Click Handler on Non-Interactive States

**What goes wrong:** Wrapping all episode rows in `<Link>` or attaching click handlers to coming-soon/locked episodes creates confusing UX and accessibility violations.
**Why it happens:** Developer applies the same wrapper to all rows without checking `episode.status`.
**How to avoid:** Conditionally render: `status === 'published'` gets a `<Link>` wrapper; others get a plain `<div>` with `aria-disabled="true"`.
**Warning signs:** Screen reader announces coming-soon episodes as clickable links.

### Pitfall 4: Missing `generateStaticParams` for Static Export

**What goes wrong:** Without `generateStaticParams`, the `[slug]` route is dynamically rendered on every request, which is fine for mock data but worth noting.
**Why it happens:** Phase 4 uses mock data, not a database.
**How to avoid:** Optionally add `generateStaticParams` that returns all mock show slugs. This pre-renders all detail pages at build time, improving Vercel deployment performance.
**Warning signs:** Slow initial page loads on the Vercel deployment.

```typescript
export function generateStaticParams() {
  return MOCK_SHOWS.map(show => ({ slug: show.slug }))
}
```

### Pitfall 5: Ambient Glow Color Not Matching Hero Slide Pattern

**What goes wrong:** The series detail hero glow looks different from the home hero glow.
**Why it happens:** Using different radial-gradient parameters or opacity values.
**How to avoid:** Copy the exact gradient pattern from `hero-slide.tsx` line 52-53: `radial-gradient(ellipse 80% 80% at 60% 40%, ${hex}55 0%, ${hex}22 40%, transparent 70%)`. Apply via inline `style` prop, not Tailwind classes (hex values are dynamic per show).
**Warning signs:** Side-by-side comparison shows different glow intensity or shape.

### Pitfall 6: Season Selector Threshold Off-By-One

**What goes wrong:** D-06 says tabs for 1-5, dropdown for 6+. But CONTEXT.md specifics section says `seasons.length <= 5` for tabs and `seasons.length > 6` for dropdown, which would leave 6 seasons with no handler.
**Why it happens:** Inconsistency in the context document between the decision (D-06: "6+ seasons") and the specifics section ("seasons.length > 6").
**How to avoid:** Use `seasons.length <= 5` for tabs, `else` for dropdown (which means 6+ triggers dropdown). This matches D-06 which is the authoritative decision.
**Warning signs:** A show with exactly 6 seasons renders tabs that overflow the container.

## Code Examples

### Series Detail Hero (Ambient Glow + Gradient)

```typescript
// Source: Adapted from src/components/home/hero-slide.tsx (Phase 3)
// SeriesDetailHero is a SERVER component (no 'use client') since it has no interactivity.
// The staggered animation requires 'use client' -- extract animated content to a client sub-component
// OR make the whole hero a client component for simplicity (it's a leaf component).

import { brandColorBgMap, brandColorHexMap, type Show } from '@/lib/mock-data'

// Ambient glow (inline style, same as hero-slide.tsx)
const glowStyle = {
  background: `radial-gradient(ellipse 80% 80% at 60% 40%, ${brandColorHexMap[show.brandColor]}55 0%, ${brandColorHexMap[show.brandColor]}22 40%, transparent 70%)`,
}

// Cinematic gradient overlay (inline style, same as hero-slide.tsx)
const gradientStyle = {
  background: [
    'linear-gradient(to right, rgba(8,8,12,0.96) 0%, rgba(8,8,12,0.72) 35%, rgba(8,8,12,0.25) 65%, rgba(8,8,12,0) 100%)',
    'linear-gradient(to top, rgba(8,8,12,1) 0%, rgba(8,8,12,0.85) 18%, rgba(8,8,12,0.3) 40%, rgba(8,8,12,0) 65%)',
    'linear-gradient(to bottom, rgba(8,8,12,0.4) 0%, transparent 15%)',
  ].join(', '),
}
```

### Episode Row Component (Conditional Rendering by Status)

```typescript
// Source: UI-SPEC D-08, D-09, D-10
import Link from 'next/link'
import { Play, Clock, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

// Published: interactive link with play overlay
// Coming Soon / Locked: non-interactive with icon overlay + badge

function EpisodeRow({ episode, showBrandColor }: EpisodeRowProps) {
  const isPublished = episode.status === 'published'
  const isComingSoon = episode.status === 'coming-soon'

  const Wrapper = isPublished ? Link : 'div'
  const wrapperProps = isPublished
    ? { href: '#', className: 'group cursor-pointer' }
    : { 'aria-disabled': true, className: 'cursor-default' }

  return (
    <Wrapper {...wrapperProps}>
      {/* Thumbnail with status overlay */}
      <div className={`relative aspect-video w-[200px] ${!isPublished ? 'opacity-45' : ''}`}>
        {/* Brand color placeholder */}
        {isPublished && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <Play className="size-5 text-white" />
          </div>
        )}
        {isComingSoon && <Clock className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-6 text-white" />}
        {episode.status === 'locked' && <Lock className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-6 text-white" />}
      </div>
      {/* Text content */}
      {/* ... episode number, title, description, duration, badge */}
    </Wrapper>
  )
}
```

### Mock Data Extension Pattern

```typescript
// Source: CONTEXT.md D-16, D-17, UI-SPEC Mock Data Contract
export interface Season {
  id: string
  showId: string
  seasonNumber: number
  title: string
  episodeCount: number
}

export interface Episode {
  id: string
  showId: string
  seasonId: string
  episodeNumber: number
  title: string
  description: string
  duration: number     // minutes
  status: 'published' | 'coming-soon' | 'locked'
  youtubeId?: string
}

// Helper functions return filtered/sorted subsets
export function getShowBySlug(slug: string): Show | undefined {
  return MOCK_SHOWS.find(s => s.slug === slug)
}

export function getSeasonsByShowId(showId: string): Season[] {
  return MOCK_SEASONS.filter(s => s.showId === showId)
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
}

export function getEpisodesBySeasonId(seasonId: string): Episode[] {
  return MOCK_EPISODES.filter(e => e.seasonId === seasonId)
    .sort((a, b) => a.episodeNumber - b.episodeNumber)
}

export function getComingSoonEpisodesFromStreamingShows(): (Episode & { showTitle: string })[] {
  const streamingShowIds = MOCK_SHOWS.filter(s => s.status === 'streaming').map(s => s.id)
  return MOCK_EPISODES
    .filter(e => e.status === 'coming-soon' && streamingShowIds.includes(e.showId))
    .map(e => ({
      ...e,
      showTitle: MOCK_SHOWS.find(s => s.id === e.showId)!.title,
    }))
}
```

### generateMetadata for Dynamic Routes

```typescript
// Source: Next.js 16 App Router pattern
import type { Metadata } from 'next'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const show = getShowBySlug(slug)
  if (!show) return { title: 'Show Not Found | Clickit Story' }
  return {
    title: `${show.title} | Clickit Story`,
    description: show.description,
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Synchronous `params` in page components | `params` is a Promise, must be awaited | Next.js 15+ (stable in 16) | All dynamic route pages must `await params` |
| `framer-motion` package name | `motion` package, import from `motion/react` | 2024 | Already using correct package in Phase 3 |
| Tailwind JS config (`tailwind.config.js`) | CSS-first config (`@theme` in globals.css) | Tailwind v4 (Jan 2025) | Already using correct approach |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | Not relevant to Phase 4 (no auth yet) |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 |
| Config file | `playwright.config.ts` (exists, chromium-only) |
| Quick run command | `npx playwright test tests/e2e/series-detail.spec.ts --project=chromium` |
| Full suite command | `npx playwright test --project=chromium` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CATL-03 | Series detail hero with artwork, title, metadata, CTA | e2e | `npx playwright test tests/e2e/series-detail.spec.ts -g "hero"` | No -- Wave 0 |
| CATL-04 | Season selector switches episode list | e2e | `npx playwright test tests/e2e/series-detail.spec.ts -g "season"` | No -- Wave 0 |
| CATL-05 | Episode rows with thumbnail, number, title, duration | e2e | `npx playwright test tests/e2e/series-detail.spec.ts -g "episode"` | No -- Wave 0 |
| CATL-06 | Status badges on episode cards | e2e | `npx playwright test tests/e2e/series-detail.spec.ts -g "badge"` | No -- Wave 0 |
| CATL-07 | Coming Soon page with unreleased shows + episodes | e2e | `npx playwright test tests/e2e/coming-soon.spec.ts` | No -- Wave 0 |
| CATL-11 | Broadcast schedule | n/a | Moved to Phase 7 -- no test needed | n/a |

### Sampling Rate

- **Per task commit:** `npx playwright test tests/e2e/series-detail.spec.ts tests/e2e/coming-soon.spec.ts --project=chromium`
- **Per wave merge:** `npx playwright test --project=chromium`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/e2e/series-detail.spec.ts` -- covers CATL-03, CATL-04, CATL-05, CATL-06
- [ ] `tests/e2e/coming-soon.spec.ts` -- covers CATL-07

No framework install needed -- Playwright already configured and working (tests exist for Phase 2 and 3).

## Open Questions

1. **Series detail hero: server or client component?**
   - What we know: The hero has no user interaction (no clicks, no state), suggesting Server Component. However, the staggered `motion` reveal animation requires `'use client'`.
   - Recommendation: Make `SeriesDetailHero` a client component for simplicity. The motion animations require it. The performance cost is minimal since it's a leaf component with no children that need server rendering.

2. **`generateStaticParams` for mock data phase?**
   - What we know: Without it, `/series/[slug]` is dynamically rendered. With it, pages are pre-built at deploy time.
   - Recommendation: Include `generateStaticParams` returning all mock show slugs. Improves Vercel deployment performance and matches streaming platform expectations (all pages should load instantly).

3. **Episode placeholder thumbnails -- what visual treatment?**
   - What we know: No real artwork exists yet. Show artwork uses brand color fill + title text (Phase 3 ShowCard pattern).
   - Recommendation: Episode thumbnails use the show's `brandColor` fill + centered episode number text (e.g., "E1") in white. Consistent with the Phase 3 placeholder pattern but adapted for episodes.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `src/components/home/hero-slide.tsx` -- ambient glow, gradient overlay, cinema ease, staggered reveal patterns
- Codebase inspection: `src/components/home/content-rail.tsx` -- ContentRail props interface, carousel configuration
- Codebase inspection: `src/components/shows/show-card.tsx` -- brand color map usage, group-hover/focus-within pattern
- Codebase inspection: `src/lib/mock-data.ts` -- Show interface, brandColor maps, current data shape
- Codebase inspection: `src/app/layout.tsx` -- main element has `pt-16`, confirming `-mt-16` hero pattern
- Codebase inspection: `src/app/series/page.tsx` -- existing grid layout at `/series`
- Codebase inspection: `src/styles/globals.css` -- all design tokens, surface colors, text hierarchy colors
- shadcn CLI dry-run: Tabs and Select both available, `radix-ui` already installed
- `package.json`: All dependencies confirmed (motion 12.38.0, Next.js 16.2.1, React 19.2.4)
- `playwright.config.ts`: Test infrastructure confirmed (chromium-only, port 3000)

### Secondary (MEDIUM confidence)
- CONTEXT.md D-01 through D-18: User decisions from discussion phase
- UI-SPEC: Component inventory, layout specs, interaction specs, copywriting contract

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified, no new packages needed beyond shadcn Tabs + Select
- Architecture: HIGH -- extends established Phase 3 patterns (hero, content rail, show card, brand color maps)
- Pitfalls: HIGH -- identified from direct codebase inspection (async params, negative margin, conditional link wrapping)

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable -- all patterns are established in the codebase)
