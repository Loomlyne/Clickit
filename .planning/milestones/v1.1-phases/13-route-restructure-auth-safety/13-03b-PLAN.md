---
phase: 13-route-restructure-auth-safety
plan: 03b
type: execute
wave: 3
depends_on:
  - 13-01
files_modified:
  - src/components/shows/show-card.tsx
  - src/components/shows/episode-card.tsx
  - src/components/shows/reel-card.tsx
  - src/components/shows/episode-art-card.tsx
  - src/components/shows/portrait-show-card.tsx
  - src/components/layout/navbar.tsx
  - src/components/layout/footer.tsx
  - src/components/layout/auth-section.tsx
  - src/components/layout/nav-links.tsx
  - src/components/layout/mobile-nav.tsx
  - src/components/home/genres-grid.tsx
  - src/components/home/hero-slide.tsx
  - src/components/home/continue-watching-card.tsx
  - src/components/home/cta-banner.tsx
  - src/components/landing/landing-faq.tsx
  - src/components/landing/landing-hero.tsx
  - src/components/landing/landing-hero-animations.tsx
  - src/components/landing/genre-pills.tsx
  - src/components/landing/shows-portfolio.tsx
  - src/components/series/episode-row.tsx
  - src/components/series/series-detail-hero.tsx
  - src/components/watch/watch-page-content.tsx
  - src/components/watch/episode-nav.tsx
  - src/components/profile/profile-header.tsx
  - src/components/profile/profile-history-row.tsx
  - src/components/admin/admin-header.tsx
  - src/components/admin/shows-table.tsx
  - src/components/primitives/section-header.tsx
  - src/app/not-found.tsx
  - src/app/[locale]/(viewer)/coming-soon/page.tsx
  - src/app/[locale]/(viewer)/series/[slug]/page.tsx
  - src/app/[locale]/(viewer)/series/[slug]/not-found.tsx
  - src/app/[locale]/(viewer)/search/page.tsx
  - src/app/[locale]/(viewer)/my-list/page.tsx
  - src/app/[locale]/(viewer)/profile/page.tsx
  - src/app/[locale]/(viewer)/watch/[episodeId]/not-found.tsx
  - src/app/[locale]/admin/shows/[id]/page.tsx
autonomous: true
requirements:
  - RTE-04
tags: [i18n, navigation, next-link, v1.1]
user_setup: []

must_haves:
  truths:
    - "Every <Link> click in the app prepends the active locale to its href at navigation time"
    - "grep for `from 'next/link'` in src/components and src/app returns ZERO matches after this plan runs"
    - "A click on a show card from /ar/browse navigates to /ar/series/<slug> — NEVER to bare /series/<slug>"
    - "A click on a navbar link from /ar/ navigates to the /ar/-prefixed target"
  artifacts:
    - path: "src/components/shows/show-card.tsx"
      provides: "Locale-preserving show-card click navigation"
    - path: "src/components/layout/navbar.tsx"
      provides: "Locale-preserving navbar links"
    - path: "src/components/layout/footer.tsx"
      provides: "Locale-preserving footer links"
  key_links:
    - from: "every file in files_modified"
      to: "src/i18n/navigation"
      via: "import { Link } from '@/i18n/navigation'"
      pattern: "from ['\\\"]@/i18n/navigation['\\\"]"
---

<objective>
Swap every `Link` import from `next/link` to `@/i18n/navigation` across every component and page that renders client-clickable navigation. Covers ~38 files enumerated in the file list (show cards, episode cards, navbar, footer, landing page, watch chrome, profile rows, admin tables, not-found pages).

This plan (13-03b) is a sibling of 13-03a and runs in parallel in Wave 3. Together they close the complete navigation-primitive swap mandated by CONTEXT.md: 13-03a handles hooks + Server-redirect; 13-03b handles client `<Link>`.

Purpose: Closes the `Link`-side of pitfall 2 (RTE-04). Without these swaps, every show-card click, every navbar/footer link, every episode-card click navigates to a bare path (e.g., `/series/foo` instead of `/ar/series/foo`), stripping the locale and triggering the proxy's re-redirect dance. Users on `/ar/` would bounce to `/en/` on every click — a visible regression.

