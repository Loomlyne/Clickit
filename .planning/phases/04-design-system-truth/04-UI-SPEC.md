---
phase: 04
slug: design-system-truth
status: approved
revision: 3
shadcn_initialized: true
preset: "shadcn new-york, baseColor neutral, cssVariables; every token overridden by UI System (ui.config.json → src/styles/globals.css, 2026-10-20)"
created: 2026-10-20
signed_source: "none yet. Basis: 04-CONTEXT.md D-01..D-08 (recommended answers, pending Koss) + live tokens in src/styles/globals.css (a8f2487 and later) + Phase 6 06-UI-SPEC.md revision 2 (signed pictures q1, q8, q9, q11, q13, q15)"
---

# Phase 4 — UI Design Contract

> Visual and interaction contract for the admin design-system page, the three token snaps, the named radius and shadow utilities, the Claude Design canvas boards and the email template. This phase writes down the look the live site already has. Every value is a live token (read from `src/styles/globals.css` and the live CSS on www.clickitstory.ae, 2026-10-20) unless a line says "changes". Where this contract picks something CONTEXT.md did not decide, it is listed in "Owner-visible deviations / open items" at the end. Nothing here reopens a decision in 04-CONTEXT.md or in the Phase 6 signed spec.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (`components.json`, style new-york, `rsc: true`, Tailwind v4, CSS variables) |
| Preset | not applicable (tokens come from UI System `ui.config.json`: primary/accent `#ffcc00`, neutral `#737373`, danger `#ff3b30`, mode dark, roundness 50, pill on, field 8) |
| Component library | Radix (`radix-ui`) via `src/components/ui/*` |
| Icon library | lucide-react (`Palette` is the only new icon, for the sidebar entry) |
| Font | LBC (local, `--font-lbc`), English and Arabic. Two files only: 400 (`lbc-regular.woff2`) and 700 (`lbc-bold.woff2`). Emails use the system sans stack (LBC cannot load in mail clients) |
| Mode | Dark only |
| Page background | `--bg-0` **#090909** (D-01; the roadmap text "#0a0a0a" is corrected) |
| Radius roles | chip 999px, control 999px, shell 999px, field 8px, card 12px, media 11px, panel 16px, base `--radius` 8px (D-02) |
| Touch target | 44px (`min-h-11` / `size-11`) for every interactive element this contract places |
| Minimum text | 11px in the app, 12px in emails. Nothing smaller in anything this phase specifies |
| Contrast | 4.5:1 for every text/background pair (computed values under Color) |

### Primitives used (all exist, none added)

`ui/button`, `ui/input`, `ui/badge`, `ui/select`, `ui/checkbox` (canvas only), `admin/admin-shell` (`AdminPageHeader`, `AdminPanel`), Sonner `Toaster` (already mounted in `src/app/[locale]/layout.tsx`). The page adds no new `ui/*` file.

### Inherited primitive typography (documented, not changed)

The live primitives carry sizes and weights older than the 4-size scale. This phase documents them and does not restyle them (D: "live site must look unchanged"). New screens override at the call site, as Phase 6 §Design System already requires.

| Primitive | Default today | Weight that actually renders in LBC |
|-----------|---------------|-------------------------------------|
| `Button` | 13.5px (`xs` 12px, `sm` 12.5px, `lg` 15px), `font-medium` (500) | 400 (500 falls back to the 400 file) |
| `Badge` | 11px `font-medium` uppercase `tracking-[0.14em]` | 400 |
| `Input` | `text-base` (16px) on phones, `text-sm` (14px) from `md` | 400 |
| `SelectTrigger` / `SelectItem` | `text-sm` (14px) | 400 |
| Sidebar group label, `AdminPageHeader` h1 | 11px / 24px `font-semibold` (600) | 700 (600 resolves to the 700 file) |

CSS font matching explains the table: LBC has no 500 or 600 file, so 500 resolves to 400 and 600 resolves to 700. The design-system page prints this note once (`renderedNote`).

---

## Spacing Scale

Declared values (multiples of 4 only). The admin shell already supplies page padding (`px-4 py-6 md:px-8 md:py-8`, max width 1180px).

| Token | Value | Tailwind | Usage on the design-system page |
|-------|-------|----------|----------------------------------|
| xs | 4px | `1` | Token name to value gap, icon to text gap in chips |
| sm | 8px | `2` | In-page nav gap, button rows, chip rows |
| sm+ | 12px | `3` | Swatch grid gap, sample card gap (one of two exceptions: 12px here, 20px for `AdminPanel` padding) |
| md | 16px | `4` | Gap between blocks inside a panel, page edge padding on phones |
| lg | 24px | `6` | Gap between a section heading and its panel |
| xl | 32px | `8` | Gap between sections (`space-y-8`) |
| 2xl | 48px | `12` | Not used on this page |
| 3xl | 64px | `16` | Swatch height (`h-16`) |

Exceptions (each justified):
- **12px (`3`)**: swatch grid and sample grids. 8px crowds the 11px value lines; 16px makes the 2-column phone grid too narrow for `--uis-primary-hover` without wrapping.
- **20px (`p-5`)**: `AdminPanel` padding, inherited unchanged from `admin-shell.tsx` (multiple of 4).
- 44px touch targets (`min-h-11`, `size-11`) for in-page nav pills, the toast button, and every live control sample.
- 2px focus ring with 2px offset (button primitive, unchanged); 3px focus ring on Input and Select trigger (primitive, unchanged).
- Fixed heights: swatch 64px, radius sample 64px, shadow sample 96px.

No half steps (`*.5`) in anything new.

---

## Typography

> Scope note: the 11/14/20/24 scale at 400/700 is the only scale for new screens. The legacy table and the email scale below are reference for existing pages and mail clients, not scales for new screens; primitive demos on the design-system page render at their own built-in sizes.

**Scale for new screens (Phases 4-7): exactly four sizes, two weights.** This is the scale Phase 6 signed.

| Role | Size | Weight | Line height | Used for |
|------|------|--------|-------------|----------|
| Label | 11px (`text-[11px]`) | 400 (700 for chips only) | 1.4 | Overlines (uppercase, `tracking-[0.14em]`), token values, table headers, hints |
| Body | 14px (`text-sm`) | 400 (700 for button labels and named rows) | 1.5 | Descriptions, token names, inputs, buttons, list rows |
| Heading | 20px (`text-[20px]`) | 700 | 1.25 | Section headings (h2), sheet and dialog titles |
| Display | 24px (`text-[24px]`) | 700 | 1.2 | Page title (h1), card titles on big cards |

Weights: 400 (`font-normal`) and 700 (`font-bold`) only. Uppercase + tracking only on 11px overline labels and column headers; use the bracket form `tracking-[0.14em]` so the global Arabic rule (`html[lang='ar'] [class*='tracking-[']`) strips it.

**Sizes that already exist on live viewer pages (documented, unchanged).** DESIGN.md's wider scale describes them; the design-system page prints them in a second table headed "Sizes already on viewer pages (unchanged)":

| Size | Where it lives today |
|------|----------------------|
| 13 / 13.5 / 12.5 / 12 / 15 | Button and label defaults, page base (`body` 15px / 1.5) |
| 16 | Phone input, body-L |
| 30 | h1 on viewer pages |
| 36+ | Hero and display titles (`clamp()`), genre tile names (28px on phones) |

