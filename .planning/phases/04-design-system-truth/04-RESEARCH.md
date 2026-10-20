# Phase 4: Design System Truth - Research

**Researched:** 2026-10-20
**Domain:** Design tokens in Tailwind v4 + shadcn, lint-enforced token guard, admin token page, Claude Design canvas, dark HTML email
**Confidence:** HIGH for code/tooling (every Tailwind, tailwind-merge, ESLint and engine claim below was run against the repo's installed versions); MEDIUM for email-client behaviour; LOW for the Claude Design font-upload mechanism (not documented anywhere I could reach)

<user_constraints>
## User Constraints (from CONTEXT.md)

NOT SIGNED: D-01..D-08 are the recommended answers of `04-DISCUSS-QUESTIONS.md`, pending Koss via the controller. If an answer differs, the plans named in `04-GATE.md` change. Copied from `04-CONTEXT.md`:

### Locked Decisions (recommended, pending signature)
- **D-01 (Q1 A):** Page background is **#090909** (`--bg-0`), as live. Roadmap/requirement wording "#0a0a0a" is corrected. The two stray `#0a0a0a` literals (`src/app/[locale]/(viewer)/layout.tsx:41`, `src/components/layout/user-avatar.tsx:25`) become `var(--bg-0)` / `var(--primary-foreground)`.
- **D-02 (Q2 A):** Radius roles stay as the engine outputs for `roundness 50, pill true, field 8`: chip/control/shell 999px, field 8px, card 12px, media 11px, panel 16px, `--radius` 8px. "8px base radius" = field/base. Bracket radii in `src/` become named Tailwind utilities backed by these tokens.
- **D-03 (Q3 A):** Three blue-era leftovers snap to tokens: `ui/select.tsx` popover `bg-[#11151d]/98` -> `bg-[var(--bg-1)]`; Sonner toaster `src/app/[locale]/layout.tsx:153` `bg-[#10131a]` -> `bg-[var(--bg-1)]`; `landing-hero-animations.tsx:53` hover `#7082ff` + glow `rgba(96,115,255,.28)` -> `var(--uis-primary-hover)` + `rgba(255,204,0,.18)` glow as a token. Only intended visible changes.
- **D-04 (Q4 A):** Category colours (`public.categories.color`, 15 live rows) are content and stay free; picker stays; exempt in the guard (values read from data). Everything else uses one brand map: 6 CIT colours + safe tints, exported once from `src/lib/brand-colors.ts`. Shows keep their 5-value `brand_color` enum (no migration); Desert Sand only for genre/category defaults.
- **D-05 (Q5 A):** One read-only page `/[locale]/admin/design-system` inside the admin layout (guard `app_config.admin_user_id`, redirect `/watch`; Phase 5 `requireAdmin` + TOTP replaces it later). Reads CSS custom properties at runtime (`getComputedStyle`), renders LBC type scale (EN + AR), radius roles, real `Button`/`Input`/`Badge`. Linked from admin sidebar. No top-level `/design-system` route; DS-01/DS-04 wording updated to `/admin/design-system`.
- **D-06 (Q6 A):** New Claude Design canvas "Clickit Story" (Artifact, Design type) installing the published "UI System" design system (claude.ai/artifact/XTKikX3yqayDRfUixvkNrS) with `UIS.Root primary="#ffcc00" accent="#ffcc00" neutral="#737373" mode="dark" roundness=50 pill field=8 surface="glass"`, LBC from canvas assets. Four groups: Foundations, Viewer, Admin, Email. Phase 6 signed pictures reproduced unchanged. Existing brand-neutral UI System canvas not edited.
- **D-07 (Q7 A):** Emails dark: page #090909, card #101010 hairline border 12px radius, primary button #ffcc00 with #090909 ink, text #F4F4F4/#CCCCCC/#A1A1A1, system sans fallback, logo as hosted image on `media.clickitstory.ae`. Table-based, inline styles, 600px max. Copy placeholder.
- **D-08 (Q8 A):** Koss signs four groups separately in `04-GATE.md` with date.

### Claude's Discretion
- Guard mechanism: Node script `scripts/check-design-tokens.mjs` in `gate:local` with an allowlist file (token files, `src/lib/brand-colors.ts`, data-driven colours, email templates).
- Named radius utilities in `@theme`: `rounded-chip|control|field|card|media|panel` mapped to `--uis-r-*`; named shadows `shadow-soft|panel|popover` mapped to existing `--shadow-*` tokens.
- `white/NN`, `black/NN` alpha utilities (383 uses) stay; guard does not flag them. Raw palette classes (`bg-red-500`, 4 uses) replaced with tokens.
- Token pinning: unit test reads `globals.css` and asserts signed values; second test re-derives radius roles from `ui.config.json` with the `Loomlyne/ui-system` `radius.ts` formula vendored as a small pure function (no new dependency).
- Avatar initials gradient (`#c8a04a -> #d97757`) moves to `--chart-5` / `--chart-2` (no visible change).

### Deferred Ideas (OUT OF SCOPE)
- Generating `globals.css` from `ui.config.json` with the ui-system CLI.
- A light theme (dark only).
- Moving category colours to the brand map (Q4 B; needs a live write).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DS-01 | DESIGN.md and the in-app page describe the live look (LBC, #ffcc00, #090909 per D-01, 8px base radius) | Engine output re-derived and equals `globals.css` (see Summary); pin test + DESIGN.md parity test; runtime token page pattern (Q3) |
| DS-02 | All colours, radii, shadows from tokens; no hard-coded hex or indigo leftovers; one brand map | ESLint rule with measured violation inventory (Q2); Tailwind named utilities verified (Q1); brand map consolidation |
| DS-03 | Claude Design canvas with foundations, viewer, admin, email, signed by Koss | Canvas install recipe and a Root-prop trap (Q4); email constraints (Q5); manual-only gate |
| DS-04 | Design-system page admin-only | Lives under `admin/layout.tsx` guard; `proxy.ts` already requires sign-in for `/admin`; static pin + numbered UAT |
</phase_requirements>

## Summary

The live look is already the engine's output: I rebuilt `buildTheme` from the `Loomlyne/ui-system` clone on `ui.config.json` and every colour and radius equals `globals.css` (`--uis-bg #090909`, surface `#101010`, `#191919`, `#2A2A2A`, line `#2A2A2A`/`#424242`, ink `#F4F4F4/#CCCCCC/#A1A1A1`, primary `#ffcc00`, hover `#D7AD16`, soft `#312915`, radii chip/control/shell 999, field 8, card 12, panel 16, media 11) [VERIFIED: ran packages/core/src/theme.ts]. So the work is cleanup and enforcement, not redesign. Test runner is `node --test` with `--experimental-strip-types` (no vitest) [VERIFIED: package.json].

Three decisions for the planner that differ from or extend CONTEXT: (1) **Enforce the guard as a local ESLint rule, not a Node script.** PR CI (`pr-gate.yml`) runs `npm run lint`, typecheck, unit tests and build as separate steps, and `tests/unit/workflows.test.ts` pins the workflow's job ids; a new script would need a workflow edit plus pin-test changes, while an ESLint rule rides `npm run lint` in both `gate:local` and CI with zero workflow change. I prototyped it against the whole of `src/` (numbers below). (2) **`tailwind-merge` must be told about the new names** or `cn('rounded-lg', 'rounded-card')` keeps both classes and CSS order decides: I reproduced that. (3) **The guard finds more than the scout counted**: 14 `rgba()` literals with non-neutral channels (`rgba(10,10,10,.96)` navbar/hero scrims = the old #0a0a0a, `rgba(8,8,12,…)` in `src/lib/cinema.ts`, dialog/sheet overlays `rgba(4,6,10,…)`, coming-soon `rgba(255,204,0,…)`, red-500 glow), plus `#8D9CFF` default in `genre-pills.tsx` and a `brand-yellow` vs "Desert Sand" / `brand-sand` naming split. These need a decision on the visible-change ledger (Open Questions 1 and 2).

**Primary recommendation:** Add `--radius-*` named keys (inline, pointing at `--uis-r-*`) and move shadow values into `@theme static`, extend `tailwind-merge` in `cn()`, ship the ESLint rule `clickit/no-raw-design-values` in the same PR as the codemod (rule goes to `error` last), render the admin page with `useSyncExternalStore` + `getComputedStyle`, and pin everything with one `tests/unit/design-tokens.test.ts`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Token values (colour, radius, shadow) | CDN / Static (compiled CSS from `globals.css`) | Build tooling (Tailwind compile) | Pure CSS custom properties; no runtime code |
| Named utilities (`rounded-card`, `shadow-popover`) | Build tooling (Tailwind `@theme`) | Browser (cascade) | Resolved at compile time to `var(--uis-r-*)` |
| `cn()` conflict resolution | Browser/Client and Frontend Server (shared util) | — | `twMerge` runs wherever `cn` runs; config must know new names |
| Guard against raw values | Build tooling (ESLint in `npm run lint`) | CI (`pr-gate.yml` gate job) | Static analysis, no runtime |
| Admin token page shell + auth | Frontend Server (RSC under `admin/layout.tsx`) | API/Backend (Supabase `app_config` lookup) | Existing admin guard owns access |
| Reading resolved token values | Browser / Client | — | Only the browser knows computed values; avoids `fs` on a Workers runtime |
| Claude Design canvas | External design tool | Koss (signature) | Not in the repo; owner-gated |
| Email templates (design only here) | External (mail clients) | Phase 5 build | Table HTML rendered by clients with their own dark-mode rules |

## Standard Stack

No new runtime dependency. Everything below is already installed. [VERIFIED: node_modules versions]

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tailwindcss | 4.2.2 | `@theme` named radius/shadow/colour keys | Already the styling engine |
| tailwind-merge | 3.5.0 | `extendTailwindMerge` with `theme.radius/shadow/inset-shadow/drop-shadow` | Needed so custom names conflict-resolve |
| eslint | 9.39.4 | Local plugin rule in flat config | Already in `npm run lint`; AST-accurate |
| node:test + `--experimental-strip-types` | Node 24 in CI (v26 local) | Token pin tests, rule tests | Existing runner and pattern (`readFileSync` pins) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next-intl | ^4.9.1 | `admin.designSystem.*` messages EN + AR | New admin page text |
| espree (bundled in eslint) | — | Parse JSX fixtures in the rule test without a TS parser | Rule unit tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ESLint rule (recommended) | `scripts/check-design-tokens.mjs` (CONTEXT discretion) | Script can also scan `.css`/`.md`, but is invisible to PR CI unless `pr-gate.yml` and its pin tests change; regex over raw text also hits comments and `&#039;` |
| `getComputedStyle` at runtime | Parse `globals.css` at build/request | Build-time parse needs `fs` or a generated file that can drift; avoid `fs` on the coming Workers runtime [ASSUMED: Workers has no reliable app-source filesystem] |
| `@theme static` shadows | Keep in `:root` + `@theme inline --shadow-soft: var(--shadow-soft)` | Second form emits a self-referencing `--shadow-soft: var(--shadow-soft)` in the theme layer (reproduced); fragile |

**Installation:** none.

**Version verification:** `node_modules/{tailwindcss,tailwind-merge,eslint}/package.json` read 2026-10-20: 4.2.2 / 3.5.0 / 9.39.4.

## Package Legitimacy Audit

No external packages are installed or recommended by this phase. The vendored `buildRadius` function (about 20 lines, `Loomlyne/ui-system`, same owner) is copied as code, not installed. `@typescript-eslint/parser` and `@tailwindcss/node` are transitive: do not import them in committed code or tests.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
ui.config.json --(engine formula, vendored in test)--> pinned values
        |                                                  ^
        v                                                  | assert
src/styles/globals.css  :root --uis-r-*, --bg-*, --primary ...
   |  @theme inline  --radius-card: var(--uis-r-card) ...      tests/unit/design-tokens.test.ts
   |  @theme static  --shadow-popover: ...  (moved from :root) reads globals.css, DESIGN.md,
   v                                                           brand-colors.ts, ui.config.json
Tailwind compile --> utilities rounded-card / shadow-popover --> components (src/**/*.tsx)
                                                                    ^
src/lib/utils.ts cn() = extendTailwindMerge(theme names) -----------+
                                                                    |
eslint.config.mjs --> eslint-rules/clickit-tokens.mjs  --fails on--> hex / rgb() / rounded-[..] / shadow-[..] / bg-red-500
   ^ run by: npm run lint  (gate:local AND pr-gate.yml "gate" job)    outside allowlist (brand-colors.ts, email dir, waivers)

Browser (admin) --> /[locale]/admin/design-system (RSC page, inside admin/layout.tsx guard)
        --> <TokenGrid> client: useSyncExternalStore(getComputedStyle(documentElement)) --> swatches + values
        --> radius roles via rounded-* classes, real Button/Input/Badge, LBC EN + AR specimens

Claude Design canvas (external): UI System design system + UIS.Root(props, field=8 via config) + LBC @font-face
        --> boards (Foundations, Viewer, Admin, Email) --> Koss signs --> 04-GATE.md
```

### Recommended Project Structure
```
eslint-rules/clickit-tokens.mjs          # rule + exported PATTERNS (unit-testable)
eslint.config.mjs                        # registers plugin, allowlist blocks
src/lib/brand-colors.ts                  # the one map (+ palette list, defaults)
src/lib/utils.ts                         # cn() with extendTailwindMerge
src/styles/globals.css                   # named keys, @theme static shadows
src/app/[locale]/admin/design-system/page.tsx
src/components/admin/design-system/token-grid.tsx   # 'use client'
tests/unit/design-tokens.test.ts         # pins (globals, DESIGN.md, brand map, theme parity)
tests/unit/clickit-tokens-rule.test.ts   # Linter fixtures
tests/unit/helpers/ui-system-radius.ts   # vendored buildRadius
.planning/phases/04-design-system-truth/04-GATE.md
```

### Pattern 1: Named radius/shadow utilities (verified compile)
**What:** Inline theme keys that reference the existing `--uis-r-*` vars; shadows defined once in `@theme static`.
**When to use:** all replacements of `rounded-[12px]`, `shadow-[...]`.
**Example:**
```css
/* Source: compiled with @tailwindcss/node 4.2.2 on 2026-10-20; output checked */
@theme inline {
  /* existing --radius-sm..2xl (4/6/8/10/12px) stay untouched */
  --radius-chip: var(--uis-r-chip);
  --radius-control: var(--uis-r-control);
  --radius-field: var(--uis-r-field);
  --radius-card: var(--uis-r-card);
  --radius-media: var(--uis-r-media);
  --radius-panel: var(--uis-r-panel);
  --radius-shell: var(--uis-r-shell);
  --color-primary-hover: var(--uis-primary-hover);   /* hover:bg-primary-hover */
  --color-surface-1: var(--bg-1);                    /* replaces duplicate hexes in @theme */
  --color-surface-2: var(--bg-2);
  --color-surface-3: var(--bg-3);
  --color-surface-4: var(--bg-4);
  --color-text-primary: var(--text);
  --color-text-secondary: var(--text-dim);
  --color-text-muted: var(--text-mute);
}
@theme static {            /* MOVE these out of :root; do not define them twice */
  --shadow-soft: 0 24px 80px rgba(0, 0, 0, 0.38);
  --shadow-panel: 0 10px 32px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  --shadow-popover: 0 24px 80px rgba(0, 0, 0, 0.42);      /* select.tsx value; toaster 0.45 -> 0.42 */
  --shadow-bar: 0 8px 32px -8px rgba(0, 0, 0, 0.65);      /* watch-shell */
  --shadow-float: 0 40px 120px rgba(0, 0, 0, 0.6);        /* shorts-overlay */
  --shadow-glow-primary: 0 16px 40px rgba(255, 204, 0, 0.18);  /* D-03 hero hover */
  --inset-shadow-hairline: inset 0 1px 0 rgba(255, 255, 255, 0.04);  /* checkbox, select */
  --drop-shadow-splash: 0 24px 80px rgba(0, 0, 0, 0.55);  /* coming-soon */
}
```
Verified output: `rounded-card` -> `border-radius: var(--uis-r-card)` (=12px, identical to `rounded-[12px]`); `rounded-t-panel` -> top-left/right `var(--uis-r-panel)`; `md:rounded-card` works; `hover:bg-primary-hover` -> `var(--uis-primary-hover)`; `shadow-popover` -> `--tw-shadow: 0 24px 80px var(--tw-shadow-color, rgba(0,0,0,.42))`; `inset-shadow-hairline`, `drop-shadow-splash` generate. Existing `shadow-[var(--shadow-soft)]` keeps working because `@theme static` always emits the variable to `:root`.

### Pattern 2: `cn()` knows the new names
```ts
// Source: tailwind-merge 3.5.0 behaviour reproduced 2026-10-20
import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ['chip', 'control', 'field', 'card', 'media', 'panel', 'shell'],
      shadow: ['soft', 'panel', 'popover', 'bar', 'float', 'glow-primary'],
      'inset-shadow': ['hairline'],
      'drop-shadow': ['splash'],
    },
  },
})
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
```
Measured: default `twMerge('rounded-md rounded-card')` returns **both** classes; extended returns `rounded-card`. Same for `shadow-md shadow-soft`, `rounded-full rounded-card`. Extended: `rounded-t-lg rounded-t-panel -> rounded-t-panel`.

### Pattern 3: Guard as an ESLint rule (prototype run on all of `src/`)
Full module in Code Examples. Detection by AST node: every string `Literal` (className attrs, `cn()` args, style props, object values) and every `TemplateElement`; comments are never scanned. Waiver: `// eslint-disable-next-line clickit/no-raw-design-values -- <reason>` (ESLint 9 `--` description). Allowlist = a config block turning the rule off for `src/lib/brand-colors.ts` and the future email template directory.

