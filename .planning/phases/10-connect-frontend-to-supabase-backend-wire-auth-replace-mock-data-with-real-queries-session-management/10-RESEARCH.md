# Phase 10: Empty State Polish - Research

**Researched:** 2026-04-14
**Domain:** Conditional UI rendering, catalog-aware server components, Next.js redirect patterns
**Confidence:** HIGH

## Summary

Phase 10 is a small, well-scoped polish phase with four discrete deliverables: (1) a redirect on `/browse` when the catalog is empty, (2) a text-only empty state on series detail pages with no seasons/episodes, (3) a catalog-aware `CtaBanner` with three copy tiers, and (4) a shared `getCatalogStage()` query helper in `src/lib/queries.ts`. No new dependencies are required. No schema changes. No new components to create -- only modifications to three existing pages and one shared module.

The codebase already has all the patterns needed: `redirect()` from `next/navigation` is used in four other files, `unstable_cache` + `createPublicClient()` is the established pattern for cacheable public queries, and the typographic system (small caps labels, display headings, `text-white/50` body) is well-established in the `SeriesDetailHero`. The Codex plan at `~/.claude/plans/federated-wiggling-ocean.md` provides a full copy table but proposes more stages (6) than the CONTEXT.md decisions require (3). Follow CONTEXT.md's simpler `zero | growing | full` model.

**Primary recommendation:** Implement all four changes in a single plan with two tasks: (1) add `getCatalogStage()` to queries.ts + wire browse redirect, (2) add series empty state + make CtaBanner catalog-aware. Total scope is ~80 lines of new code across 4 files.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** When `/browse` has zero shows AND zero coming-soon content, `redirect('/')`. No new component needed. Check: `if (streaming.length === 0 && comingSoon.length === 0) redirect('/')` at the top of `BrowsePage`.
- **D-02:** When a show exists but has no seasons or no published episodes, render a text-only empty state below the hero. **No glass card, no bordered container.** Same visual rhythm as the hero: small caps label, display headline, soft body copy (white/50). Condition: `viewSeasons.length === 0` in `series/[slug]/page.tsx`, render before `SeriesDetailContent`.
- **D-03:** `CtaBanner` becomes catalog-aware. Three tiers: `zero` (0 shows, "Be there when CIT premieres"), `growing` (1-5 shows, "The catalog has begun"), `full` (6+ shows, current copy). `getCatalogStage()` added to `src/lib/queries.ts`.
- **D-04:** `getCatalogStage()` returns `{ stage: 'zero' | 'growing' | 'full', showCount: number }`. Uses `createPublicClient()` so it can be wrapped in `unstable_cache`.

### Claude's Discretion
- Exact copy strings for each CTA stage (headline, body, button label) -- follow the Codex plan table unless something feels off tonally
- Whether `CtaBanner` fetches `getCatalogStage()` itself or receives a prop from the parent page
- Where exactly the series empty state sits in the layout (margin/padding relative to `SeriesDetailHero`)

### Deferred Ideas (OUT OF SCOPE)
- `CatalogLaunchHero` full-bleed pre-launch hero component -- superseded by marketing landing page at `/`
- Search catalog-awareness -- search already has solid empty states
- ROADMAP Phase 10 description update -- update when completing the phase via `/gsd:complete-milestone`
- Hardcoded "15 original programs" copy cleanup -- low priority
</user_constraints>

## Standard Stack

No new dependencies. This phase uses only existing project libraries:

### Core (already installed)
| Library | Purpose in this phase |
|---------|----------------------|
| `next/navigation` (`redirect`) | Browse page empty redirect to `/` |
| `next/cache` (`unstable_cache`) | Cache wrapper for `getCatalogStage()` |
| `next/link` (`Link`) | "See what's coming" CTA in series empty state |
| `@supabase/supabase-js` (via `createPublicClient()`) | Count query for catalog stage |

**Installation:** None required.

## Architecture Patterns

### Pattern 1: Browse Page Redirect (D-01)

**What:** Server-side redirect when catalog is empty. `redirect()` throws internally (never returns), so it must be called before any JSX rendering.

**When to use:** After the parallel data fetch, before any component rendering.

**Example:**
```typescript
// Source: Existing pattern in src/app/(viewer)/profile/page.tsx, src/app/admin/layout.tsx
import { redirect } from 'next/navigation'

export default async function BrowsePage() {
  const [featured, streaming, comingSoon, newEpisodes] = await Promise.all([...])

  // D-01: empty catalog redirects to marketing landing page
  if (streaming.length === 0 && comingSoon.length === 0) {
    redirect('/')
  }

  // ... rest of page
}
```