Rule written into DESIGN.md (replaces "Type scale target"): "New screens use 11 / 14 / 20 / 24 at weight 400 or 700. The wider scale (13, 15, 16, 30, 36+) describes the viewer pages that exist today and is not extended."

**Design-system page type samples.** Each role row is a two-column block from `sm` (EN left, AR right in LTR; mirrored in RTL), a single column below 640px:
- Row header (11px/400 uppercase): role name, then `{size}px · {weight} · {line height}` in `dir="ltr"`.
- EN sample: `lang="en" dir="ltr"`, text `typeSampleEn`.
- AR sample: `lang="ar" dir="rtl"`, text `typeSampleAr`. Both samples render at the role's exact size/weight and use `--font-title` for Heading/Display, `--font-app` for Label/Body.
- Both weights printed for Body (400 and 700) to prove LBC has two files.
- Mixed-script rule (Phase 6 Typography) applies: token names and hex values sit in `<bdi dir="ltr">` so they never reorder inside Arabic text.

---

## Color

Tokens are CSS custom properties in `src/styles/globals.css`; the page reads them at runtime (`getComputedStyle(document.documentElement)`).

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--bg-0` #090909 | Page canvas, admin canvas, sidebar, email page |
| Secondary (30%) | `--bg-1` #101010 (cards, popovers, toasts, email card); `--bg-2` #191919 (fields, secondary and muted surfaces, email code box); `--bg-3` #2A2A2A raised; `--bg-4` #424242 strong surface and strong line | Panels, swatch captions, inputs |
| Accent (10%) | `--primary` #ffcc00, ink `--primary-foreground` #090909; hover `--uis-primary-hover` #D7AD16; soft `--uis-primary-soft` #312915; ring `--ring` rgba(255,204,0,0.5) | Reserved list below |
| Destructive | `--destructive` #ff3b30 (ink `--destructive-foreground` #fff) | Destructive Button variant sample, invalid field sample. No destructive action on any screen in this phase |
| Lines | `--line` rgba(255,255,255,0.08), `--line-2` rgba(255,255,255,0.14) | Hairline and strong borders |
| Text | `--text` #F4F4F4, `--text-dim` #CCCCCC, `--text-mute` #A1A1A1 | Primary, secondary, tertiary text |

**Accent reserved for (applies app-wide; on the design-system page nothing else is yellow except the Desert Sand brand swatch and its tint inside the brand map):**
1. The `--primary`, `--primary-foreground`, `--uis-primary-hover`, `--uis-primary-soft` and `--ring` swatches (they show the colour).
2. The real default `Button` and the real focus ring in the components section.
3. The active admin sidebar entry (`bg-[var(--uis-primary-soft)] text-[var(--primary)]`, existing, now also for "Design system").
4. Keyboard focus rings (`--primary`).
5. Landing CTA and its glow (D-03 snap, below).

**Brand map (one map, `src/lib/brand-colors.ts`; D-04).** Six CIT colours plus safe tints. Brand colours are for show identity, category ribbons and card glows only, never chrome, buttons, backgrounds or form fields. Text and icons on dark surfaces use the safe tint, never the base (base blue #2c3569 is about 1.7:1 on `--bg-0`).

| Name | CSS token | Base | Safe tint |
|------|-----------|------|-----------|
| Innovative Blue | `--color-brand-blue` | #2c3569 | #8d9cff (`-safe`) |
| Royal Purple | `--color-brand-purple` | #9f54a0 | #c592ff |
| Oasis Green | `--color-brand-green` | #50a258 | #77d586 |
| Crimson Red | `--color-brand-red` | #db3f34 | #ff8b82 |
| Sunset Orange | `--color-brand-orange` | #ea8c2e | #ffb46e |
| Desert Sand | `--color-brand-yellow` (name kept, see open item 3) | #f8c623 | #f8d86f |

Shows keep the 5-value `brand_color` enum (blue, purple, green, red, orange). Desert Sand is for genre and category defaults only. Category colours stay free content (15 live rows) and are not on the page's brand map; the page prints one line saying so (`categoryNote`).

**Status tones** (Phase 6 chip classes, reused on this page for the "matches" line and the "not found" chip): ok `border-brand-green-safe/35 bg-brand-green-safe/8 text-brand-green-safe`; bad `border-brand-red-safe/35 bg-brand-red-safe/8 text-brand-red-safe`. Every chip carries words and an icon, never colour alone.

**Allowed overlays:** `white/NN` and `black/NN` alpha utilities stay (neutral overlays, 383 uses). Raw Tailwind palette classes (`bg-red-500` …) are replaced by tokens.

### Contrast (computed, WCAG 2.x relative luminance; reused from Phase 6, same tokens)

| Pair | Ratio |
|------|-------|
| `--text` #F4F4F4 on `--bg-1` | 17.3:1 |
| `--text-dim` #CCCCCC on `--bg-1` | 11.8:1 |
| `--text-mute` #A1A1A1 on `--bg-1` | 7.4:1 (6.8:1 on `--bg-2`) |
| `--primary-foreground` #090909 on `--primary` #ffcc00 | 13.2:1 |
| brand-green-safe / red-safe / orange-safe on `--bg-1` | 10.6 / 8.4 / 10.9:1 |
| `--destructive` #ff3b30 on `--bg-1` | 5.4:1 |
| Email (two schemes) | see §5 revision 3 |

The page computes the first four rows live (pure WCAG function over the computed token values) and prints the ratio on the text swatches (`contrastLabel`). A ratio below 4.5 shows the "bad" chip.

---

## 1. Admin page `/[locale]/admin/design-system` (D-05, DS-01, DS-04)

### 1.1 Frame and access

- Route `src/app/[locale]/admin/design-system/page.tsx` inside the existing admin layout. It inherits the admin guard (`app_config.admin_user_id`; signed-out and non-admin users are redirected to `/watch`); Phase 5's `requireAdmin` + TOTP replaces the guard with no change here. The page renders only static styles and public CSS values; it reads no database row.
- Header: `AdminPageHeader` with `crumb` = overline (`eyebrow`, 11px, `--text-mute`, uppercase), title `pageTitle` (24px/700), description `pageDescription` (14px, `--text-dim`). No action buttons.
- Sidebar entry: new item in the existing **Operations** group, after Audit: icon `Palette` (`size-4`), label `admin.designSystem.navLabel`, `href: '/admin/design-system'`. Same classes as the other entries (`min-h-11 rounded-full px-3 text-[14px]`, active = `bg-[var(--uis-primary-soft)] text-[var(--primary)]`, `aria-current="page"`). The mobile menu iterates the same groups, so it appears there with the existing `min-h-11` item and active fill.
- Content: five sections in this order, each `<section id aria-labelledby>` with an `h2` (20px/700), then one or more `AdminPanel`s. Section gap 32px.
- Under the header, a **summary line** and the **in-page nav**:
  - Summary (client): `matchSummary` in the ok chip when every pinned token matches the signed value; otherwise `matchDiffer` in the bad chip, followed by a list (`text-sm`) of each differing token: `--token: live value, signed value`. Pinned set = the values the unit test pins (D-01 colours, D-02 radii, primary, fonts, brand map, shadows). Source of the signed values: one module `src/lib/design-truth.ts` shared by the page and the unit test.
  - In-page nav: `<nav aria-label={sectionNavAria}>`, row of five anchor pills `inline-flex min-h-11 items-center rounded-full border border-[var(--line)] px-4 text-sm text-[var(--text-dim)] hover:text-[var(--text)]`, `flex gap-2 overflow-x-auto scrollbar-hide` (no wrap, scrolls sideways under 640px; edge bleed `-mx-4 px-4`). Not yellow, not sticky.

### 1.2 Live reading (how swatches work)

- The values come from `getComputedStyle(document.documentElement).getPropertyValue('--token').trim()` read in a `useEffect` after mount. Custom properties that reference others (`--uis-bg: var(--bg-0)`) resolve to the final value, so aliases show their real colour.
- Server render and first client render print the token name and `…` for the value (no hydration mismatch). The summary line shows `reading` (`Loader2 size-4 animate-spin motion-reduce:animate-none` + text, `aria-live="polite"`) until the read finishes (same tick; the state is only visible on a slow device).
- Each swatch fills its box with `background: var(--token)` (the browser paints the real token); the printed value is the computed string. Hex values are printed upper-case; `rgba()` values print as the browser returns them.
- A token whose computed value is empty shows the bad chip `tokenMissing` in place of the value and counts as a difference.

### 1.3 Section: Colour (`#colour`)