### Pattern 4: Admin token page without effects
React 19 + `eslint-config-next` 16 enable `react-hooks/set-state-in-effect` (the repo already has disable comments for it), and the React Compiler is on. Use `useSyncExternalStore` so there is no setState in an effect; swatches paint from `var(--x)` so they are correct even before JS reads the text.

### Anti-Patterns to Avoid
- **Defining a shadow in both `:root` and `@theme`:** duplicates; unlayered `:root` silently wins. Move it.
- **`@theme inline { --shadow-soft: var(--shadow-soft) }`:** emits a self-referencing var in the theme layer (reproduced). Use `@theme static` with the real value.
- **Renaming classes without extending `twMerge`:** override chains in `ui/*` components stop working.
- **Reading `globals.css` with `fs` in the admin page:** breaks on the Workers runtime and can drift from the compiled CSS.
- **Turning the ESLint rule on before the codemod lands:** red lint for the whole branch. Order: codemod -> rule `error` in the last commit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Radius role values | Hard-coded numbers in tests | Vendored `buildRadius` (20 lines) on `ui.config.json` | Same formula as the engine; catches a config edit not mirrored in CSS |
| Colour derivation for pins | Re-implementing the colour engine | Constants pinned from the verified engine run | Engine output equals CSS today; pin the constants |
| Detecting raw values | A regex over file text | ESLint `Literal`/`TemplateElement` visitor | Ignores comments, handles JSX/cn()/templates, supports `eslint-disable` with reasons |
| Class conflict resolution | Custom string dedupe | `extendTailwindMerge` theme extension | Built-in, verified |
| Alpha on a token colour | New `rgba()` literals | Tailwind `/NN` modifier (`bg-background/96`) or `color-mix(in srgb, var(--bg-0) 96%, transparent)` in JS gradient strings | Tracks the token; `watch-shell` already uses `bg-[var(--bg-0)]/90` |
| Dark email auto-detection | JS or media-query tricks | Static dark design + `color-scheme` meta + `bgcolor` attrs | Most clients ignore scripts and many ignore `@media` |

