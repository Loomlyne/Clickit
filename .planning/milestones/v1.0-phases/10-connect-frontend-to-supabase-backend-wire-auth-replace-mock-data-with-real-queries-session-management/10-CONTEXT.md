# Phase 10: Empty State Polish — Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Intentional empty/loading states across browse, series detail, and CTA banner — so the platform feels premium rather than broken when the catalog is empty or a show has no episodes yet. Three targeted changes + one shared query helper.

**NOT in scope:** Auth, mock data replacement (done in Phase 8), search empty states (already implemented), CatalogLaunchHero full component (replaced by simpler redirect).

</domain>

<decisions>
## Implementation Decisions

### Browse Page — Zero Content State
- **D-01:** When `/browse` has zero shows AND zero coming-soon content, `redirect('/')`. The marketing landing page at `/` already handles the "CIT is coming" narrative. No new component needed. Check: `if (streaming.length === 0 && comingSoon.length === 0) redirect('/')` at the top of `BrowsePage`.

### Series Detail — No Seasons or Episodes
- **D-02:** When a show exists in the DB but has no seasons or no published episodes, render a text-only empty state below the hero. **No glass card, no bordered container.** Same visual rhythm as the hero itself: small caps label, display headline, soft body copy (white/50). Something like:
  ```
  SEASONS                              ← text-[11px] uppercase tracking-[0.28em] text-white/38
  Episodes are being prepared.         ← font-display text-3xl font-semibold text-white
  Check back soon.                     ← text-white/50
  [See what's coming →]                ← Link to /coming-soon
  ```
  Condition: `viewSeasons.length === 0` in `series/[slug]/page.tsx`, render before `SeriesDetailContent`.

### CTA Banner — Catalog-Aware Copy
- **D-03:** `CtaBanner` becomes catalog-aware. Add `getCatalogStage()` to `src/lib/queries.ts`. Three tiers:

  | Stage | Condition | Headline |
  |-------|-----------|----------|
  | `zero` | 0 shows total | "Be there when CIT premieres" |
  | `growing` | 1–5 shows | "The catalog has begun" |
  | `full` | 6+ shows | "Your next obsession starts here" (or current copy) |

  `CtaBanner` receives `stage` prop (or fetches internally as a server component). Body copy and CTA label also adapt per stage (see Codex plan at `~/.claude/plans/federated-wiggling-ocean.md` for full copy table).

### Shared Query Helper
- **D-04:** `getCatalogStage()` is a new export in `src/lib/queries.ts`. Returns `{ stage: 'zero' | 'growing' | 'full', showCount: number }`. Uses `createPublicClient()` (not `createClient()`) so it can be wrapped in `unstable_cache` without cookie conflicts.

### Claude's Discretion
- Exact copy strings for each CTA stage (headline, body, button label) — follow the Codex plan table unless something feels off tonally
- Whether `CtaBanner` fetches `getCatalogStage()` itself or receives a prop from the parent page
- Where exactly the series empty state sits in the layout (margin/padding relative to `SeriesDetailHero`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pages to Modify
- `src/app/(viewer)/browse/page.tsx` — add redirect, adjust empty guards
- `src/app/(viewer)/series/[slug]/page.tsx` — add series empty state
- `src/components/home/cta-banner.tsx` — make catalog-aware

### Shared Logic
- `src/lib/queries.ts` — add `getCatalogStage()`
- `src/lib/supabase/public.ts` — use `createPublicClient()` inside cache closures (not `createClient()`)

### Reference: Prior Codex Analysis
- `~/.claude/plans/federated-wiggling-ocean.md` — full copy table for CTA stages, original plan (note: targets wrong page for browse — now `/browse` not `/`)

### Architecture Context
- `src/app/(viewer)/page.tsx` — the root `/` is the marketing landing page (static, no DB queries). Stage 0 for the whole site is already handled here. Do NOT add empty states to this file.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ScrollReveal` (`src/components/primitives/scroll-reveal.tsx`) — wraps any scroll-triggered section; use for the series empty state if desired
- `redirect` from `next/navigation` — for D-01 browse redirect
- `Link` from `next/link` — for CTAs in the series empty state

### Established Patterns
- **No decorative boxes:** This codebase consistently uses text contrast + spacing for hierarchy rather than bordered/shadowed containers. The series empty state must follow this — plain text, no card wrapper.
- **Small caps labels:** `text-[11px] font-medium uppercase tracking-[0.28em] text-white/38` — used on search, watch page, hero. Use this for the "SEASONS" label.
- **`unstable_cache` + `createPublicClient()`:** Public/cached queries must use `createPublicClient()` from `src/lib/supabase/public.ts`, not `createClient()` which reads cookies. See `feedback_unstable_cache_pattern.md` in memory.
- **Server components:** `CtaBanner` is currently a server component — keep it that way if fetching `getCatalogStage()` internally.

### Integration Points
- `BrowsePage` in `browse/page.tsx` already fetches `streaming` and `comingSoon` — the redirect check can use these existing values (no extra query)
- `SeriesDetailPage` in `series/[slug]/page.tsx` already has `viewSeasons` computed — empty check on `viewSeasons.length`
- `CtaBanner` is imported in both `browse/page.tsx` and `series/[slug]/page.tsx` — stage-aware copy will apply on both pages automatically

</code_context>

<specifics>
## Specific Ideas

- Series empty state: user explicitly said "same as the hero of all ones" — match the typographic and spacing style of `SeriesDetailHero`, not a different component
- Browse redirect: simple `redirect('/')` from `next/navigation`, no component needed
- The Codex plan's copy table is the reference for CTA copy, but tone should stay within CIT's premium-but-accessible voice

</specifics>

<deferred>
## Deferred Ideas

- `CatalogLaunchHero` full-bleed pre-launch hero component — superseded by marketing landing page at `/`
- Search catalog-awareness — search already has solid empty states (no query, short query, no results); not worth changing
- ROADMAP Phase 10 description update ("Connect frontend to Supabase backend") — update when completing the phase via `/gsd:complete-milestone`
- Hardcoded "15 original programs" copy cleanup — low priority, handled by dynamic copy in D-03

</deferred>

---

*Phase: 10-connect-frontend-to-supabase-backend-wire-auth-replace-mock-data-with-real-queries-session-management*
*Context gathered: 2026-04-14*