One `AdminPanel` per group, group title = overline (11px). Swatch grid `grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4`.

Swatch card (`min-w-0`): box `h-16 rounded-field border border-[var(--line-2)]` filled with the token (border needed so `--bg-0` is visible on `--bg-0`); below it `mt-2` the token name (14px/400, `--text`, `<bdi dir="ltr">`, `break-all`) and `mt-1` the value (11px, `--text-mute`, `<bdi dir="ltr">`).

| Group | Tokens (in order) |
|-------|-------------------|
| Surfaces | `--bg-0`, `--bg-1`, `--bg-2`, `--bg-3`, `--bg-4` |
| Lines | `--line`, `--line-2` (box = `--bg-1` with a 1px / 1px `--line` / `--line-2` inner rule, so the alpha is visible) |
| Text | `--text`, `--text-dim`, `--text-mute` (box = `--bg-1` with "Aa" in the token at 20px/700; contrast ratio line under the value) |
| Primary | `--primary`, `--primary-foreground` (box = `--primary` with "Aa" in the ink), `--uis-primary-hover`, `--uis-primary-soft`, `--ring` |
| Danger | `--destructive`, `--destructive-foreground` (box = `--destructive` with "Aa" in the ink) |
| Brand map | 6 pairs; each pair is one card with two half-height boxes (base on top, safe tint below) and two value lines; captions use the CIT colour name (`brandBlue` …); beneath the grid `brandNote` and `categoryNote` (14px, `--text-dim`) |
| Status tints | `--color-brand-green-safe`, `--color-brand-red-safe`, `--color-brand-orange-safe` with the chip classes applied to a sample word |

Phone (375px): 2 columns, no horizontal scroll; names wrap with `break-all`.

### 1.4 Section: Type (`#type`)

- Panel 1: font facts. Lines (14px): `typeFont`, `renderedNote`. Two chips (`inline-flex rounded-full border border-[var(--line-2)] px-3 text-[11px]`): `weightRegular`, `weightBold`.
- Panel 2: "Scale for new screens" (`typeScaleNew`): four role rows (§Typography samples). Rows separated by `border-t border-[var(--line)] pt-4`.
- Panel 3: "Sizes already on viewer pages (unchanged)" (`typeScaleLegacy`): a definition list, size on the start, where-used text (14px) on the end, each row `min-h-11`. Static text; no samples (they would imply the sizes are recommended).
- Mixed-script line: one sample with an Arabic title inside English text in `<bdi>` (`mixedSample`) so the isolate rule is visible.

### 1.5 Section: Radius roles (`#radius`)