**Key insight:** every value this phase needs already exists in `globals.css`; the work is naming it, removing duplicates, and making the build fail when someone bypasses it.

## Runtime State Inventory

Not a rename/migration, but a value-preserving refactor; answered explicitly for safety.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `public.categories.color` (15 live rows) and shows' `brand_color` enum are data, unchanged (D-04). None | None. No DB write in this phase |
| Live service config | None (no external service holds these class names) | None |
| OS-registered state | None | None |
| Secrets/env vars | None. Build for gates needs placeholder public Supabase env (see CLAUDE.local.md "Gate facts") | None |
| Build artifacts | `.next` cache holds old class output | Local `next build` regenerates; nothing installed globally |

## Common Pitfalls

### Pitfall 1: Silent twMerge divergence
**What goes wrong:** `rounded-card` plus a caller's `rounded-lg` both stay; the winner is CSS source order, not class order.
**Why:** twMerge only knows `rounded-{none,sm,md,lg,xl,2xl,3xl,full,...}` plus arbitrary values; reproduced.
**How to avoid:** Pattern 2 in the same commit as the first named class; unit-test `cn('rounded-lg','rounded-card') === 'rounded-card'`.
**Warning signs:** a Button/Input override stops applying after the codemod.

### Pitfall 2: Production CSS minifies custom property values
**What goes wrong:** the admin page shows `#fc0` where the source says `#ffcc00` (live CSS on www shows `--primary:#fc0` [VERIFIED: scout, live CSS]); `rgba(255,255,255,.08)` may become `#ffffff14`.
**How to avoid:** normalise to upper-case 6-digit hex (or `rgba()`) for display before showing; never string-compare runtime output to source in a test (compare source files instead).

