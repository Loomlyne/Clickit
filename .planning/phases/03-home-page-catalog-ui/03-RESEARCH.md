# Phase 3: Home Page & Catalog UI - Research

**Researched:** 2026-03-31
**Domain:** Cinematic home page UI -- hero banner, content rails, show cards, catalog grid
**Confidence:** HIGH

## Summary

Phase 3 builds the visual centerpiece of the CIT platform: a cinematic home page with an auto-rotating hero banner, horizontal content rails powered by Embla Carousel, and a `/series` catalog grid. All data is static TypeScript mock objects -- no Supabase integration yet. The key technical domains are: (1) the `motion` library (v12.x, imported from `motion/react`) for crossfade hero transitions, card hover effects, and page entrance animations; (2) `embla-carousel-react` (v8.6.x) for touch-friendly horizontal content rails; and (3) the shadcn `Carousel` and `Card` components as structural wrappers. The design tokens, surfaces, and brand colors are fully established from Phase 1 -- this phase consumes them, never redefines them.

The critical architectural challenge is the hero banner extending behind the fixed navbar. The root layout applies `pt-16` to `<main>` to clear the 64px-high navbar. The home page must negate this padding for the hero section (via negative margin or conditional layout) while keeping it for all other pages. The hero crossfade uses `AnimatePresence` with `mode="sync"` (default) for simultaneous fade-out/fade-in, creating a smooth crossfade without the sequential delay that `mode="wait"` would impose.