`AdminPanel` with a grid `grid grid-cols-2 gap-3 md:grid-cols-4`, seven role cards (chip, control, shell, field, card, media, panel). Card: sample box `h-16 border border-[var(--line-2)] bg-[var(--bg-2)]` using the named utility (`rounded-chip` …); under it the role name (14px/400), the utility name (11px, `dir="ltr"`), `token` line (`--uis-r-card = 12px`, from the CSS variable) and `rendered` line (the sample element's `getComputedStyle(el).borderTopLeftRadius`) with an ok chip when equal, bad chip when not. Plus one line for `--radius` (base, 8px) and the usage text (`roleUseChip` …). The pill samples are 999px: the box is wider than tall (`w-full`), so the pill shape reads.

### 1.6 Section: Surfaces and shadows (`#surfaces`)

- Panel 1: elevation. Four sample boxes `h-24 rounded-card border border-[var(--line)] bg-[var(--bg-1)]` each with one named shadow, on a `bg-[var(--bg-0)]` strip with `p-6`: `shadow-panel`, `shadow-soft`, `shadow-popover`, `shadow-modal`. Under each: name, usage text (`shadowUsePanel` …), computed `box-shadow` value (11px).
- Panel 2: a table-like list (not a `<table>`; stacked rows on phones) of the utility shadows with no box sample: `shadow-inset-hairline`, `shadow-live-dot`, `shadow-cta-glow`, `drop-shadow-splash`, each with computed value and where it is used.
- Glass: one line (`glassNote`): "Overlays use a hairline border, `backdrop-blur-xl` and the elevation above." Hairline border = `--line`.

### 1.7 Section: Components (`#components`)

All samples are the **real primitives** (no copies), inside `AdminPanel`s. Each group has an overline and, where a choice exists, an RTL-safe flex-wrap row `flex flex-wrap items-center gap-2`.

| Group | Content |
|-------|---------|
| Buttons: variants | `default`, `secondary`, `outline`, `ghost`, `destructive`, `link` at size `default`, labels `btnDefault` … `btnLink`. Under the row: `primaryHoverNote` |
| Buttons: sizes | `default` variant at `xs`, `sm`, `default`, `lg`, `icon-xs`, `icon-sm`, `icon`, `icon-lg` (icon sizes show `Palette size-4`, `aria-label` = size name). Under it: note that Phase 5-7 screens use `default`/`lg`/`icon-lg` (44px) with `text-sm font-bold` |
| Buttons: states | `default` and `outline`: rest, `disabled`, plus a text line that Tab shows the 2px `--primary` ring with 2px offset |
| Input | Empty with placeholder (`inputPlaceholder`), filled (`inputFilled`), `aria-invalid` with the message `inputInvalidMessage` below it (`mt-2 text-sm text-brand-red-safe`, `role="alert"` not used because static), disabled. Width `w-full max-w-sm`. Labels = overline above each |
| Badge | All six variants (`default`, `secondary`, `destructive`, `outline`, `ghost`, `link`), label = variant name in uppercase by the primitive |
| Select | Real `Select` + `SelectTrigger` (`w-full max-w-[16rem]`) + `SelectContent` + 3 `SelectItem`s (`selectItem1..3`). Opening it shows the D-03 popover (`#101010`) |
| Toast | `Button variant="outline"` `toastButton` → `toast(toastMessage)` from `sonner`. Shows the D-03 toast surface. Not a database write |

Phone: every row wraps; Input and Select are `w-full`; buttons keep `min-h-11`. Arabic: nothing is hand-mirrored; flex order and logical utilities do it. The Select's check indicator (`absolute right-2` in `select-item`) is not logical today; **not changed in this phase** (open item 12).

### 1.8 States

| State | Display |
|-------|---------|
| Loading / reading | Section skeletons are not used: static structure renders at once, values show `…`; summary line shows `reading` |
| All tokens match | Ok chip with `Check size-4` and `matchSummary` |
| Some differ | Bad chip with `TriangleAlert size-4` and `matchDiffer`, then the list of tokens |
| Token missing | Bad chip `tokenMissing` in the swatch value line |
| Page error | Existing `admin/error.tsx` |
| Empty | None possible (static content) |

### 1.9 Keyboard, screen reader, RTL, mobile

- Tab order: sidebar, in-page nav pills (5), components section controls in visual order. Swatches are not focusable.
- Each swatch box is `aria-hidden`; the name and value text next to it carry the information. Sample text blocks carry `lang`.
- The match chip region is `aria-live="polite"`.
- Arabic page (`/ar/admin/design-system`): the page chrome mirrors (sidebar on the start side, text start-aligned); `dir="ltr"` islands for tokens/hex/utility names; Arabic samples always `dir="rtl" lang="ar"` and English samples always `dir="ltr" lang="en"`, whatever the page locale. Only logical utilities (`ps-`, `pe-`, `ms-`, `me-`, `text-start`, `border-s`). No `left-`/`right-`/`text-left` in new code. Named exception: the password show/hide eye sits on the physical right in both languages (owner standing rule).
- 375px: no horizontal page scroll (only the in-page nav row scrolls); top bar `h-14` of the admin shell stays; swatch grid 2 columns; type rows 1 column; radius grid 2 columns; shadow samples stack 1 column.

---

## 2. The three visible token snaps (D-03)

These are the only intended visible changes in the app. Exact before and after:

| # | File | Before | After | What the viewer sees |
|---|------|--------|-------|----------------------|
| 1 | `src/components/ui/select.tsx` `SelectContent` | `rounded-[12px] border border-white/10 bg-[#11151d]/98 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl` | `rounded-card border border-white/10 bg-[var(--bg-1)]/98 shadow-popover backdrop-blur-xl` | Season dropdown menu goes from blue-black #11151d (98%) to the neutral card #101010 (98%, revision 3). Radius and shadow are identical in px |
| 2 | `src/app/[locale]/layout.tsx` Sonner `classNames.toast` | `border border-white/10 bg-[#10131a] text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.45)]` | `border border-white/10 bg-[var(--bg-1)] text-foreground shadow-popover` | Toast goes from #10131a to #101010; shadow alpha 0.45 → 0.42 (open item 1) |
| 3 | `src/components/landing/landing-hero-animations.tsx` "Browse shows" link (line 53) | `shadow-[0_16px_40px_rgba(96,115,255,0.28)] transition-colors hover:bg-[#7082ff]` | `shadow-cta-glow transition-colors hover:bg-[var(--uis-primary-hover)]` | Indigo hover and indigo glow become darker yellow #D7AD16 on hover and a soft yellow glow `0 16px 40px rgba(255,204,0,0.18)`. The glow is on at rest too (it was already on at rest in indigo) |

Select and Select-related sibling changes in the same file with no visible effect: `rounded-[8px]` on `SelectItem` → `rounded-field`; trigger `shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]` → `shadow-inset-hairline` (same value).

Other stray literals that become tokens (invisible or ≤1 step):
- `src/app/[locale]/(viewer)/layout.tsx:41` preload cover `#0a0a0a` → `var(--bg-0)` (#0a0a0a → #090909, one step of 255).
- `src/components/layout/user-avatar.tsx:25` initials ink `text-[#0a0a0a]` → `text-[var(--primary-foreground)]` (one step); gradient `from-[#c8a04a] to-[#d97757]` → `from-[var(--chart-5)] to-[var(--chart-2)]` (identical colours).
- `navbar.tsx:150,184` live dot `bg-red-500` + `shadow-[0_0_6px_rgba(239,68,68,0.9)]` → `bg-live-dot` + `shadow-live-dot` (revision 2: exact value kept; `--live-dot` holds Tailwind's `red-500` verbatim, glow unchanged; no visible change).

The design-system page is the UAT surface for snaps 1 and 2 (open the Select, press the toast button). Snap 3 is checked on `/portfolio`.

---

## 3. Named radius and shadow utilities (DS-02)

Added to `src/styles/globals.css` in `@theme inline` so each utility reads the existing variable (no value is duplicated and `bg-[var(--shadow-soft)]`-style direct uses keep working):

```css
@theme inline {
  --radius-chip: var(--uis-r-chip);       /* rounded-chip    999px */
  --radius-control: var(--uis-r-control); /* rounded-control 999px */
  --radius-shell: var(--uis-r-shell);     /* rounded-shell   999px */
  --radius-field: var(--uis-r-field);     /* rounded-field     8px */
  --radius-card: var(--uis-r-card);       /* rounded-card     12px */
  --radius-media: var(--uis-r-media);     /* rounded-media    11px */
  --radius-panel: var(--uis-r-panel);     /* rounded-panel    16px */

  --shadow-soft: var(--shadow-soft);
  --shadow-panel: var(--shadow-panel);
  --shadow-popover: var(--shadow-popover);
  --shadow-modal: var(--shadow-modal);
  --shadow-inset-hairline: var(--shadow-inset-hairline);
  --shadow-live-dot: var(--shadow-live-dot);
  --shadow-cta-glow: var(--shadow-cta-glow);
  --drop-shadow-splash: var(--drop-shadow-splash);
}
```

(If Tailwind v4 rejects a self-named `inline` reference, the executor renames the raw variables to `--elev-*` and keeps the utility names; the utility names and computed values below are the contract.)

New raw variables in `:root` (next to the existing `--shadow-soft` / `--shadow-panel`):

| Variable | Value | Source (today) |
|----------|-------|----------------|
| `--shadow-popover` | `0 24px 80px rgba(0, 0, 0, 0.42)` | `select.tsx` popover |
| `--shadow-modal` | `0 40px 120px rgba(0, 0, 0, 0.6)` | `shorts-overlay.tsx:231` |
| `--shadow-inset-hairline` | `inset 0 1px 0 rgba(255, 255, 255, 0.04)` | `select.tsx` trigger, `checkbox.tsx` |
| `--shadow-live-dot` | `0 0 6px rgba(255, 59, 48, 0.9)` | `navbar.tsx` (was red-500 rgba(239,68,68,.9)) |
| `--shadow-cta-glow` | `0 16px 40px rgba(255, 204, 0, 0.18)` | `landing-hero-animations.tsx` (was indigo .28) |
| `--drop-shadow-splash` | `0 24px 80px rgba(0, 0, 0, 0.55)` | `coming-soon-splash.tsx` (`drop-shadow` filter) |

Existing, unchanged: `--shadow-soft` = `0 24px 80px rgba(0, 0, 0, 0.38)`; `--shadow-panel` = `0 10px 32px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.05)`.

**Computed values the pin test and the page assert (= today's values):**

| Utility | Computed |
|---------|----------|
| `rounded-chip`, `rounded-control`, `rounded-shell` | 999px |
| `rounded-field` | 8px |
| `rounded-card` | 12px |
| `rounded-media` | 11px |
| `rounded-panel` | 16px |
| `shadow-soft` | `0 24px 80px rgba(0,0,0,.38)` |
| `shadow-panel` | `0 10px 32px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.05)` |
| `shadow-popover` | `0 24px 80px rgba(0,0,0,.42)` |

**Replacement map for existing bracket radii (59 uses; guard fails on `rounded-[`):**

| Bracket today | Becomes | Count | Note |
|---------------|---------|-------|------|
| `rounded-[12px]` | `rounded-card` | 37 | identical |
| `rounded-[11px]` | `rounded-media` | 6 | identical |
| `rounded-[16px]` (incl. `rounded-t-[16px]`) | `rounded-panel` / `rounded-t-panel` | few | identical |
| `rounded-[8px]` | `rounded-field` | 9 | identical |
| `rounded-[10px]` (play-overlay, shorts-overlay) | `rounded-xl` (Tailwind scale, `--radius-xl` 10px) | 2 | identical |
| `rounded-[6px]` (shorts-table thumb, checkbox) | `rounded-md` (`--radius-md` 6px) | 2 | identical |
| `rounded-[1px]` (3px support-page bars) | `rounded-hairline` (`--radius-hairline` 1px) | 2 | identical (revision 2) |

**Phase 6 compatibility.** Phase 6's signed spec writes `rounded-[12px]`, `rounded-[11px]`, `rounded-[16px]`. The named utilities resolve to the same pixels, so no signed picture changes. Phase 6 executors use the named utilities (once this phase has merged) or the guard fails the PR; the spec text is not re-signed. `text-[20px]`, `text-[11px]`, `bg-white/[0.04]`, `border-brand-red-safe/35`, `bg-black` and `{brandHex}40` (data-driven, from the brand map) are not flagged by the guard.

**What the guard flags** (so the contract and the script agree): hex literals (`#rgb`, `#rrggbb`, `#rrggbbaa`) in `src/` outside the allowlist; `rounded-[…]`, `shadow-[…]`, `drop-shadow-[…]`; raw Tailwind palette colour classes (`red-500`, `zinc-950`, …). **Allowlist:** `src/styles/globals.css`, `src/styles/admin.css`, `ui.config.json`, `src/lib/brand-colors.ts`, `src/lib/design-truth.ts`, email templates, and values read from data (category colours, show artwork). **Not flagged:** `white/NN`, `black/NN`, `var(--…)`, `bg-white`, `bg-black`. `watch-shell.tsx:270` (`shadow-[0_8px_32px_-8px_rgba(0,0,0,0.65)]`) becomes `shadow-bar` (exact; revision 2). The guard is an ESLint rule (`clickit/no-raw-design-values`), allowlist in `eslint.config.mjs`; CSS files are token sources and not linted.

---

## 4. Claude Design canvas (D-06, D-08, DS-03)

**Canvas:** new Artifact, type Design, named "Clickit Story". Installs the published "UI System" design system (claude.ai/artifact/XTKikX3yqayDRfUixvkNrS) with `UIS.Root primary="#ffcc00" accent="#ffcc00" neutral="#737373" mode="dark" roundness=50 pill field=8 surface="glass"`. LBC loaded from canvas assets (`lbc-regular.woff2` 400, `lbc-bold.woff2` 700). The existing brand-neutral UI System canvas is not edited.

**Board conventions (every board):**
- Dark only, page `#090909`. Colours, radii and shadows only from the tokens in this contract; no new colour appears on a board. Each board carries a small token legend (name and value) so the executor can map pixel to token.
- Frames: desktop **1280×800**, phone **375×812**, email **600 wide** (plus a 375 phone render). Every viewer and admin board has an English frame and an Arabic RTL frame, desktop and phone, unless the board says otherwise.
- Type only 11 / 14 / 20 / 24 at 400 or 700 (emails: system sans, below). Touch targets 44px. Focus ring shown on one control per board.
- Copy on boards is placeholder where marked; no price, legal text, expiry, sender line or rate appears except as `{placeholder}`.
- Boards marked **reproduced** copy the Phase 6 signed pictures unchanged (`06-mockups.html` #q1, #q8, #q9, #q11, #q13, #q15) and are redrawn from `06-UI-SPEC.md`; any difference from the signed picture is the one listed in Phase 6's "Differs from the signed picture".
- Koss signs four groups separately in `04-GATE.md` with the date. Group → boards below.

### Group 1 — Foundations

Focal points (one per board): V1a the email field; V1b the six code boxes; V2 the hero Play button; V3 the 16:9 player; A4 the selected message thread; design-system page the signed-value match summary.

| ID | Board | Frames | Contents (required) | Source |
|----|-------|--------|---------------------|--------|
| F0 | Cover and rules | 1280 | Canvas index, `UIS.Root` values, hard rules (dark only, LBC 400/700, 11px minimum, 44px targets), group list, sign-off boxes | new |
| F1 | Colour and brand map | 1280, 375 | Surfaces `bg-0..4`, lines, text ×3 with contrast ratios, primary set, danger, six brand colours with safe tints (base never used for text), status tones, accent reserved-for list, "category colours are content" note | live tokens |
| F2 | Type, English and Arabic | 1280, 375 | LBC 400 and 700 specimen; the 11/14/20/24 scale with line heights; wider legacy sizes labelled "viewer pages today"; EN and AR samples side by side; mixed-script `bdi` example; digit note (Phase 7 owns Arabic-Indic digits) | live + Phase 6 |
| F3 | Radius and surfaces | 1280, 375 | Seven radius roles with utility names and px; elevation `panel/soft/popover/modal`; glass overlay; hairline `--line` | live tokens |
| F4 | Components | 1280, 375 (EN and AR) | Button variants ×6, sizes, rest/hover/focus/disabled; default hover shown as white (live) and the landing CTA hover #D7AD16; Input rest/filled/invalid/disabled; Badge ×6; Select closed and open; Checkbox; Tabs/season pill; status chips (ok/bad/warn/neutral); toast | live primitives |
| F5 | Spacing, focus, motion | 1280 | 4/8/12/16/20/24/32/48/64 scale with the 12 and 20 exceptions; 44px target diagram; focus ring (2px `--primary`, 2px offset); motion 120–260ms `--ease`, reduced-motion behaviour | live + DESIGN.md |

### Group 2 — Viewer

| ID | Board | Frames | Contents (required states) | Source |
|----|-------|--------|----------------------------|--------|
| V1 | Email-code sign-in | 1280, 375, EN + AR | (a) Enter email (single field, `Continue with email` primary, "Use a password instead" link); (b) Enter 6-digit code: six boxes `h-11` (44px) in `dir="ltr"`, 8px gaps (50px each at 375), paste/auto-fill note, **Arabic-Indic digits ٠–٩ typed are shown as typed and accepted**; (c) wrong code error (`role="alert"`, brand-red-safe text, field `aria-invalid`); (d) resend with a disabled-until `{seconds}` countdown; (e) expired code; (f) password alternative with the right-side show/hide eye; (g) success (brief check, then the app). A never-seen email lands in the same flow (account is created) | new, needs signature |
| V2 | Home and show | 1280, 375 | The current live home (hero bottom-left, rails, category pills with free colours) and the show page, redrawn as shipped, not redesigned | live pages |
| V3 | Watch page (YouTube rules) | 1280, 375, EN | **Reproduced** from Phase 6 §3: top bar, 16:9 stage with black letterbox, control bar, episode rail (desktop) / list (phone). Annotated proof that **nothing is drawn over any pixel of the iframe**: no overlay, gradient, toast, tooltip, ring or loading tint. Player box never below 200×200. Up-next card wide + narrow (#q9), series-end variant, error card wide + narrow (#q11) with the error table copy | signed (#q8, #q9, #q11) |
| V4 | Arabic right-to-left | 1280, 375 | Home hero anchored bottom-right, rail scrolling from the right, watch page mirrored (Back at the right, Previous at the right edge, chevrons rotated), sign-in with the code boxes staying left-to-right inside an RTL page, `bdi` isolation of show titles | new, needs signature |

### Group 3 — Admin

| ID | Board | Frames | Contents (required states) | Source |
|----|-------|--------|----------------------------|--------|
| A1 | Playlist import preview | 1280 (sheet 640), 375, EN + AR | **Reproduced** from Phase 6 §1 (#q1): empty, reading (skeletons), loaded table with chips (Ready, Private, Removed, Not embeddable, Blocked in UAE, Not ready, Already on Clickit), nothing new, error banner, importing, success with "Schedule these N episodes". Sheet opens from the start side flipped for Arabic | signed (#q1) |
| A2 | Episodes order and flags | 1280, 375 | **Reproduced** from Phase 6 §5 (#q13): up/down arrows, renumber 1 to N, "Can't play" badge, "Needs English title" mark | signed (#q13) |
| A3 | Key status | 1280, 375 | **Reproduced** from Phase 6 §6 (#q15): read-only key status states | signed (#q15) |
| A4 | Inbox | 1280, 375, EN + AR | Message list (unread dot is `--primary`, not red), message detail with the viewer's email and a **reply** composer (admin copy of a support auto-reply, per roadmap), empty inbox, loading, send failed (banner with next step), sent. Shell = admin sidebar (with the "Design system" entry) at 1280, `h-14` top bar at 375 | new, needs signature |

### Group 4 — Email

Contract in §5 (revision 3). One board per template, each reproduced from Phase 5's signed email picture with a LIGHT and a DARK (prefers-color-scheme) frame, EN and AR (RTL). If Phase 5's picture is not signed yet, this group waits.

| ID | Board | Notes |
|----|-------|-------|
| E0 | Template shell | The one shell every email uses: header logo, card, footer; dark-mode/images-off render |
| E1 | Sign-in code | OTP with the 6-digit code block; also the Supabase "Magic Link" template shape (button + code) |
| E2 | Confirm signup | One primary button, plain-link fallback |
| E3 | Reset password | One primary button, "ignore if you did not ask" line |
| E4 | Email change | Confirm new address; names both addresses as placeholders |
| E5 | Welcome | Sent once to a new viewer; one primary button |
| E6 | New-episodes digest | Up to three show rows with thumbnail, title, season/episode, per-row "Watch episode" link; footer with one-click unsubscribe and a manage link |
| E7 | Support auto-reply | Acknowledgement to the sender with their message quoted; an admin-copy variant that adds a reply-to note |

### Sign-off hand-off

`04-GATE.md` lists the four groups with date and "signed / not signed". A later phase may code a screen once its group is signed: Phase 5 needs Foundations + Viewer (V1, V4) + Email; Phase 6 needs Foundations + Admin (A1–A3) + Viewer (V3); Phase 7 needs Foundations + Viewer + Admin (A4).

---

## 5. Email template contract (revision 3: Q7 answered C)

**Koss answered Q7 = C (2026-10-20, via the controller; = Phase 5 Q12):** emails follow the reader's system colour scheme: **LIGHT by default**, **DARK via `@media (prefers-color-scheme: dark)`**. Phase 5 owns the templates, their copy and their signed picture (`origin/claude/phase-05-accounts-and-email-61ece8:.planning/phases/05-accounts-and-email/mockups/05-mockups.html`, `.m-light` / `.m-dark`). The earlier dark-only contract is withdrawn.

**What Phase 4 supplies:** email-safe tokens for both schemes as literal hex (mail clients cannot read CSS variables or blend rgba) in one module `src/lib/email-tokens.ts` (`EMAIL_TOKENS`, allowlisted in the lint rule, pinned by `tests/unit/email-tokens.test.ts`), and the DESIGN.md email section. Phase 5 may refine values when it signs its picture; changes go through that module and its test.

| Token | Light | Dark |
|-------|-------|------|
| Page / body | body `#ffffff` | page and body `#090909` |
| Header | `#090909`, logo and header text `#F4F4F4` | `#090909` with header divider `#1d1d1d` (solid of rgba(255,255,255,.08) over #090909) |
| Heading | `#111111` | `#F4F4F4` |
| Text | `#333333` | `#CCCCCC` |
| Code box | bg `#f6f6f6`, border `#e5e5e5`, text `#090909` | bg `#191919`, border `#2A2A2A`, text `#ffcc00` |
| Button | `#ffcc00`, ink `#090909`, radius 999px | same |
| Footer text | `#777777` | `#A1A1A1` |
| Divider | `#eeeeee` | `#1d1d1d` |

Contrast (computed): light heading 18.9:1, text 12.6:1, button ink 13.2:1, **footer #777777 on #ffffff 4.48:1 (just under 4.5:1; flagged for Phase 5)**; dark heading 18.1:1, text 12.4:1, footer 7.7:1, code text #ffcc00 on #191919 11.6:1.

**Rules kept from the earlier contract:** table-based, inline styles; system sans stack (LBC cannot load in mail); logo hosted on `media.clickitstory.ae`; one primary action per email; plain-URL fallback under the button; no web fonts, no tracking pixels; sender line, expiry, legal footer and Arabic copy are Phase 5 / Koss placeholders.

**Canvas (Group 4):** the Email boards reproduce Phase 5's signed picture in both schemes (not a redesign). If that picture is not yet signed, the Email group waits.

---

## Copywriting Contract

### Design-system page (`src/messages/{en,ar}.json`, namespace `admin.designSystem.*`)

This page is read-only: it has no primary CTA, no destructive action, and no empty state (its content is static). Its one live control is the sample-toast button.

| Element | Copy (EN / AR) |
|---------|----------------|
| Primary CTA | none (read-only page). Only control: `toastButton` "Show a sample toast" / "عرض إشعار تجريبي" |
| Empty state heading / body | not applicable (static content) |
| Error state | token missing: `tokenMissing` "Not found in the live styles. Check src/styles/globals.css" / "غير موجود في الأنماط الحالية. راجع src/styles/globals.css". Page failure uses the existing admin error page |
| Destructive confirmation | none in this phase |

| Key | EN | AR |
|-----|----|----|
| `navLabel` | Design system | نظام التصميم |
| `eyebrow` | Admin · read only | الإدارة · للعرض فقط |
| `pageTitle` | Design system | نظام التصميم |
| `pageDescription` | The live look of Clickit Story, read from the running styles. Nothing here can be edited. | المظهر الحالي لـ Clickit Story كما يُقرأ من الأنماط الفعلية. لا يمكن تعديل أي شيء هنا. |
| `sectionNavAria` | Sections | الأقسام |
| `sectionColour` | Colour | الألوان |
| `sectionType` | Type | الخطوط |
| `sectionRadius` | Radius roles | أدوار الزوايا |
| `sectionSurfaces` | Surfaces and shadows | الأسطح والظلال |
| `sectionComponents` | Components | المكوّنات |
| `reading` | Reading the live styles… | جارٍ قراءة الأنماط الحالية… |
| `matchSummary` | `{count, plural, one {# token matches the signed value} other {# tokens match the signed values}}` | `{count, plural, zero {لا يوجد رمز يطابق القيمة المعتمدة} one {رمز واحد يطابق القيمة المعتمدة} two {رمزان يطابقان القيمة المعتمدة} few {# رموز تطابق القيمة المعتمدة} many {# رمزًا تطابق القيمة المعتمدة} other {# رمز يطابق القيمة المعتمدة}}` |
| `matchDiffer` | `{count, plural, one {# token differs from the signed value} other {# tokens differ from the signed values}}` | `{count, plural, zero {لا يوجد رمز يختلف عن القيمة المعتمدة} one {رمز واحد يختلف عن القيمة المعتمدة} two {رمزان يختلفان عن القيمة المعتمدة} few {# رموز تختلف عن القيمة المعتمدة} many {# رمزًا تختلف عن القيمة المعتمدة} other {# رمز يختلف عن القيمة المعتمدة}}` |
| `tokenMissing` | Not found in the live styles. Check src/styles/globals.css | غير موجود في الأنماط الحالية. راجع src/styles/globals.css |
| `groupSurfaces` / `groupLines` / `groupText` | Surfaces / Lines / Text | الأسطح / الحدود / النص |
| `groupPrimary` / `groupDanger` / `groupBrand` / `groupStatus` | Primary / Danger / Brand map / Status tints | الأساسي / الخطر / خريطة ألوان العلامة / ألوان الحالة |
| `brandBlue` … `brandSand` | Innovative Blue, Royal Purple, Oasis Green, Crimson Red, Sunset Orange, Desert Sand | الأزرق المبتكر، البنفسجي الملكي، أخضر الواحة، الأحمر القرمزي، البرتقالي الغروبي، رمل الصحراء |
| `safeTint` / `baseColour` | Safe tint / Base | الدرجة الآمنة / الأساسي |
| `contrastLabel` | `{ratio}:1 on card` | `{ratio}:1 على البطاقة` |
| `brandNote` | Brand colours identify shows, category ribbons and card glows. They are never used for buttons, layout or form fields. | ألوان العلامة تُميّز البرامج وشرائط التصنيفات وتوهّج البطاقات. لا تُستخدم للأزرار أو التخطيط أو حقول النماذج. |
| `categoryNote` | Category colours are chosen by the admins and are not part of this map. | ألوان التصنيفات يختارها المشرفون وليست جزءًا من هذه الخريطة. |
| `typeFont` | LBC for English and Arabic. Two weights: 400 and 700. | خط LBC للإنجليزية والعربية. وزنان فقط: 400 و700. |
| `renderedNote` | Buttons, badges and inputs ask for weight 500 or 600. LBC has no such file, so they show as 400 or 700. | الأزرار والشارات والحقول تطلب الوزن 500 أو 600. خط LBC لا يملك هذين الملفين، فتظهر بالوزن 400 أو 700. |
| `weightRegular` / `weightBold` | Regular 400 / Bold 700 | عادي 400 / عريض 700 |
| `typeScaleNew` | Scale for new screens | المقاييس للشاشات الجديدة |
| `typeScaleLegacy` | Sizes already on viewer pages (unchanged) | أحجام موجودة في صفحات المشاهدين (دون تغيير) |
| `roleLabel` / `roleBody` / `roleHeading` / `roleDisplay` | Label / Body / Heading / Display | تسمية / نص / عنوان / عرض |
| `typeSampleEn` | Sample text in LBC. | Sample text in LBC. |
| `typeSampleAr` | نص تجريبي بخط LBC. | نص تجريبي بخط LBC. |
| `mixedSample` | `Back to <bdi>{title}</bdi>` (title = "الحلقة الأولى") | `العودة إلى <bdi>{title}</bdi>` |
| `tokenCol` / `renderedCol` | Token / Rendered | الرمز / الناتج |
| `roleChip` … `rolePanel` | Chip, Control, Shell, Field, Card, Media, Panel | شريحة، عنصر تحكم، هيكل، حقل، بطاقة، وسائط، لوحة |
| `roleUseChip` … `roleUsePanel` | Chips and badges / Buttons and controls / Navigation shells / Inputs and selects / Cards and panels / Thumbnails and artwork / Sheets and dialogs | الشرائح والشارات / الأزرار وعناصر التحكم / هياكل التنقل / الحقول وقوائم الاختيار / البطاقات واللوحات / الصور المصغّرة والأعمال الفنية / اللوحات الجانبية والحوارات |
| `shadowUsePanel` / `shadowUseSoft` / `shadowUsePopover` / `shadowUseModal` | Panels / Menus on pages / Select menus and toasts / Full-screen overlays | اللوحات / القوائم داخل الصفحات / قوائم الاختيار والإشعارات / الطبقات الكاملة |
| `glassNote` | Overlays use a hairline border, a blur and the elevation above. | الطبقات العائمة تستخدم حدًا رفيعًا وتمويهًا والظل أعلاه. |
| `btnDefault` / `btnSecondary` / `btnOutline` / `btnGhost` / `btnDestructive` / `btnLink` | Default / Secondary / Outline / Ghost / Destructive / Link | افتراضي / ثانوي / محدد / شفاف / خطر / رابط |
| `primaryHoverNote` | The default button turns white on hover. The landing "Browse shows" link turns darker yellow. Both are live today. | الزر الافتراضي يتحوّل إلى الأبيض عند التمرير، بينما رابط «تصفح البرامج» في الصفحة الرئيسية يتحوّل إلى أصفر أغمق. كلاهما قائم حاليًا. |
| `buttonSizesNote` | New screens use the 44px sizes with 14px bold labels. | الشاشات الجديدة تستخدم الأحجام ذات الارتفاع 44 بكسل مع خط عريض 14 بكسل. |
| `focusNote` | Press Tab to see the focus ring. | اضغط Tab لرؤية حلقة التركيز. |
| `inputPlaceholder` / `inputFilled` | Type here / Filled field | اكتب هنا / حقل معبأ |
| `inputInvalidMessage` | This email address is not valid. Check it and try again. | عنوان البريد الإلكتروني هذا غير صالح. راجعه وحاول مرة أخرى. |
| `selectItem` | `Season {n, number}` | `الموسم {n, number}` |
| `toastButton` | Show a sample toast | عرض إشعار تجريبي |
| `toastMessage` | This is a sample toast. | هذا إشعار تجريبي. |

### Emails (placeholder; see §5 table)

Primary CTA per email: E1 "Open Clickit Story", E2 "Confirm email", E3 "Choose a new password", E4 "Confirm new email", E5 "Start watching", E6 per-row "Watch episode", E7 none. Empty and error states: not applicable. Destructive confirmation: none. Sender line, expiry, legal footer and unsubscribe wording come from Phase 5 and Koss.

### Canvas boards (placeholder)

V1: "Continue with email", "Use a password instead", "Enter the 6-digit code", "That code is not right. Check it and try again.", "Send a new code in {seconds}s", "This code has expired. Send a new one." Admin A4: "Send reply", "No messages yet. New messages from viewers appear here.", "Your reply could not be sent. Check your connection and try again." All placeholder; Phase 5 and 7 write the final strings.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none added; uses existing `button`, `input`, `badge`, `select`, `checkbox` | not required |
| @react-bits (declared in `components.json`) | none | Nothing may be pulled from `@react-bits` or any other third-party registry in this phase. A plan or executor step that runs `npx shadcn add @react-bits/…` violates this contract. Any future block from it needs a `shadcn view` and diff record in this table first |

---

## Planner notes (not owner-visible)

1. Files: `src/app/[locale]/admin/design-system/page.tsx` (server, `AdminPageHeader` + view), `src/components/admin/design-system/design-system-view.tsx` (client; `useEffect` reads CSS variables), `src/lib/design-truth.ts` (signed values, shared with `src/lib/__tests__/design-truth.test.ts`), `admin-header.tsx` (one nav item, `useTranslations('admin.designSystem')` for the label), `src/messages/{en,ar}.json`.
2. `@theme inline` self-referencing names (`--shadow-soft: var(--shadow-soft)`): if the build rejects them, rename the raw variables to `--elev-*` and update the two existing `shadow-[var(--shadow-soft)]` / `shadow-[var(--shadow-panel)]` uses; do not change values.
3. The computed-radius check on the page measures a real element per role; do not read `--uis-r-*` twice and call it a match.
4. Admin layout guard runs in the layout; the page contains only public CSS values, so a parallel page render leaks nothing. Phase 5's `requireAdmin` replaces the guard.
5. Unit test pins (D-01/D-02/primary/fonts/brand/shadows) and the design page both import `design-truth.ts`; the radius re-derivation test is separate (vendored `radius.ts` formula).
6. Guard script must read `ui.config.json` allowlist from a file, not from inline regex exceptions.
7. DESIGN.md edits: replace "Type scale target" line (see Typography), add the radius-role utility names, shadow names, email tokens (§5), YouTube-rules player chrome (Phase 6 §3.1 sentence), RTL rules, and the `/admin/design-system` pointer. `#0a0a0a` appears nowhere.
8. DS-01 and DS-04 wording in REQUIREMENTS.md: `/design-system` → `/admin/design-system`, `#0a0a0a` → `#090909` (D-01, D-05).

---

## Owner-visible deviations / open items

Choices CONTEXT.md did not settle, picked to keep the live look and Phase 6 compatibility. Each is reversible before the canvas is signed.

1. **No `--shadow-popover` exists today.** CONTEXT lists it as "mapped to existing tokens". It is a new variable with the select popover's value (`0 24px 80px rgba(0,0,0,0.42)`). The Sonner toast used alpha 0.45; it moves to 0.42 (3 hundredths, not visible).
2. **More shadow tokens than CONTEXT named**, so the bracket-shadow guard can pass: `shadow-modal` (shorts overlay), `shadow-inset-hairline` (select trigger, checkbox), `shadow-live-dot`, `shadow-cta-glow`, `drop-shadow-splash`, and `shadow-bar` for `watch-shell.tsx:270` (revision 2: a token with the exact value instead of an allowlist entry; Phase 6 may delete it with the strip). All live in `@theme static` (not the self-referencing `@theme inline` form in §3).
3. **Desert Sand token keeps its code name `--color-brand-yellow`** (4 live uses: support page bars, star ratings). CONTEXT says `brand-sand`. Renaming is invisible but touches those files; the page and canvas call it "Desert Sand". Say the word to rename.
4. **Landing CTA glow is visible at rest, not only on hover**, as it is today in indigo (live CSS carries `#6073ff47`). After the snap it is a soft yellow glow `rgba(255,204,0,0.18)`, weaker than the indigo 0.28. Two primary hovers coexist and both are live: `Button` default turns white; the landing link turns #D7AD16. Not unified here (that would change every button).
5. **Two type tiers.** New screens use 11/14/20/24. The wider sizes (13, 13.5, 15, 16, 30, 36+) stay documented as "already on viewer pages" and are not extended. DESIGN.md's "Type scale target" line is replaced. Legacy classes in `globals.css` still below the 11px minimum (`.yt-side-now` 9px, `.yt-side-runtime` and `.yt-side-num` 10px, weights 500/600) belong to the old watch sidebar that Phase 6 replaces; the token guard does not check font sizes, so they remain until then.
6. **Primitives still request weights 500/600** (`Button`, `Badge`, `Input` file label). They render as 400/700 because LBC has two files. Documented on the page, not changed.
7. **Bracket radii outside the five roles:** 10px → `rounded-xl` and 6px → `rounded-md` are identical in px; the two `rounded-[1px]` bars on the support page become `rounded-hairline` (1px, identical; revision 2).
8. **Small colour steps:** avatar initials ink and the preload cover `#0a0a0a` → #090909 (one step of 255, D-01). The navbar live dot keeps its exact red via `bg-live-dot` and its glow via `shadow-live-dot` (revision 2); `rgba(10,10,10,…)`, `rgba(8,8,12,…)` and `rgba(4,6,10,…)` keep exact values via `--ink-*-rgb` tokens.
9. **Page uses a client component.** Swatch values appear after hydration (a single frame; "Reading the live styles…" is only seen on a slow device).
10. **"Show a sample toast" button on a read-only page.** It writes nothing; it exists so snap 2 can be seen without causing a real toast elsewhere. Remove it if a button on a read-only page is unwanted.
11. **Code input and email digits.** The 6 code boxes stay left-to-right inside Arabic pages (digits read left to right) and emails show Western digits; the app accepts Arabic-Indic digits when typed. Phase 7 (AR-01..03) still owns the digit system for the rest of the UI.
12. **`select-item` check indicator uses `right-2`** (not logical) and is not changed here (invisible bug in Arabic: indicator on the wrong side). Phase 7 RTL pass owns it.
13. **Email look answered (revision 3):** Q7 = C (Koss, 2026-10-20): light by default, dark via prefers-color-scheme; Phase 5 owns the picture; Phase 4 supplies `src/lib/email-tokens.ts`. Light footer #777777 is 4.48:1 on white (flagged for Phase 5).
14. **Email legal footer, expiry, sender line, Arabic text** are placeholders; nothing is invented. `Clickit Story <no-reply@clickitstory.ae>` is the roadmap's sender and is not drawn on boards.
15. **Canvas boards that are new design** (no signed picture): F0–F5, V1, V4, A4, E0–E7. V2 redraws the live pages as shipped. V3, A1–A3 are Phase 6's signed pictures, unchanged.
16. **Phase 6 spec is not edited.** It keeps `rounded-[12px]` etc.; the executor writes the named utilities (same pixels). If Phase 6 merges first, its bracket classes are converted in this phase's token clean-up.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: FLAG → fixed (CTA labels, tokenMissing next step)
- [x] Dimension 2 Visuals: FLAG → fixed (focal points; eye exception in §1.9)
- [x] Dimension 3 Color: FLAG → fixed (reserved list app-wide, brand-map exception, 1.7:1)
- [x] Dimension 4 Typography: FLAG → fixed (scope note: legacy/email tables are reference)
- [x] Dimension 5 Spacing: FLAG → fixed (two named exceptions)
- [x] Dimension 6 Registry Safety: FLAG → fixed (@react-bits needs view + diff first)

**Approval:** approved by gsd-ui-checker 2026-10-20 (contract only; not Koss's signature — he signs the four groups in 04-GATE.md)