**Key detail:** The check uses `streaming` and `comingSoon` (already fetched), not a separate query. Zero additional DB cost.

### Pattern 2: Text-Only Empty State (D-02)

**What:** Inline typographic empty state matching SeriesDetailHero's visual rhythm. No wrapper component, no glass card, no border.

**When to use:** When `viewSeasons.length === 0` on the series detail page.

**Typography tokens from existing SeriesDetailHero:**
- Small caps label: `text-[11px] font-medium uppercase tracking-[0.28em] text-white/38` (used on search, watch page, hero per CONTEXT.md)
- Display headline: `font-display text-3xl font-semibold text-white`
- Body copy: `text-white/50`
- CTA link: standard text link to `/coming-soon`

**Layout position:** Render inside the same `mt-8 px-6 md:px-12` / `mx-auto max-w-7xl` wrapper that currently holds `SeriesDetailContent`. Replace the content area, not add above or below it.

### Pattern 3: Catalog-Aware CtaBanner (D-03)

**What:** `CtaBanner` becomes an async server component that fetches `getCatalogStage()` internally and renders stage-appropriate copy.

**Recommendation (Claude's discretion):** Fetch internally in `CtaBanner` itself. Rationale:
1. `CtaBanner` is already a server component (no `'use client'` directive)
2. It's used in 3 pages (`/`, `/browse`, `/series/[slug]`) -- prop-drilling `stage` to all three adds coupling
3. `getCatalogStage()` is wrapped in `unstable_cache` with a long TTL, so the DB cost is near-zero
4. Keeps each page file unchanged (no new imports or props)

**Copy table (3 tiers per D-03, refined from Codex plan):**

| Stage | Condition | Label | Headline | Body | Primary CTA | Secondary CTA |
|-------|-----------|-------|----------|------|-------------|---------------|
| `zero` | 0 shows | "Coming soon" | "Be there when CIT premieres" | "Original series are arriving soon. Create your account now and be first to watch." | "Create Free Account" -> `/auth` | "See what's coming" -> `/coming-soon` |
| `growing` | 1-5 shows | "Now streaming" | "The catalog has begun" | "Watch the first stories on CIT and save your favorites for later." | "Start Watching" -> `/browse` | "See what's coming" -> `/coming-soon` |
| `full` | 6+ shows | "Clickit membership" | "Stream original programming with a calmer, premium viewing experience." | (current body copy) | "Start Watching Free" -> `/auth` | "Explore what's next" -> `/coming-soon` |

### Pattern 4: getCatalogStage() Query (D-04)

**What:** A cached query that counts non-archived shows and returns a stage enum.

**Implementation pattern (matching existing queries.ts conventions):**
```typescript
export type CatalogStage = 'zero' | 'growing' | 'full'

export const getCatalogStage = unstable_cache(
  async (): Promise<{ stage: CatalogStage; showCount: number }> => {
    const supabase = createPublicClient()
    const { count } = await supabase
      .from('shows')
      .select('*', { count: 'exact', head: true })
      .eq('archived', false)
      .in('status', ['now-streaming', 'coming-soon'])

    const showCount = count ?? 0
    const stage: CatalogStage =
      showCount === 0 ? 'zero' :
      showCount <= 5 ? 'growing' :
      'full'

    return { stage, showCount }
  },
  ['catalog-stage'],
  { revalidate: 3600, tags: ['shows'] }
)
```

**Key details:**
- Uses `{ count: 'exact', head: true }` -- returns only the count, no row data. Cheapest possible Supabase query.
- Uses `createPublicClient()` (not `createClient()`) per project convention for `unstable_cache` closures.
- Revalidates every 1 hour with `shows` tag -- same as `getStreamingShows` and `getComingSoonShows`.
- Cache key `['catalog-stage']` is unique and descriptive.

### Anti-Patterns to Avoid
- **Glass card / bordered container for series empty state:** Explicitly forbidden by D-02 and the project's "no decorative boxes" rule. Use text contrast and spacing only.
- **Separate `dynamic-cta-banner.tsx` file:** The Codex plan proposed a new file. CONTEXT.md says to modify existing `cta-banner.tsx` in place. Follow CONTEXT.md.
- **6-stage catalog model:** The Codex plan proposed `zero | show_only | season_only | episodic | growing | full`. CONTEXT.md simplifies to 3 stages: `zero | growing | full`. Follow CONTEXT.md.
- **Modifying `src/app/(viewer)/page.tsx` (root landing page):** CONTEXT.md explicitly says "Do NOT add empty states to this file." The landing page is static/marketing and already handles stage 0 by design.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Server redirect | Client-side redirect or custom 302 | `redirect('/')` from `next/navigation` | Built-in, throws internally, works in RSC |
| Show count | Full `SELECT *` then `.length` | `select('*', { count: 'exact', head: true })` | Returns only count header, no row data transferred |
| Cache invalidation | Manual cache clearing | `unstable_cache` with `tags: ['shows']` + existing `updateTag('shows')` in admin actions | Already wired -- admin mutations call `updateTag('shows')` |

## Common Pitfalls

### Pitfall 1: redirect() After JSX
**What goes wrong:** `redirect()` called inside JSX or after a `return` statement has no effect or throws a confusing error.
**Why it happens:** `redirect()` works by throwing a special error that Next.js intercepts. It must be called in the main function body, not inside JSX expressions.
**How to avoid:** Call `redirect('/')` immediately after the data fetch, before the `return (` statement.
**Warning signs:** Page renders empty instead of redirecting; "NEXT_REDIRECT" error in console.

### Pitfall 2: createClient() Inside unstable_cache
**What goes wrong:** `getCatalogStage()` fails with "cookies was called outside a request scope" error.
**Why it happens:** `createClient()` from `server.ts` calls `cookies()` from `next/headers`, which is forbidden inside `unstable_cache` closures.
**How to avoid:** Always use `createPublicClient()` from `src/lib/supabase/public.ts` inside cached functions.
**Warning signs:** Runtime error mentioning cookies or headers.

### Pitfall 3: CtaBanner Becomes Client Component
**What goes wrong:** Adding `async` to a client component, or importing hooks into `CtaBanner`.
**Why it happens:** Forgetting that `CtaBanner` is currently a server-compatible component (no `'use client'` directive). It wraps `ScrollReveal` (client) but is itself not marked as client.
**How to avoid:** Keep `CtaBanner` as an async server component. `ScrollReveal` is a client child -- this is fine for RSC composition.
**Warning signs:** "async client components are not supported" build error.

### Pitfall 4: Series Empty State Shows When Seasons Exist But Have No Published Episodes
**What goes wrong:** D-02 condition is `viewSeasons.length === 0`, but the Codex plan also suggests handling "seasons exist but no published episodes."
**Why it happens:** The two sources (CONTEXT.md vs Codex plan) define slightly different conditions.
**How to avoid:** Follow CONTEXT.md's condition exactly: `viewSeasons.length === 0`. If seasons exist but have no published episodes, the `SeriesDetailContent` component already handles that gracefully (empty episode list with the season selector visible).
**Warning signs:** Empty state appearing when it shouldn't.

## Code Examples

### getCatalogStage() -- Full Implementation
```typescript
// Source: Matches existing patterns in src/lib/queries.ts
export type CatalogStage = 'zero' | 'growing' | 'full'

export const getCatalogStage = unstable_cache(
  async (): Promise<{ stage: CatalogStage; showCount: number }> => {
    const supabase = createPublicClient()
    const { count } = await supabase
      .from('shows')
      .select('*', { count: 'exact', head: true })
      .eq('archived', false)
      .in('status', ['now-streaming', 'coming-soon'])

    const showCount = count ?? 0
    const stage: CatalogStage =
      showCount === 0 ? 'zero' :
      showCount <= 5 ? 'growing' :
      'full'

    return { stage, showCount }
  },
  ['catalog-stage'],
  { revalidate: 3600, tags: ['shows'] }
)
```

### Browse Page Redirect Guard
```typescript
// Source: Pattern from src/app/(viewer)/profile/page.tsx
import { redirect } from 'next/navigation'

// Inside BrowsePage, after Promise.all fetch:
if (streaming.length === 0 && comingSoon.length === 0) {
  redirect('/')
}
```

### Series Detail Empty State (text-only, no container)
```typescript
// Source: Typography tokens from SeriesDetailHero + CONTEXT.md D-02
// Placed inside the existing mt-8 px-6 md:px-12 wrapper, replacing SeriesDetailContent
{viewSeasons.length === 0 ? (
  <div className="py-16">
    <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-white/38">
      Seasons
    </p>
    <h2 className="font-display mt-3 text-3xl font-semibold text-white">
      Episodes are being prepared.
    </h2>
    <p className="mt-2 text-white/50">Check back soon.</p>
    <Link
      href="/coming-soon"
      className="mt-4 inline-flex items-center text-sm text-white/60 transition-colors hover:text-white"
    >
      See what&apos;s coming &rarr;
    </Link>
  </div>
) : (
  <SeriesDetailContent ... />
)}
```

### CtaBanner Catalog-Aware (async server component)
```typescript
// Source: Existing cta-banner.tsx structure + CONTEXT.md D-03
import { getCatalogStage } from '@/lib/queries'

const CTA_COPY = {
  zero: {
    label: 'Coming soon',
    headline: 'Be there when CIT premieres',
    body: 'Original series are arriving soon. Create your account now and be first to watch.',
    primaryLabel: 'Create Free Account',
    primaryHref: '/auth',
    secondaryLabel: "See what's coming",
    secondaryHref: '/coming-soon',
  },
  growing: {
    label: 'Now streaming',
    headline: 'The catalog has begun',
    body: 'Watch the first stories on CIT and save your favorites for later.',
    primaryLabel: 'Start Watching',
    primaryHref: '/browse',
    secondaryLabel: "See what's coming",
    secondaryHref: '/coming-soon',
  },
  full: {
    label: 'Clickit membership',
    headline: 'Stream original programming with a calmer, premium viewing experience.',
    body: 'Discover travel, health, music, comedy, cooking, and more from Abu Dhabi in a product shell built to let the stories lead.',
    primaryLabel: 'Start Watching Free',
    primaryHref: '/auth',
    secondaryLabel: "Explore what's next",
    secondaryHref: '/coming-soon',
  },
} as const

export async function CtaBanner() {
  const { stage } = await getCatalogStage()
  const copy = CTA_COPY[stage]
  // ... render with copy.headline, copy.body, etc.
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | TypeScript compiler (tsc) |
| Config file | `tsconfig.json` |
| Quick run command | `npx tsc --noEmit` |
| Full suite command | `npx tsc --noEmit` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | Browse redirects when empty catalog | manual | Deploy to Vercel, delete all shows, visit /browse | N/A |
| D-02 | Series page shows text empty state | manual | Deploy to Vercel, create show with no seasons, visit /series/[slug] | N/A |
| D-03 | CtaBanner shows stage-appropriate copy | manual | Deploy to Vercel, check CTA at 0/3/6+ shows | N/A |
| D-04 | getCatalogStage returns correct stage | unit-like | `npx tsc --noEmit` (type-checks return type) | N/A |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npx tsc --noEmit` + Vercel deploy
- **Phase gate:** Vercel production deploy + manual verification at each stage

### Wave 0 Gaps
None -- no test framework beyond tsc is used in this project. All verification is manual via Vercel deploy (per project memory: "Always deploy to Vercel for checkpoints/verification, never localhost").

## Open Questions

1. **Series empty state: should it also handle "seasons exist but zero published episodes"?**
   - What we know: CONTEXT.md D-02 says condition is `viewSeasons.length === 0`. The Codex plan also covers "seasons but no episodes."
   - What's unclear: Whether `SeriesDetailContent` with seasons but zero episodes looks acceptable.
   - Recommendation: Follow CONTEXT.md strictly (`viewSeasons.length === 0`). The existing `SeriesDetailContent` renders an empty episode list under the season selector, which is acceptable -- it signals "episodes coming for this season" without looking broken.

2. **CtaBanner on landing page (`/`): should it also be catalog-aware?**
   - What we know: `CtaBanner` is used on `/`, `/browse`, and `/series/[slug]`. Making it async and catalog-aware affects all three.
   - What's unclear: Whether catalog-aware copy on the marketing landing page is desirable (it's static/aspirational by design).
   - Recommendation: Yes, make it catalog-aware everywhere. The `full` stage copy matches current copy exactly, so for the mature catalog nothing changes. At `zero` stage, "Be there when CIT premieres" is better than the current aspirational copy on a page with no content to browse.

## Sources

### Primary (HIGH confidence)
- `src/lib/queries.ts` -- 14 existing `unstable_cache` queries establishing the pattern
- `src/lib/supabase/public.ts` -- `createPublicClient()` pattern for cache-safe queries
- `src/app/(viewer)/browse/page.tsx` -- current browse page structure
- `src/app/(viewer)/series/[slug]/page.tsx` -- current series detail page structure
- `src/components/home/cta-banner.tsx` -- current CtaBanner implementation
- `src/components/series/series-detail-hero.tsx` -- typography tokens for empty state
- `10-CONTEXT.md` -- locked decisions from discuss phase

### Secondary (MEDIUM confidence)
- `~/.claude/plans/federated-wiggling-ocean.md` -- Codex analysis, copy table reference (superseded by CONTEXT.md where they conflict)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all patterns exist in codebase
- Architecture: HIGH -- all four changes are straightforward modifications to existing files using established patterns
- Pitfalls: HIGH -- pitfalls are well-known from 9 prior phases of development on this codebase

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable -- no external dependencies or version-sensitive patterns)