### Pitfall 3: Case and duplicate hex drift
Brand hexes exist in `globals.css` `@theme` (lower-case), `BRAND_COLOR_HEX` (upper-case), `admin/shows/[id]/edit/page.tsx`, `genre-color-editor.tsx`, `genres-grid.tsx`, `profile-history-row.tsx`. **How to avoid:** one palette export; pin test compares `@theme --color-brand-*` to the map case-insensitively; `@theme` surface/text duplicates become `var()` refs (Pattern 1).

### Pitfall 4: `rgba(10,10,10,…)` is #0a0a0a in disguise
D-01 only names two hex literals. `navbar.tsx:90,98,101,102`, `hero-slide.tsx:59`, `series-detail-hero.tsx:107-108`, `series/[slug]/loading.tsx:14`, `lib/category-chip.ts:25` carry the old value as `rgba(10,10,10,…)`. Converting to `bg-background/96` or `color-mix(... var(--bg-0) ...)` changes one channel step (10 -> 9), imperceptible but not byte-identical. State it in the PR.

### Pitfall 5: `field=8` is not a `UIS.Root` prop
`RootProps` has `roundness` and `pill` only; there is no `field` or overrides prop, so with `pill` the canvas renders inputs at 999px while the live app uses 8px [VERIFIED: packages/react/src/Root.tsx `configFromProps`]. Pass `config` (it preserves `radius.overrides`, because Root spreads `...base.radius`) or wrap each artboard in an element with `style="--uis-r-field: 8px"`.

### Pitfall 6: Hex-looking text
`&#039;` (`src/app/actions/contact.ts:321`) and `href="#add"`-style anchors look like hex. The regex uses a lookbehind `(?<![&\w])` and a lookahead `(?![\w-])`; both tested.

### Pitfall 7: Phase 6 brackets
See the conflict table below; Phase 6 code written to its UI-SPEC fails lint after Phase 4 lands.