Output: ~38 files with their `Link` import swapped to `@/i18n/navigation`; build clean; grep gate reports zero `from 'next/link'` residue in client/page code.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/13-route-restructure-auth-safety/13-CONTEXT.md
@.planning/phases/13-route-restructure-auth-safety/13-01-PLAN.md

@src/i18n/navigation.ts

<interfaces>
<!-- next-intl's Link is a drop-in API-compatible replacement for next/link -->

From src/i18n/navigation.ts:
```typescript
export const { Link, useRouter, redirect, usePathname, getPathname, permanentRedirect } =
  createNavigation(routing)
// Link<Href>: identical surface to next/link's default export
//   — `href` prop (string | Href object) still works
//   — `prefetch`, `replace`, `scroll`, `className`, children — all pass through
//   — href is automatically prefixed with the active locale on render
// To navigate to a specific locale explicitly (e.g., a language switcher):
//   <Link href="/profile" locale="ar"> — generates /ar/profile regardless of active locale
```

Call-site compatibility: all existing `<Link href="/browse">…` usages compile and behave correctly with the new import. No prop renames, no API changes.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Freeze the next/link target list via fresh grep</name>
  <files>none (enumeration task — no code edits)</files>

  <read_first>
    - .planning/phases/13-route-restructure-auth-safety/13-CONTEXT.md line 80 (Pitfall 2 mandates the `Link` swap alongside the hook swaps)
  </read_first>

  <action>
Before swapping, print and freeze the authoritative file list from the current codebase state (Plan 13-01 already ran in Wave 1, so viewer/admin paths now live under `src/app/[locale]/...`).

```bash
grep -rnl "from ['\"]next/link['\"]" src --include="*.tsx" --include="*.ts" | sort
```

Save the output to `/tmp/phase-13-03b-link-files.txt`:

```bash
grep -rnl "from ['\"]next/link['\"]" src --include="*.tsx" --include="*.ts" | sort > /tmp/phase-13-03b-link-files.txt
wc -l /tmp/phase-13-03b-link-files.txt
cat /tmp/phase-13-03b-link-files.txt
```

Expected: ~38 files matching the `files_modified` list in this plan's frontmatter. Small drift is acceptable — the frontmatter list is authoritative for the plan's scope; use the grep result as the runtime truth.

Diff the grep result against the frontmatter list. Any mismatch means:
- **File in frontmatter but NOT in grep** → either (a) 13-01 moved it to a new path (update the swap list to the new path), or (b) something else already removed the import (skip it). Note which.
- **File in grep but NOT in frontmatter** → new `next/link` import introduced since planning; add it to the swap list in Task 2.

Confirm the final swap list before proceeding to Task 2.
  </action>

  <verify>
    <automated>test -s /tmp/phase-13-03b-link-files.txt &amp;&amp; echo "Frozen $(wc -l &lt; /tmp/phase-13-03b-link-files.txt) files"</automated>
  </verify>

  <acceptance_criteria>
    - `/tmp/phase-13-03b-link-files.txt` exists and is non-empty
    - The file count is within ±3 of 38 (≥35, ≤41) — large drift means something changed more than expected and must be investigated
    - Every listed path starts with `src/`
    - Final swap list documented inline in the Task 1 summary before Task 2 runs
  </acceptance_criteria>

  <done>
    - Authoritative `next/link` file list frozen for Task 2
  </done>
</task>