**Primary recommendation:** Install `motion` and `embla-carousel-react`, add shadcn `Card` and `Carousel` components, build the component tree bottom-up (mock data type -> ShowCard -> ContentRail -> HeroBanner -> HomePage -> SeriesPage), and use `"use client"` directives only on components that need interactivity (HeroBanner, ContentRail, ShowCard).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Full viewport height (100vh) hero banner
- **D-02:** Auto-rotating carousel cycling through 2-3 featured shows, timer-based
- **D-03:** Full-bleed show artwork + ambient color glow from show's brandColor
- **D-04:** Hero text: show title + tagline + "Watch Now" CTA button
- **D-05:** Crossfade transition between featured shows (not slide/pan)
- **D-06:** Thin progress bar indicator for rotation (replaces dot indicators)
- **D-07:** Pause on hover
- **D-08:** Bottom edge gradient fade to #0A0A0F
- **D-09:** Card aspect ratio: landscape 16:9
- **D-10:** Card info: artwork thumbnail, title, genre chip, episode count chip
- **D-11:** Show logo SVG positioned bottom-left on artwork
- **D-12:** Hover: scale 1.05 + dark overlay + centered "Watch" button, uses motion
- **D-13:** Card text area bg-card (#1A1A22)
- **D-14:** Brand color ribbon: 3-4px at top edge of card
- **D-15:** Islamic geometric patterns DEFERRED (color-only ribbons for Phase 3)
- **D-16:** Brand color assigned manually per show in mock data
- **D-17:** Rails use placeholder cards to fill visual gaps
- **D-18:** Pad rails to minimum ~4 visible cards on desktop
- **D-19:** 5 mock shows: Last Call, Review Documentary, Doctor Care, Saturn Podcast, Poets Platform
- **D-20:** Mock data in `src/lib/mock-data.ts`, shape matches future Supabase schema
- **D-21:** Route `/series` for catalog page
- **D-22:** Responsive grid: 4/3/2/1 columns at xl/lg/sm/mobile
- **D-23:** No filters for Phase 3

### Claude's Discretion
- Exact motion timing values (crossfade duration, card hover scale duration, progress bar fill speed)
- Hero content horizontal padding / text positioning (left-aligned vs centered)
- Embla carousel configuration (loop, drag, touch behavior)
- Section header typography and spacing
- Overlay opacity on card hover
- Whether content rails have "See All" links
- Placeholder card visual treatment

### Deferred Ideas (OUT OF SCOPE)
- Islamic geometric pattern textures on brand ribbons
- Genre/status filters on `/series`
- Trailer preview on hover
- Per-show "Coming Soon" countdown timers
- Search bar (Phase 8)
- Continue watching rail (Phase 9)
- Watchlist button on cards (Phase 9)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CATL-01 | Home page displays cinematic hero banner featuring a show | HeroBanner component with AnimatePresence crossfade, motion transitions, ambient glow via radial gradient |
| CATL-02 | Home page displays horizontal content rails (Now Streaming, Coming Soon, by genre) | ContentRail component using shadcn Carousel (wrapping embla-carousel-react), section headers, ShowCard items |
| CATL-08 | Series listing page shows all available shows in card grid | `/series` route with responsive Tailwind grid, reusing ShowCard component |
| CATL-09 | Show cards display per-show branded artwork and logo | ShowCard with brandColor ribbon, placeholder artwork, logo overlay (placeholder text for Phase 3) |
| CATL-10 | Content rails and cards look intentional with few shows (empty-state design) | PlaceholderCard component pads rails to minimum 4 visible cards; empty state messaging defined in UI-SPEC |
| DESG-02 | Large cinematic hero banners with show artwork | Full 100vh hero with gradient overlays, show artwork background, and responsive typography |
| DESG-03 | Horizontal episode cards with hover state (scale, overlay) | ShowCard with motion whileHover scale(1.05), overlay fade, "Watch" button entrance |
| DESG-04 | Clean white typography on dark backgrounds | text-primary (#FFFFFF) on bg-background (#0A0A0F) and bg-card (#1A1A22), all WCAG AA verified |
| DESG-05 | CIT brand color accents on cards, badges, CTAs, category ribbons | Brand color ribbon on cards, hero CTA uses bg-primary, badges use brand-green/brand-orange |
| DESG-07 | Subtle motion/transitions (page transitions, card hovers) | motion library for card hover, hero crossfade, content rail stagger; page fade-in on mount |
| DESG-08 | Per-show color ribbon using CIT brand pattern system | 3-4px solid color bar at card top edge using show's brandColor token; pattern textures deferred |
| DESG-09 | Small metadata chips (duration, episode count, genre, status) | shadcn Badge component with secondary variant for genre/episode count, custom brand color variants for status |
</phase_requirements>

## Standard Stack

### Core (New Installs for Phase 3)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| motion | 12.38.0 | UI animations | Renamed from framer-motion. React 19 compatible. Declarative `<motion.div>` API for hero crossfade, card hover, page transitions. ~15KB gzipped. Import from `motion/react`. |
| embla-carousel-react | 8.6.0 | Content rail carousels | Lightweight (~4KB), zero dependencies, hook-based API. Touch/swipe support. shadcn Carousel wraps this. |

**Version verification (npm registry, 2026-03-31):**
- `motion`: 12.38.0 (latest)
- `embla-carousel-react`: 8.6.0 (latest)
- `embla-carousel`: 8.6.0 (peer dependency, installed with embla-carousel-react)

### shadcn Components to Add

| Component | Install Command | Purpose |
|-----------|----------------|---------|
| Card | `npx shadcn@latest add card` | Structural wrapper for ShowCard (provides consistent border-radius and bg-card surface) |
| Carousel | `npx shadcn@latest add carousel` | Wraps embla-carousel-react with accessible prev/next controls, keyboard nav. Used by ContentRail. |

### Already Installed (No Action)

| Library | Version | Purpose |
|---------|---------|---------|
| next | 16.2.1 | Framework |
| react | 19.2.4 | UI library |
| lucide-react | ^1.7.0 | Icons (ChevronLeft, ChevronRight, Play, Lock) |
| class-variance-authority | ^0.7.1 | Variant-based component styling |
| shadcn Badge | existing | Genre chips, episode count chips, status badges |
| shadcn Button | existing | Hero CTA, card hover overlay button |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn Carousel | Raw embla-carousel-react | Shadcn Carousel adds accessible prev/next buttons, keyboard nav, and consistent styling. Use shadcn unless we need extreme customization. |
| AnimatePresence crossfade | CSS transitions only | CSS can do opacity crossfade but lacks the exit animation lifecycle. AnimatePresence guarantees the outgoing element stays in DOM until fade completes. |
| Placeholder colored divs for artwork | External placeholder images | Colored divs with centered text are zero-network-dependency, load instantly, and match brand colors. Perfect for mock data phase. |

**Installation:**
```bash
npm install motion embla-carousel-react embla-carousel
npx shadcn@latest add card carousel
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/
    page.tsx              # Home page (server component shell, imports client sections)
    series/
      page.tsx            # Series catalog grid page
  components/
    home/
      hero-banner.tsx     # 'use client' - auto-rotating hero with AnimatePresence
      hero-slide.tsx      # Single hero slide (artwork, gradient, text, CTA)
      rotation-indicator.tsx  # 'use client' - progress bar indicators
      content-rail.tsx    # 'use client' - section header + shadcn Carousel
    shows/
      show-card.tsx       # 'use client' - 16:9 card with hover effects
      placeholder-card.tsx  # Server component - "Coming Soon" filler card
    ui/
      card.tsx            # shadcn Card (added via CLI)
      carousel.tsx        # shadcn Carousel (added via CLI)
      badge.tsx           # existing
      button.tsx          # existing
  lib/
    mock-data.ts          # Show type + 5 mock shows
    utils.ts              # existing cn() utility
```

### Pattern 1: Hero Crossfade with AnimatePresence

**What:** Use `AnimatePresence` with default `mode="sync"` to create a crossfade between hero slides. The `key` prop on the motion element triggers exit/entry when it changes.

**When to use:** Any time two elements need to smoothly crossfade (one fading out while the next fades in simultaneously).

**Example:**
```typescript
// Source: https://motion.dev/docs/react-animate-presence
"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"

function HeroBanner({ shows }: { shows: Show[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    if (isPaused) return
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % shows.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [isPaused, shows.length])

  const activeShow = shows[activeIndex]

  return (
    <div
      className="relative h-screen w-full overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <AnimatePresence mode="sync">
        <motion.div
          key={activeShow.id}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          {/* Artwork background + gradient overlay + text content */}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
```

**Critical detail:** `mode="sync"` (default) means old and new slides exist simultaneously during the crossfade. Both are `position: absolute` and overlapping, creating the crossfade effect. Do NOT use `mode="wait"` -- that would cause a sequential exit-then-enter, not a crossfade.

### Pattern 2: Content Rail with shadcn Carousel

**What:** Use the shadcn Carousel component (which wraps embla-carousel-react) for horizontal content rails. Control item sizing with Tailwind `basis` classes on CarouselItem.

**When to use:** Any horizontal scrollable list of cards.

**Example:**
```typescript
// Source: https://ui.shadcn.com/docs/components/radix/carousel
"use client"

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

function ContentRail({ title, shows, seeAllHref }: ContentRailProps) {
  return (
    <section>
      <div className="flex items-center justify-between px-12">
        <h2 className="text-2xl font-bold text-primary">{title}</h2>
        {seeAllHref && (
          <a href={seeAllHref} className="text-sm text-brand-blue-safe hover:underline">
            See All
          </a>
        )}
      </div>
      <Carousel
        opts={{
          align: "start",
          containScroll: "trimSnaps",
          dragFree: false,
          loop: false,
          slidesToScroll: 1,
        }}
        className="mt-4"
      >
        <CarouselContent className="-ml-6">
          {shows.map((show) => (
            <CarouselItem key={show.id} className="pl-6 basis-1/2 lg:basis-1/3 xl:basis-1/4">
              <ShowCard show={show} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </section>
  )
}
```

### Pattern 3: Card Hover with Motion

**What:** Use motion.div with `whileHover` for the card scale effect, and a nested overlay that fades in.

**When to use:** Interactive cards that need animated hover states with an overlay.

**Example:**
```typescript
// Source: https://motion.dev/docs/react-motion-component
"use client"

import { motion } from "motion/react"
import { Button } from "@/components/ui/button"

function ShowCard({ show }: { show: Show }) {
  return (
    <motion.div
      className="group relative overflow-hidden rounded-lg"
      whileHover={{ scale: 1.05 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {/* Brand ribbon */}
      <div className={`h-1 bg-${show.brandColor}`} />

      {/* 16:9 artwork area */}
      <div className="relative aspect-video">
        {/* Placeholder artwork (solid color + title) */}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(10,10,15,0.65)] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <Button variant="default">Watch</Button>
        </div>
      </div>

      {/* Card text area */}
      <div className="bg-card p-4">
        <h3 className="truncate font-bold text-primary">{show.title}</h3>
        <div className="mt-2 flex gap-2">
          <Badge variant="secondary">{show.genre}</Badge>
          <Badge variant="secondary" className="text-muted-foreground">
            {show.episodeCount} Episodes
          </Badge>
        </div>
      </div>
    </motion.div>
  )
}
```

**Note on brand color classes:** Tailwind v4 cannot detect dynamic class names like `` bg-${show.brandColor} ``. Use a mapping object instead:

```typescript
const brandColorMap: Record<Show['brandColor'], string> = {
  'brand-blue': 'bg-brand-blue',
  'brand-purple': 'bg-brand-purple',
  'brand-green': 'bg-brand-green',
  'brand-red': 'bg-brand-red',
  'brand-orange': 'bg-brand-orange',
}
```

### Pattern 4: Hero Behind Navbar

**What:** The root layout applies `pt-16` on `<main>` to clear the 64px fixed navbar. The home page hero needs to extend behind the navbar for the full-bleed cinematic effect.

**When to use:** Home page only. All other pages use the default `pt-16`.

**Approach:** Apply negative top margin on the hero container to pull it up behind the navbar, then add internal top padding so text content clears the nav.

```typescript
// Home page hero wrapper
<div className="-mt-16 h-screen">
  {/* Hero content positioned with bottom alignment, well below navbar */}
</div>
```

This preserves the root layout's `pt-16` on `<main>` for all other pages while allowing the hero to extend under the glass navbar. The hero's text content is positioned at the bottom of the viewport (per UI-SPEC: 120px above bottom), so it naturally clears the navbar without additional padding.

**Alternative:** Create a home-specific layout that removes `pt-16`. However, this is more complex and the negative margin approach is simpler and well-supported.

### Anti-Patterns to Avoid

- **Dynamic Tailwind class strings:** Never use template literals for Tailwind classes (`` `bg-${color}` ``). Tailwind v4 cannot detect dynamic class names at build time. Use a static mapping object instead.
- **`motion/react-client` for components that need hooks:** The `motion/react-client` import is for server components that render motion elements. Since HeroBanner, ContentRail, and ShowCard all use React hooks (useState, useEffect), they must use `"use client"` directive and import from `motion/react`.
- **`mode="wait"` for crossfade:** Using `AnimatePresence mode="wait"` will cause the old slide to fully exit before the new one enters. This is NOT a crossfade -- it's a sequential transition. Use the default `mode="sync"` for true crossfade.
- **Modifying the Navbar:** The Navbar component is Phase 2 output and should not be modified. It's a server component with glass effect already working.
- **Hardcoding hex colors:** All colors are tokenized in `globals.css` as `@theme` block values. Use `bg-background`, `text-primary`, `bg-brand-purple`, etc. Never write `#0A0A0F` directly in component code.
- **Missing `key` prop on AnimatePresence children:** AnimatePresence requires a unique `key` on each direct child to track enter/exit. Without it, no exit animation fires.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Horizontal carousel | Custom scroll handler with refs | shadcn Carousel (embla-carousel-react) | Touch/swipe, snap points, keyboard nav, prev/next buttons, `containScroll` edge handling all built-in |
| Exit animations | Manual DOM removal timers | AnimatePresence from motion/react | Lifecycle management of exiting elements is complex; AnimatePresence handles DOM removal timing |
| Card border radius / surface | Custom div with manual border-radius | shadcn Card component | Consistent rounded corners, bg-card surface, and foreground colors from theme |
| Accessible carousel navigation | Custom arrow buttons | shadcn CarouselPrevious / CarouselNext | Built-in aria-labels, disabled state management, keyboard support |
| Reduced motion detection | Custom matchMedia listener | `useReducedMotion()` from motion/react | Auto-updates on system setting change, no cleanup needed |
| Dynamic brand color classes | Template literal class names | Static mapping object (brandColorMap) | Tailwind v4 tree-shakes unused classes; dynamic strings are invisible to the compiler |

**Key insight:** The shadcn Carousel wraps embla-carousel-react with accessibility and styling baked in. Using it instead of raw embla saves significant boilerplate for prev/next buttons, disabled states, and keyboard navigation.

## Common Pitfalls

### Pitfall 1: Tailwind Dynamic Class Names
**What goes wrong:** Writing `` className={`bg-${show.brandColor}`} `` produces no styling because Tailwind v4 purges classes not found statically in source files.
**Why it happens:** Tailwind scans source code at build time for class names. Dynamic string construction is invisible to the scanner.
**How to avoid:** Create a static mapping object that maps data values to complete class name strings. Import and use the map in components.
**Warning signs:** Colored elements appear with no background color in the browser.

### Pitfall 2: AnimatePresence Mode for Crossfade
**What goes wrong:** Using `mode="wait"` causes a visible gap between hero slides instead of a smooth crossfade.
**Why it happens:** `mode="wait"` forces the exiting element to complete its exit animation before the entering element starts. For a crossfade, both must animate simultaneously.
**How to avoid:** Use the default `mode="sync"`. Both old and new elements must be `position: absolute` so they overlap during the crossfade.
**Warning signs:** Visible flash of background between hero slides.

### Pitfall 3: Hero Section Not Extending Behind Navbar
**What goes wrong:** Hero has a 64px gap at the top, breaking the full-bleed cinematic effect.
**Why it happens:** Root layout has `<main className="pt-16">` to clear the fixed navbar. This padding applies to ALL pages including home.
**How to avoid:** Apply `-mt-16` on the hero container to negate the main padding. Verify the hero is `h-screen` (100vh), and hero text content is positioned at the bottom, well below the navbar.
**Warning signs:** Visible gap between navbar bottom and hero artwork top.

### Pitfall 4: Embla Carousel With Too Few Items
**What goes wrong:** With only 2-3 real show cards, the carousel looks broken -- cards don't fill the viewport, navigation arrows behave oddly.
**Why it happens:** `containScroll: "trimSnaps"` with few items means no scrolling is possible, and arrows may both be disabled.
**How to avoid:** Per D-17/D-18, pad each rail with PlaceholderCard components to reach minimum 4 visible cards on desktop. The placeholder cards ensure visual density even with sparse real content.
**Warning signs:** Content rail with only 1-2 cards and large empty space to the right.

### Pitfall 5: Auto-Rotation Timer Not Resetting on Manual Interaction
**What goes wrong:** After pausing on hover and resuming, the rotation timer doesn't reset cleanly, causing rapid-fire slide changes.
**Why it happens:** The setInterval isn't properly cleaned up and restarted when pause state changes.
**How to avoid:** Use `useEffect` with `isPaused` in the dependency array. Clear the interval on cleanup. This ensures a fresh 6000ms interval starts each time pause state changes.
**Warning signs:** Multiple slides cycling rapidly after mouse leaves the hero area.

### Pitfall 6: Focus Management on Hero Auto-Rotation
**What goes wrong:** Screen readers announce slide changes too frequently, and keyboard users can't stop the rotation.
**Why it happens:** Auto-rotation doesn't pause on focus, violating WCAG 2.2.2 (Pause, Stop, Hide).
**How to avoid:** Per UI-SPEC accessibility notes, pause auto-rotation when any hero element receives keyboard focus (not just hover). Use `onFocus`/`onBlur` on the hero container alongside `onMouseEnter`/`onMouseLeave`. Add `aria-live="polite"` on the hero title region.
**Warning signs:** Auto-rotation continues while a keyboard user is tabbing through hero controls.

### Pitfall 7: Missing prefers-reduced-motion Support
**What goes wrong:** Users with vestibular disorders experience discomfort from auto-rotation and scale animations.
**Why it happens:** Developer forgets to check the reduced motion preference.
**How to avoid:** Wrap the app (or hero section) in `<MotionConfig reducedMotion="user">` to automatically disable transform animations when the OS setting is on. Also disable auto-rotation when `useReducedMotion()` returns true. The UI-SPEC explicitly requires: disable auto-rotation, disable card hover scale, use instant crossfade (0ms).
**Warning signs:** Animations play even when system "Reduce motion" is enabled.

## Code Examples

### Mock Data Type and Data (Verified from UI-SPEC)

```typescript
// src/lib/mock-data.ts
// Source: 03-UI-SPEC.md Mock Data Shape section

export interface Show {
  id: string
  title: string
  slug: string
  tagline: string
  description: string
  genre: string
  episodeCount: number
  seasonCount: number
  status: 'streaming' | 'coming-soon'
  brandColor: 'brand-blue' | 'brand-purple' | 'brand-green' | 'brand-red' | 'brand-orange'
}

export const MOCK_SHOWS: Show[] = [
  {
    id: '1',
    title: 'Last Call',
    slug: 'last-call',
    tagline: 'Every night has a story',
    description: 'Late-night entertainment from Abu Dhabi.',
    genre: 'Entertainment',
    episodeCount: 24,
    seasonCount: 2,
    status: 'streaming',
    brandColor: 'brand-purple',
  },
  {
    id: '2',
    title: 'Review Documentary',
    slug: 'review-documentary',
    tagline: 'Stories that shape our world',
    description: 'In-depth documentary series exploring untold stories.',
    genre: 'Documentary',
    episodeCount: 12,
    seasonCount: 1,
    status: 'streaming',
    brandColor: 'brand-blue',
  },
  {
    id: '3',
    title: 'Doctor Care',
    slug: 'doctor-care',
    tagline: 'Your health, simplified',
    description: 'Expert health advice for everyday living.',
    genre: 'Health',
    episodeCount: 18,
    seasonCount: 2,
    status: 'streaming',
    brandColor: 'brand-green',
  },
  {
    id: '4',
    title: 'Saturn Podcast',
    slug: 'saturn-podcast',
    tagline: 'Conversations beyond orbit',
    description: 'Tech and culture conversations with UAE innovators.',
    genre: 'Tech',
    episodeCount: 30,
    seasonCount: 3,
    status: 'streaming',
    brandColor: 'brand-orange',
  },
  {
    id: '5',
    title: 'Poets Platform',
    slug: 'poets-platform',
    tagline: 'Words that move mountains',
    description: 'A stage for the greatest voices in Arabic poetry.',
    genre: 'Poetry',
    episodeCount: 8,
    seasonCount: 1,
    status: 'coming-soon',
    brandColor: 'brand-red',
  },
]
```

### Brand Color Mapping (Tailwind-Safe)

```typescript
// Static mapping for Tailwind v4 tree-shaking compatibility
export const brandColorBgMap: Record<Show['brandColor'], string> = {
  'brand-blue': 'bg-brand-blue',
  'brand-purple': 'bg-brand-purple',
  'brand-green': 'bg-brand-green',
  'brand-red': 'bg-brand-red',
  'brand-orange': 'bg-brand-orange',
}

export const brandColorTextMap: Record<Show['brandColor'], string> = {
  'brand-blue': 'text-brand-blue',
  'brand-purple': 'text-brand-purple',
  'brand-green': 'text-brand-green',
  'brand-red': 'text-brand-red',
  'brand-orange': 'text-brand-orange',
}

// For hero ambient glow (radial-gradient with brand color at low opacity)
export const brandColorHexMap: Record<Show['brandColor'], string> = {
  'brand-blue': '#2C3569',
  'brand-purple': '#9F54A0',
  'brand-green': '#50A258',
  'brand-red': '#DB3F34',
  'brand-orange': '#EA8C2E',
}
```

### Hero Gradient Overlay (from UI-SPEC)

```css
/* Source: 03-UI-SPEC.md Hero Gradient Overlay section */
background: linear-gradient(
  to right,
  rgba(10, 10, 15, 0.85) 0%,
  rgba(10, 10, 15, 0.6) 40%,
  rgba(10, 10, 15, 0.2) 70%,
  rgba(10, 10, 15, 0) 100%
),
linear-gradient(
  to top,
  rgba(10, 10, 15, 1) 0%,
  rgba(10, 10, 15, 0.4) 30%,
  rgba(10, 10, 15, 0) 60%
);
```

### Embla Carousel Options (from UI-SPEC)

```typescript
// Source: 03-UI-SPEC.md Embla Carousel Configuration section
import type { EmblaOptionsType } from "embla-carousel"

const contentRailOptions: EmblaOptionsType = {
  align: 'start',
  containScroll: 'trimSnaps',
  dragFree: false,
  loop: false,
  slidesToScroll: 1,
}
```

### MotionConfig for Reduced Motion

```typescript
// Source: https://motion.dev/docs/react-accessibility
import { MotionConfig } from "motion/react"

// Wrap at app level or hero level
<MotionConfig reducedMotion="user">
  {/* All motion components inside automatically respect OS reduce-motion setting */}
  {/* Transform and layout animations are disabled; opacity still works */}
</MotionConfig>
```

### 16:9 Aspect Ratio

```typescript
// Source: https://tailwindcss.com/docs/aspect-ratio
// Tailwind v4 uses native CSS aspect-ratio property
<div className="aspect-video">
  {/* Content maintains 16:9 ratio */}
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `framer-motion` package | `motion` package, import from `motion/react` | Late 2024 | Same API, new package name. No breaking changes in v12. |
| `@tailwindcss/aspect-ratio` plugin | Native `aspect-video` / `aspect-[16/9]` utility | Tailwind v3.0+ | No plugin needed. CSS `aspect-ratio` property is used directly. |
| Manual embla setup | shadcn Carousel component wrapping embla | shadcn added Carousel component | Accessible prev/next buttons, keyboard nav, consistent styling out of the box. |
| Tailwind v3 `tailwind.config.js` | Tailwind v4 CSS-first `@theme` block | Jan 2025 | Theme tokens defined in `globals.css`, no JS config file. Project already on v4. |

**Deprecated/outdated:**
- `framer-motion` package name: Use `motion` instead. Same API, import from `motion/react`.
- `@tailwindcss/aspect-ratio` plugin: Unnecessary with Tailwind v4, use native `aspect-video` class.

## Open Questions

1. **CarouselPrevious/CarouselNext arrow positioning for content rails**
   - What we know: shadcn positions these as absolute elements outside the carousel viewport by default. For Netflix-style rails, arrows should overlay the carousel edges.
   - What's unclear: The exact CSS overrides needed to position shadcn carousel arrows at rail edges with the glass-circle style described in UI-SPEC.
   - Recommendation: Override the default shadcn arrow positioning with custom classes. The UI-SPEC defines: 40px circle, bg-surface-3 at 80% opacity, backdrop-blur-sm. Apply these as className overrides on CarouselPrevious/CarouselNext, and adjust absolute positioning to overlay the rail edges. Show arrows only on hover over the rail area (group-hover pattern). Hide arrows on mobile (touch-only navigation).

2. **Hero ambient glow implementation**
   - What we know: Per D-03, the show's brand color radiates as a soft glow. UI-SPEC says radial gradient at 20-30% opacity.
   - What's unclear: Exact CSS technique for the ambient glow effect (radial-gradient on a pseudo-element? Separate div? Box-shadow?).
   - Recommendation: Use an absolutely-positioned div behind the hero artwork with a large radial-gradient from the show's brand color at 25% opacity to transparent. The gradient should be centered and extend well beyond the artwork area for a natural glow. Use inline style for the gradient since the color is data-driven.

3. **Show logo on cards**
   - What we know: D-11 specifies show logo SVG in bottom-left of artwork. But mock data has no real logo SVGs.
   - What's unclear: Whether to create placeholder logo treatments or skip the logo for Phase 3.
   - Recommendation: For Phase 3 with mock data, render the show title as bold white text (styled like a logo) in the bottom-left of the artwork area. This placeholder treatment can be swapped for real SVG logos when admin uploads them in Phase 7.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test --project=chromium` |
| Full suite command | `npx playwright test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CATL-01 | Hero banner visible on home page | e2e | `npx playwright test tests/e2e/home.spec.ts -g "hero banner" --project=chromium` | No -- Wave 0 |
| CATL-02 | Content rails visible on home page | e2e | `npx playwright test tests/e2e/home.spec.ts -g "content rail" --project=chromium` | No -- Wave 0 |
| CATL-08 | Series page shows card grid | e2e | `npx playwright test tests/e2e/series.spec.ts --project=chromium` | No -- Wave 0 |
| CATL-09 | Show cards display branded artwork and logo | e2e | `npx playwright test tests/e2e/home.spec.ts -g "show card" --project=chromium` | No -- Wave 0 |
| CATL-10 | Rails look intentional with few shows (placeholders) | e2e | `npx playwright test tests/e2e/home.spec.ts -g "placeholder" --project=chromium` | No -- Wave 0 |
| DESG-02 | Hero banner is full viewport height | e2e | `npx playwright test tests/e2e/home.spec.ts -g "hero.*viewport" --project=chromium` | No -- Wave 0 |
| DESG-03 | Cards have hover state (scale, overlay) | e2e | `npx playwright test tests/e2e/home.spec.ts -g "hover" --project=chromium` | No -- Wave 0 |
| DESG-04 | White typography on dark backgrounds | e2e | `npx playwright test tests/e2e/home.spec.ts -g "typography" --project=chromium` | No -- Wave 0 |
| DESG-05 | Brand color accents on cards and badges | e2e | `npx playwright test tests/e2e/home.spec.ts -g "brand color" --project=chromium` | No -- Wave 0 |
| DESG-07 | Motion transitions present | e2e (manual-verify) | Manual visual inspection -- motion timing is hard to assert in e2e | Manual only |
| DESG-08 | Per-show color ribbon on cards | e2e | `npx playwright test tests/e2e/home.spec.ts -g "ribbon" --project=chromium` | No -- Wave 0 |
| DESG-09 | Metadata chips on cards | e2e | `npx playwright test tests/e2e/home.spec.ts -g "badge\|chip" --project=chromium` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test --project=chromium` (full suite, ~15s target)
- **Per wave merge:** `npx playwright test` (same, single project configured)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/e2e/home.spec.ts` -- covers CATL-01, CATL-02, CATL-09, CATL-10, DESG-02, DESG-03, DESG-04, DESG-05, DESG-08, DESG-09
- [ ] `tests/e2e/series.spec.ts` -- covers CATL-08
- [ ] No framework install needed -- Playwright already configured
- [ ] No shared fixtures needed -- each test file is self-contained with page.goto()

## Project Constraints (from CLAUDE.md)

- **Stack:** Next.js 16.2.x (App Router) + Tailwind CSS v4 + shadcn/ui (New York style)
- **Animation:** Use `motion` package (^12.x), import from `motion/react`, NOT `framer-motion`
- **Carousel:** Use `embla-carousel-react` (^8.6.x)
- **Icons:** lucide-react only
- **Tailwind config:** CSS-first via `@theme` block in `globals.css`, no `tailwind.config.js`
- **Theme:** Dark mode always (`class="dark"` on `<html>`)
- **Design tokens:** Use tokens from `src/styles/globals.css`, never hardcode hex values
- **shadcn preset:** New York style, neutral base, CSS variables enabled
- **Video:** No video players in Phase 3 (video embeds are Phase 5)
- **No Prisma, no NextAuth, no Redux** -- per CLAUDE.md "What NOT to Use"

## Sources

### Primary (HIGH confidence)
- [motion/react component API](https://motion.dev/docs/react-motion-component) - motion.div, whileHover, animate, transition props
- [motion AnimatePresence](https://motion.dev/docs/react-animate-presence) - mode options (sync/wait/popLayout), crossfade pattern, exit animations
- [motion installation for Next.js](https://motion.dev/docs/react-installation) - motion/react vs motion/react-client imports
- [motion useReducedMotion](https://motion.dev/docs/react-use-reduced-motion) - Accessibility hook for prefers-reduced-motion
- [motion accessibility guide](https://motion.dev/docs/react-accessibility) - MotionConfig reducedMotion="user" for automatic handling
- [motion upgrade guide](https://motion.dev/docs/react-upgrade-guide) - No breaking changes in v12, import path change only
- [embla-carousel-react docs](https://www.embla-carousel.com/docs/get-started/react) - useEmblaCarousel hook, HTML structure, CSS, options
- [shadcn Carousel](https://ui.shadcn.com/docs/components/radix/carousel) - CarouselContent, CarouselItem, opts prop, plugins, API access
- [shadcn Card](https://ui.shadcn.com/docs/components/radix/card) - Card, CardHeader, CardTitle, CardContent sub-components
- [Tailwind CSS aspect-ratio](https://tailwindcss.com/docs/aspect-ratio) - aspect-video, aspect-[16/9] utilities

### Secondary (MEDIUM confidence)
- [npm registry: motion 12.38.0](https://www.npmjs.com/package/motion) - Version verification
- [npm registry: embla-carousel-react 8.6.0](https://www.npmjs.com/package/embla-carousel-react) - Version verification

### Tertiary (LOW confidence)
- None -- all findings verified with primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified against npm registry and official docs. Versions confirmed current.
- Architecture: HIGH - Component structure follows established Next.js App Router patterns. Client/server boundary well-understood from Phase 2.
- Pitfalls: HIGH - All pitfalls verified against official documentation (Tailwind dynamic classes, AnimatePresence modes, reduced motion).
- Mock data: HIGH - Shape defined in approved UI-SPEC, matches future Supabase schema design.

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable libraries, low churn)