## Code Examples

### The ESLint rule (prototyped; fixtures below behave as listed; 117 findings on current `src/`)
```js
// eslint-rules/clickit-tokens.mjs  (Source: prototype run 2026-10-20, ESLint 9.39.4)
const V = String.raw`(?:^|[\s"'\`:!])(?:[a-z0-9-]+:)*` // class start; variants like hover: or data-[x]: end in ':'
export const PATTERNS = {
  hex: /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/,
  // neutral overlays rgba(0,0,0,..) / rgba(255,255,255,..) pass; `rgba(${r}` never matches (needs a digit)
  rgb: /\brgba?\(\s*(?!0\s*[, ]\s*0\s*[, ]\s*0\b|255\s*[, ]\s*255\s*[, ]\s*255\b)\d/i,
  radius: new RegExp(V + String.raw`rounded(?:-(?:s|e|t|r|b|l|ss|se|ee|es|tl|tr|br|bl))?-\[(?!var\()`),
  shadow: new RegExp(V + String.raw`(?:shadow|drop-shadow|inset-shadow)-\[(?!var\()`),
  palette: new RegExp(V + String.raw`(?:bg|text|border|ring|from|via|to|fill|stroke|shadow|outline|divide|decoration|accent|caret)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}(?![\w-])`),
}
const HINTS = { hex: 'var(--token) or a theme colour class', rgb: 'a token, bg-background/NN, or white/NN black/NN',
  radius: 'rounded-chip|control|field|card|media|panel or the standard scale', shadow: 'shadow-soft|panel|popover|bar|float or a --shadow-* token',
  palette: 'bg-primary, bg-destructive or brand-* classes' }
export const rule = {
  meta: { type: 'problem', schema: [], messages: { raw: 'Raw {{kind}} value "{{text}}". Use {{hint}}. Waive with eslint-disable + reason only for data-driven values.' } },
  create(context) {
    const check = (node, s) => {
      for (const [kind, re] of Object.entries(PATTERNS)) {
        const m = re.exec(s)
        if (m) context.report({ node, messageId: 'raw', data: { kind, text: m[0].trim(), hint: HINTS[kind] } })
      }
    }
    return {
      Literal(n) { if (typeof n.value === 'string') check(n, n.value) },
      TemplateElement(n) { check(n, n.value.cooked ?? n.value.raw) },
    }
  },
}
export default { rules: { 'no-raw-design-values': rule } }
```
```js
// eslint.config.mjs additions (append after the existing spread; flat config, later blocks win)
import clickit from './eslint-rules/clickit-tokens.mjs'
// ...
{ files: ['src/**/*.{ts,tsx}'], plugins: { clickit }, rules: { 'clickit/no-raw-design-values': 'error' } },
{ files: ['src/lib/brand-colors.ts', 'src/emails/**', 'src/lib/mail/templates/**'], rules: { 'clickit/no-raw-design-values': 'off' } },
```
Fixtures that must pass (test file): `rounded-[12px]` fails; `md:rounded-t-[16px]` fails; `data-[state=open]:rounded-[8px]` fails; `rounded-[var(--uis-r-media)]` passes; `shadow-[var(--shadow-soft)]` passes; `hover:bg-[#7082ff]` fails; `` `p ${x} shadow-[0_1px_2px_#000] q` `` fails; `"&#039;"`, `href="#main"`, `href="#"` pass; `bg-[rgba(10,10,10,0.96)]` fails; `rgba(0,0,0,0.85)`, `rgba(255, 255, 255, 0.1)`, `` `rgba(${r},${g},${b},0.35)` `` pass; `bg-red-500` fails; `bg-white/10 text-black/60` pass; `w-[12px] h-[3px] tracking-[0.2em] text-[11px]` pass; a `//` comment containing `#fff` passes.

Measured on current `src/` (prototype with the TS parser, one finding per string node and kind): radius 60, hex 29 (38 raw matches), rgb 14, shadow 10, palette 4 = 117.

### Codemod map (value-equivalent; bracket -> utility)
| Bracket | Count | Replace with | Computed value |
|---------|-------|--------------|----------------|
| `rounded-[12px]` | 37 | `rounded-card` | 12px |
| `rounded-[8px]` | 9 | `rounded-field` (or `rounded-lg`, also 8px) | 8px |
| `rounded-[11px]` | 6 | `rounded-media` | 11px |
| `rounded-[6px]` | 2 | `rounded-md` (6px, existing) | 6px |
| `rounded-[10px]` | 2 | `rounded-xl` (10px, existing) | 10px |
| `rounded-t-[16px]` | 1 | `rounded-t-panel` | 16px |
| `rounded-b-[4px]` | 1 | `rounded-b-sm` (4px, existing) | 4px |
| `rounded-[1px]` | 2 | `rounded-xs` (2px) on a 3px-high 40%-opacity bar; the only radius that is not byte-identical | 1px -> 2px |
| `rounded-[var(--uis-r-media)]` | 1 | `rounded-media` | 11px |

Shadows: select popover + toaster -> `shadow-popover`; checkbox/select inset -> `inset-shadow-hairline`; `watch-shell` -> `shadow-bar`; `shorts-overlay` -> `shadow-float`; `coming-soon-splash` -> `drop-shadow-splash`; landing hero -> `shadow-glow-primary` + `hover:bg-primary-hover`; navbar `bg-red-500` x4 + glow -> see Open Question 2; `show-form` and `reset-password` `shadow-[var(--shadow-*)]` -> `shadow-soft` / `shadow-panel`.

### Admin token grid (client)
```tsx
// Source: pattern verified against eslint-config-next 16 rules in repo (react-hooks/set-state-in-effect is active)
'use client'
import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}
function useCssVar(name: string) {
  return useSyncExternalStore(
    subscribe,
    () => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    () => '', // server + hydration snapshot; client re-renders with the value
  )
}
export function normalizeColor(v: string) { /* #rgb, #rrggbb, #rrggbbaa, rgb()/rgba() -> '#FFCC00' or 'rgba(...)' */ return v }
export function TokenSwatch({ name, label }: { name: string; label: string }) {
  const value = normalizeColor(useCssVar(name))
  return (
    <div className="rounded-card border border-[var(--line)] bg-[var(--bg-1)] p-3">
      <div className="h-12 rounded-field border border-[var(--line-2)]" style={{ background: `var(${name})` }} />
      <p className="mt-2 text-sm">{label}</p>
      <p className="text-[11px] text-[var(--text-mute)]" dir="ltr">{name} {value}</p>
    </div>
  )
}
```
The page (`page.tsx`, server) uses `getTranslations('admin.designSystem')` and `generateMetadata` like `admin/audit/page.tsx`; export a static `DESIGN_TOKENS` array of token **names** only. A unit test asserts every listed name exists in `globals.css` and every colour token in `:root` is listed. Add `admin.dashboard.designSystem` (nav label) and an `admin.designSystem` namespace to both `src/messages/en.json` and `ar.json`; page content uses logical properties (`ms-`, `ps-`, `text-start`) and `<bdi>`/`dir="ltr"` for token names. Add the nav entry in `src/components/admin/admin-header.tsx` under `operations`. `proxy.ts` already sends signed-out visitors away from `/admin`, and `admin/layout.tsx` redirects non-admins to `/watch` [VERIFIED: source].

### Token pin test skeleton
```ts
// tests/unit/design-tokens.test.ts  (pattern: tests/unit/admin-ui-guards.test.ts reads sources with readFileSync)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildRadius } from './helpers/ui-system-radius.ts' // vendored 20-line copy of packages/core/src/radius.ts
const css = readFileSync(new URL('../../src/styles/globals.css', import.meta.url), 'utf8')
const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)![1]
const decl = (b: string, n: string) => b.match(new RegExp(`${n}:\\s*([^;]+);`))?.[1].trim().replace(/\s+/g, ' ')
test('signed colour truth', () => {
  assert.equal(decl(root, '--bg-0'), '#090909'); assert.equal(decl(root, '--primary'), '#ffcc00')
  assert.equal(decl(root, '--primary-foreground'), '#090909'); assert.equal(decl(root, '--radius'), '8px')
})
test('radius roles equal the engine formula on ui.config.json', () => {
  const cfg = JSON.parse(readFileSync(new URL('../../ui.config.json', import.meta.url), 'utf8'))
  const r = buildRadius(cfg.radius)
  for (const [role, px] of Object.entries({ chip: 999, control: 999, field: 8, card: 12, panel: 16, media: 11, shell: 999 }))
    assert.equal(decl(root, `--uis-r-${role}`), `${px}px`), assert.equal(r[role as keyof typeof r], px)
})
```
Further cases: `.dark` block equals `:root` shadcn tokens; `@theme --color-brand-*` equals `BRAND_COLOR_HEX` case-insensitively (import `src/lib/brand-colors.ts`; its only import is `import type`, erased by strip-types); every `--radius-<role>` in `@theme inline` is `var(--uis-r-<role>)`; `cn('rounded-lg','rounded-card') === 'rounded-card'`; DESIGN.md token table values equal `globals.css`; no banned literal (`#0a0a0a`, `6073ff`, `7082ff`, `10131a`, `11151d`, `rgba(96`, `rgba(4,6,10`, `rgba(8,8,12`) in `src/**` (excluding the test) or `DESIGN.md`.

### Dark HTML email skeleton (D-07)
```html
<!-- Source: constraints below; copy is placeholder -->
<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<style>:root{color-scheme:dark;supported-color-schemes:dark} body{margin:0}</style></head>
<body bgcolor="#090909" style="margin:0;background-color:#090909">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#090909"><tr><td align="center" style="padding:24px 12px">
 <table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#101010"
        style="max-width:600px;width:100%;background-color:#101010;border:1px solid #2A2A2A;border-radius:12px">
  <tr><td style="padding:32px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#F4F4F4;font-size:16px;line-height:1.5">
   <img src="https://media.clickitstory.ae/…logo.png" width="140" alt="Clickit Story" style="display:block;border:0">
   <!-- button: bulletproof cell -->
   <table role="presentation"><tr><td bgcolor="#ffcc00" style="border-radius:999px;background-color:#ffcc00">
     <a href="…" style="display:inline-block;padding:14px 28px;color:#090909;font-weight:700;text-decoration:none">Sign in</a></td></tr></table>
  </td></tr></table></td></tr></table></body></html>
```
For the 6-digit code use monospace system font (`ui-monospace, Menlo, Consolas`) in a `#191919` cell; for Arabic set `dir="rtl"` on the card table and `lang="ar"`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` `borderRadius` | `@theme` namespaces (`--radius-*`, `--shadow-*`, `--inset-shadow-*`, `--drop-shadow-*`) | Tailwind v4 | Named utilities generated from CSS vars |
| Custom ESLint plugin package | Inline plugin object in flat config | ESLint 9 | No extra package; `plugins: { clickit }` |
| setState in `useEffect` to read DOM | `useSyncExternalStore` | React 19 + compiler lint | Lint-clean |

**Deprecated/outdated:** nothing in the repo; `@theme inline` does not emit its variables to `:root` (verified), so CSS files must reference `--uis-r-*`, not `--radius-card`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Claude Design canvases can load a custom font via `@font-face` pointing at an uploaded asset (`/_blob/...` path pattern appears only for `logo-src` in ui-system docs) | Q4 | Executor needs the fallback: base64-embed both woff2 (72 KB and 71 KB, about 195 KB base64) in the artboard `<style>` |
| A2 | `<x-import ... config="{{ {...} }}">` accepts an object expression | Q4 | Use the wrapper-div `--uis-r-field: 8px` fallback instead |
| A3 | Gmail/Outlook auto-invert light designs; Apple Mail honours `color-scheme`; already-dark emails are mostly left alone | Q5 | Dark card could be partially altered in Outlook.com; test with real inboxes once Phase 5 sends (secondary sources only) |
| A4 | Outlook for Windows (Word engine) ignores `border-radius` (caniemail footnote: use VML `roundrect`) | Q5 | Pill button renders square there; acceptable fallback, state it on the board |
| A5 | Cloudflare Workers runtime should not be relied on for reading app source files | Alternatives | If wrong, build-time parse would also work; runtime read is still simpler |
| A6 | Pure `#fff`/`#000` are the values most aggressively transformed by dark-mode inversion, so near-black/near-white (#090909, #F4F4F4) are safer | Q5 | Low |

## Open Questions

1. **Visible-change ledger beyond D-03.** The guard also flags: dialog/sheet scrims `rgba(4,6,10,.82/.80)` (blue-black), `src/lib/cinema.ts` `rgba(8,8,12,…)` (blue-black gradient stops), `rgba(10,10,10,…)` bars/scrims (the old #0a0a0a), coming-soon `rgba(255,204,0,…)` glow, and the live-dot `bg-red-500` (#ef4444) + glow. Recommendation: treat neutral conversions (10->9, 8,8,12 -> bg-0 mix, scrims -> `bg-black/80`) as part of D-01/D-03 intent and list them in the PR; for `bg-red-500` use `bg-destructive` (#ff3b30) and say so (small visible change). Controller to confirm with Koss, or the executor keeps exact values via waivers (worse).
2. **`brand-yellow` vs `brand-sand`.** `globals.css` and 4 usages say `brand-yellow` (#f8c623); DESIGN.md and Phase 6 spec say "Desert Sand"; CONTEXT D-04 writes `brand-sand`. Recommendation: keep the class `brand-yellow` (no churn), label it "Desert Sand" in the palette export and docs.
3. **Claude Design font upload** (A1/A2): needs a 5-minute hands-on test by the controller before the executor builds boards; fallback is ready.
4. **Who patches Phase 6's UI-SPEC** radius row and its 15 bracket examples (see conflict table). Recommend a one-line addendum in `04-GATE.md` plus a note for the Phase 6 branch owner; no signed picture changes.
5. **CSS-file radii.** `admin.css` has `border-radius: 6px/8px` (3 lines) and `globals.css` has `8px`/`999px`. The ESLint rule does not scan CSS. Recommend: leave (token-adjacent), convert admin.css `8px` to `var(--uis-r-field)` opportunistically, and add a unit test that `admin.css` has zero hex.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | tests, ESLint | yes | v26.7.0 local, CI Node 24 | — |
| ESLint / Tailwind / tailwind-merge | guard, utilities | yes | 9.39.4 / 4.2.2 / 3.5.0 | — |
| Playwright | optional visual diff | installed, not needed | ^1.58.2 | Manual UAT |
| Claude Design (claude.ai) | DS-03 | not testable from this session | — | Koss or controller drives it; nothing published by research |
| ui-system clone | radius/theme reference | read-only copy present | commit 0404be9 | GitHub `Loomlyne/ui-system` |

**Missing dependencies with no fallback:** none for code. Canvas work depends on Koss's Claude account.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` via `node --experimental-strip-types` (no vitest/jest) |
| Config file | none; globs in `package.json` `test:unit` (`tests/unit/*.test.ts`, `tests/unit/**/*.test.ts`) |
| Quick run command | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/design-tokens.test.ts tests/unit/clickit-tokens-rule.test.ts` |
| Full suite command | `npm run gate:local` (lint + typecheck + test:unit + guard:migrations + build); build needs placeholder public env and the shared heavy lock (see CLAUDE.local.md "Gate facts") |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DS-01 | `globals.css` holds #090909 / #ffcc00 / ink / LBC / `--radius 8px`; roles equal engine formula on `ui.config.json` | unit | `node … --test tests/unit/design-tokens.test.ts` | Wave 0 |
| DS-01 | DESIGN.md token table equals `globals.css`; no `#0a0a0a`/indigo in DESIGN.md | unit | same file | Wave 0 |
| DS-01 | Admin page token list is a subset of `globals.css` and covers every `:root` colour token | unit | same file | Wave 0 |
| DS-01 | Page renders swatches, EN + AR type, radii, Button/Input/Badge | manual UAT (needs live admin session) | numbered steps in `04-VALIDATION.md` | manual |
| DS-02 | No raw hex/rgb/bracket radius/bracket shadow/raw palette class in `src/` outside allowlist | lint | `npx eslint "src/**/*.{ts,tsx}"` exits 0 | Wave 0 (rule + config) |
| DS-02 | Rule behaves on fixtures (pass/fail list above) | unit | `node … --test tests/unit/clickit-tokens-rule.test.ts` | Wave 0 |
| DS-02 | One brand map: `@theme --color-brand-*` == `BRAND_COLOR_HEX`; no second hex map in `edit/page.tsx`, `genre-color-editor.tsx` | unit | design-tokens test | Wave 0 |
| DS-02 | `cn()` merges named utilities | unit | design-tokens test | Wave 0 |
| DS-02 | Live site unchanged except the ledger | unit table (bracket -> utility resolves to same px) + build green + controller before/after screenshots of home, show, watch, admin (one browser lane, 2 workers max) | `npm run gate:local`; screenshots manual | partly manual |
| DS-03 | Four boards exist and each group is signed | manual-only (external tool, owner signature); automated presence check: `04-GATE.md` contains four dated signature lines | `grep -c "Signed:" .planning/phases/04-design-system-truth/04-GATE.md` | Wave 0 (file) |
| DS-04 | Page file sits under `src/app/[locale]/admin/`, no top-level `design-system` route, `admin/layout.tsx` still redirects when `!user` or `admin_user_id !== user.id` | unit (static pin) | design-tokens test | Wave 0 |
| DS-04 | Signed-out and non-admin are refused; admin allowed | manual UAT (numbered: signed out opens `/en/admin/design-system` -> sent away; viewer account -> `/watch`; admin -> page) | `04-VALIDATION.md` | manual |

### Sampling Rate
- **Per task commit:** quick run command above plus `npx eslint <changed files>` (under 30 s).
- **Per wave merge:** `npm run lint && npm run typecheck && npm run test:unit`.
- **Phase gate:** `npm run gate:local` green, then PR (`pr-gate.yml` runs lint/typecheck/unit/build), then UAT and Koss's signatures.

### Wave 0 Gaps
- [ ] `eslint-rules/clickit-tokens.mjs` + `eslint.config.mjs` registration (rule starts `warn`, flips to `error` after the codemod)
- [ ] `tests/unit/design-tokens.test.ts`, `tests/unit/clickit-tokens-rule.test.ts`
- [ ] `tests/unit/helpers/ui-system-radius.ts` (vendored `buildRadius`, keep the 20 lines and a source comment with the commit `0404be9`)
- [ ] `.planning/phases/04-design-system-truth/04-GATE.md` with four signature lines
- [ ] No framework install needed

## Security Domain

`security_enforcement` is absent in config, so enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (Phase 5) | — |
| V3 Session Management | no | existing Supabase session in `proxy.ts` |
| V4 Access Control | yes | `admin/layout.tsx` guard (`app_config.admin_user_id`) wraps the new page; no new route outside `/admin` |
| V5 Input Validation | low | page takes no input; email templates later must escape user content |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Design page reachable by non-admins | Information disclosure | Place under `admin/`, never add `/design-system` top level, static pin test |
| Token page leaking data | Information disclosure | Page shows only CSS variables and sample strings; no DB reads |
| Secrets in a public repo | Information disclosure | Research and docs carry no keys; build env is placeholders only |
| Remote image in email (logo) used for tracking | Privacy | Host on the first-party media domain only (D-07) |

## Phase 6 UI-SPEC conflicts

Source: `origin/phase-06-youtube-import-player:.planning/phases/06-youtube-import-and-player/06-UI-SPEC.md` (917 lines; branch has docs only, no `src/` changes yet). Phase 4 lands first (Phase 6 depends on Phase 5, which depends on Phase 4).

| # | Spec text | Guard result | Least-disruptive resolution |
|---|-----------|--------------|------------------------------|
| 1 | Line 28 radius row: card `rounded-[12px]`, media `rounded-[11px]`, panel `rounded-[16px]` | would fail | Equal values: read as `rounded-card`, `rounded-media`, `rounded-panel`. Add a mapping note to `04-GATE.md`; Phase 6's planner applies it. Signed pictures unchanged |
| 2 | 9 uses of `rounded-[12px]` (table container 255, empty/neutral panels 290/294, error banner 306, up-next row 436/444, renumber rows 570, rows 605) | fail | `rounded-card` |
| 3 | 5 uses of `rounded-[11px]` (thumbnails 261/437/445/486) | fail | `rounded-media` |
| 4 | `rounded-[16px]` (line 28 only) | fail | `rounded-panel` |
| 5 | Line 55: existing Checkbox `size-5 rounded-[6px]` kept as is | fails on `main` code until codemod | Codemod turns it into `rounded-md` (6px): no spec change |
| 6 | `bg-black` letterbox (127), `bg-white/[0.04]`, `bg-white/[0.18]`, `border-brand-red-safe/35`, `outline-[var(--primary)]` | pass | none |
| 7 | `tracking-[…]` bracket form required for the Arabic strip rule (line 107) | not flagged (guard targets colour/radius/shadow) | none; keep |
| 8 | `text-[11px]`, `text-[20px]`, `w-[220px]`, `h-[3px]` etc. | not flagged | none |
| 9 | Spec markdown lists hex in tables (Brand colours 188-193) | not scanned (markdown) | none |

## Sources

### Primary (HIGH confidence)
- Repo files read: `src/styles/globals.css`, `admin.css`, `ui.config.json`, `DESIGN.md`, `package.json`, `eslint.config.mjs`, `src/lib/utils.ts`, `brand-colors.ts`, `admin/layout.tsx`, `src/proxy.ts`, `.github/workflows/pr-gate.yml`, `tests/unit/*`
- Tailwind 4.2.2 compile experiments (`@tailwindcss/node` `compile`) in the session scratchpad: named radius, `@theme static` shadows, inset/drop-shadow keys, `hover:bg-primary-hover`
- tailwind-merge 3.5.0 experiments: default vs `extendTailwindMerge` behaviour
- `Loomlyne/ui-system` clone (commit 0404be9): `packages/core/src/radius.ts`, `theme.ts`, `type.ts`, `packages/react/src/Root.tsx`, `docs/claude-design.md`, `design/claude-design-system/project/README.md`; `buildTheme(ui.config.json)` executed
- ESLint 9.39.4 prototype of the rule over all of `src/` and a 21-case fixture run
- Phase 6 UI-SPEC from `origin/phase-06-youtube-import-player`

### Secondary (MEDIUM confidence)
- https://www.caniemail.com/features/css-border-radius/ (Outlook for Windows: round corners need VML `roundrect`; last tested 2021)
- Claude support article on Claude Design design systems: https://support.claude.com/en/articles/14604416-get-started-with-claude-design (fonts are inherited from the organization design system; raw font upload not documented)

### Tertiary (LOW confidence)
- Email-client dark-mode summaries from vendor blogs (SendPulse, Courier, SendLayer) returned by search: color-scheme meta needed for Apple Mail; Gmail and Outlook apply their own inversion. Not verified per client.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, all versions read from `node_modules`, behaviours executed
- Architecture: HIGH for tokens/guard/page; MEDIUM for canvas (external tool, two assumptions)
- Pitfalls: HIGH for code pitfalls (reproduced); MEDIUM for email

**Research date:** 2026-10-20
**Valid until:** 2026-11-19 (stable stack); re-check Claude Design behaviour before the canvas wave since the tool changes quickly