<task type="auto">
  <name>Task 2: Swap `Link` import in every frozen file from next/link to @/i18n/navigation</name>
  <files>
    (see /tmp/phase-13-03b-link-files.txt frozen in Task 1 — ~38 files enumerated in this plan's files_modified)
  </files>

  <read_first>
    - /tmp/phase-13-03b-link-files.txt (from Task 1)
    - Spot-read 3 representative files to confirm import shape: src/components/shows/show-card.tsx, src/components/layout/navbar.tsx, src/app/not-found.tsx
  </read_first>

  <action>
For every file in the frozen list, change the single `Link` import line. This is mechanical — next-intl's `Link` has the same prop surface as `next/link`'s default export, so no call-site changes are needed.

**Two import shapes to handle:**

1. Default import (most common):
   ```diff
   -import Link from 'next/link'
   +import { Link } from '@/i18n/navigation'
   ```
   Note the brace change: `next/link` exports `Link` as the default; `@/i18n/navigation` exports it as a named export.

2. Type-side imports (rare — some files also import the `LinkProps` type):
   ```diff
   -import Link, { type LinkProps } from 'next/link'
   +import { Link } from '@/i18n/navigation'
   +import type { ComponentProps } from 'react'
   // Replace any `LinkProps` usage with `ComponentProps<typeof Link>`.
   ```
   If no file uses `LinkProps`, skip this variant. Search with:
   ```bash
   grep -l "LinkProps" src --include="*.tsx" --include="*.ts" -r
   ```

**Preferred execution — scripted single sweep:**

```bash
# For each file in the frozen list, run a sed in-place swap. macOS BSD sed needs ''.
while IFS= read -r f; do
  # Default import form
  sed -i '' "s|^import Link from 'next/link'\$|import { Link } from '@/i18n/navigation'|" "$f"
  sed -i '' "s|^import Link from \"next/link\"\$|import { Link } from '@/i18n/navigation'|" "$f"
done < /tmp/phase-13-03b-link-files.txt
```

After the sweep, grep to catch any residue from non-default import shapes or multi-line imports:

```bash
grep -rn "from ['\"]next/link['\"]" src --include="*.tsx" --include="*.ts"
```

Expected: ZERO output. Any residual hit must be hand-fixed (likely a multi-line import, a type-only import, or a `import * as` form).

**Per-file acceptance check (run in a loop before declaring done):**

```bash
while IFS= read -r f; do
  if ! grep -q "from '@/i18n/navigation'" "$f"; then echo "MISS: $f"; fi
  if grep -q "from 'next/link'" "$f" || grep -q 'from "next/link"' "$f"; then echo "RESIDUE: $f"; fi
done < /tmp/phase-13-03b-link-files.txt
```

Expected: no MISS or RESIDUE output.

**Notes on specific files:**

- `src/components/layout/auth-section.tsx`, `src/components/layout/nav-links.tsx`, `src/components/layout/mobile-nav.tsx`, `src/components/profile/profile-header.tsx`, `src/components/watch/watch-page-content.tsx`, `src/components/admin/admin-header.tsx` — these ALSO get touched by sibling plan 13-03a (useRouter/usePathname swaps). Both plans are additive to the same file; order doesn't matter because they touch different import lines. If 13-03a ran first, the `next/navigation` import is already gone; only the `next/link` import remains for this plan to swap. If 13-03b runs first, vice versa.
- `src/app/not-found.tsx` — root 404 page. Locale-agnostic at the route level (no `[locale]` segment), but still renders `<Link>` elements that SHOULD carry the active locale if one can be inferred. `@/i18n/navigation.Link` falls back to `defaultLocale` when no locale is present in the URL — acceptable behavior on a 404. Swap the import.
- `src/app/[locale]/(viewer)/series/[slug]/not-found.tsx` and `src/app/[locale]/(viewer)/watch/[episodeId]/not-found.tsx` — per-segment 404 pages nested under `[locale]`. Active locale is always present here; swap the import.

**Do NOT swap:**
- `src/components/layout/locale-switcher.tsx` — deleted in plan 13-05 (if it still has a next/link import, leave it; the file gets `git rm`'d anyway). Check: `test -e src/components/layout/locale-switcher.tsx` — if false, skip entirely.
- `src/components/profile/language-preference.tsx` — rewritten in plan 13-05. Current content may or may not use `Link`; skip.
  </action>

  <verify>
    <automated>test -z "$(grep -rnE \"from ['\\\"]next/link['\\\"]\" src --include='*.tsx' --include='*.ts')" &amp;&amp; while IFS= read -r f; do grep -q "from '@/i18n/navigation'" "$f" || { echo "MISS: $f"; exit 1; }; done &lt; /tmp/phase-13-03b-link-files.txt</automated>
  </verify>

  <acceptance_criteria>
    - Every file in /tmp/phase-13-03b-link-files.txt imports `Link` from `@/i18n/navigation`
    - ZERO residual `from 'next/link'` imports across all of `src/`
    - No `LinkProps` type reference without a corresponding `ComponentProps<typeof Link>` replacement
    - Files that ALSO get touched by 13-03a have both imports correctly swapped (next/navigation → @/i18n/navigation AND next/link → @/i18n/navigation)
    - Files locked out of scope (locale-switcher.tsx, language-preference.tsx) are NOT touched
  </acceptance_criteria>

  <done>
    - ~38 `Link` swaps complete
    - Zero `next/link` imports remain in client/page code
  </done>
</task>

<task type="auto">
  <name>Task 3: Build gate — compilation + final grep invariants</name>
  <files>none (verification task)</files>

  <read_first>
    - None (pure verification)
  </read_first>

  <action>
Run the build gate. Plan 13-03b is mechanical — the only failure mode is a typo in an import path or a missed multi-line import shape.

```bash
npx tsc --noEmit
npm run build
```

Both MUST exit 0. The build log should show no "Module not found: Can't resolve 'next/link'" errors (expected — they all resolve now to `@/i18n/navigation`) and no "has no exported member 'Link'" errors.

Final grep invariant specific to this plan:

```bash
# No file in src imports from next/link anymore.
grep -rE "from ['\"]next/link['\"]" src --include="*.tsx" --include="*.ts"
```

Expected: EMPTY output. If any match remains, name it, swap it, re-run the gate.

Cross-plan sanity check — after BOTH 13-03a and 13-03b land, the combined gate from plan 13-06 Task 1 (static-analysis gate, step 3) will run:

```bash
grep -rE "from ['\"]next/(navigation|link)['\"]" src/components src/app src/hooks --include="*.tsx" --include="*.ts" \
  | grep -vE "notFound" \
  | grep -vE "auth/callback/route\.ts"
```

Expected: EMPTY once both 03a and 03b have landed. If 13-03b runs FIRST and 13-03a hasn't started, this combined gate will still show `next/navigation` hits — that's 13-03a's territory and NOT a failure for this plan. Only evaluate the plan-scoped grep (just `next/link`) for THIS plan's acceptance.
  </action>

  <verify>
    <automated>npx tsc --noEmit &amp;&amp; npm run build &amp;&amp; test -z "$(grep -rE \"from ['\\\"]next/link['\\\"]\" src --include='*.tsx' --include='*.ts')"</automated>
  </verify>

  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0
    - `npm run build` exits 0
    - `grep -rE "from ['\"]next/link['\"]" src --include='*.tsx' --include='*.ts'` returns EMPTY
    - Build log shows no `Module not found` or `has no exported member 'Link'` errors
    - All ~38 files now import `Link` from `@/i18n/navigation`
  </acceptance_criteria>

  <done>
    - RTE-04 (`Link`-swap half) closed
    - Every `<Link>` click in the app preserves the active locale prefix
    - Combined with 13-03a: complete RTE-04 + RTE-05 closure across the navigation primitive surface
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client → Client navigation (`<Link>` click) | href prop values are developer-controlled strings, not user input. Swap is mechanical. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13-08 | T (Tampering) | `<Link>` href prop | accept | All href values are hardcoded in developer-written components. next-intl's `Link` is defensive — only prepends the active locale, never parses or rewrites the href. |
| T-13-09 | I (Info disclosure) | Navigation fallthrough | accept | If a `Link` import misses this swap, the failure is a locale-strip (user bounces from `/ar/` to `/en/` on click) — no information disclosure. The 13-06 Task 1 static gate catches any residue before merge. |
</threat_model>

<verification>
- [ ] `npx tsc --noEmit` exit 0
- [ ] `npm run build` exit 0
- [ ] `grep -rE "from ['\"]next/link['\"]" src --include='*.tsx' --include='*.ts'` is EMPTY
- [ ] Every file in /tmp/phase-13-03b-link-files.txt imports `Link` from `@/i18n/navigation`
</verification>

<success_criteria>
- ~38 `Link` import swaps complete
- Zero `next/link` imports in `src/`
- Build + tsc green
- RTE-04 (Link half) closed; combined with 13-03a, RTE-04 + RTE-05 are fully closed across the Phase 13 scope
- No user-facing navigation click strips the active locale prefix
</success_criteria>

<output>
After completion, create `.planning/phases/13-route-restructure-auth-safety/13-03b-SUMMARY.md`.
</output>
