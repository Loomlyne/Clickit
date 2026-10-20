# Hand-over: design(b4) admin UI System pass

- Branch: `claude/design-b4-admin-be0a4c` (from `phase-01.1-admin-actions-hardening-inserted`, `origin/main` 22e49dd merged)
- Base for the PR: **the Phase 1.1 branch**, not `main`. Retarget to `main` when 1.1 lands.
- Signed picture: `.planning/design/b4-admin-before-after.html` (Koss: "B4 signed, go code it": sidebar on desktop, 36px visible controls with 44px hit area, 44px on phone).
- Audit (before state): `.planning/design/b4-admin-audit.md`

## What changed (visual only)

- New `src/styles/admin.css`, loaded from `admin/layout.tsx`, scoped to `body:has(.admin-root)` so portalled drawers and dialogs are covered. Overrides button sizes/variants, checkbox, table, select, textarea, tabs. Shared `src/components/ui/*` are NOT edited.
- `admin-shell.tsx`: panel/table-shell classes (12px card radius), `AdminPageHeader`, `AdminBackLink`, `AdminMetricStrip`.
- `admin-header.tsx`: fixed left sidebar on lg+ (grouped nav + icons, profile at foot), sticky 56px top bar with menu below lg.
- All 12 admin pages plus ~46 admin components moved to UI System tokens (`--bg-*`, `--line`, `--text*`, `--primary`, brand-*-safe tints); nothing under 11px.
- `actions.ts` and every server action: untouched.

## Gates (run under `/Users/koss/.clickit-heavy.lock`, detached)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | 0 errors, 19 warnings (all pre-existing kinds) |
| `npm run test:unit` | 369 pass, 0 fail |
| `npm run build` | exit 0, **with placeholder env** (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, fake anon/service keys). Without any Supabase env the build stops at "Collecting page data" (`supabaseUrl is required`), same as on `main` and any branch. No secret used, live DB not contacted. |

Log files: `/Users/koss/.clickit-logs/b4-gate.log`, `b4-build.log`, `b4-tsc.log`.

## Review fixes (local `reviewer` agent, Opus; verdict of record is the controller's)

Fixed in the follow-up commit: focus ring restored on checkbox and select trigger (admin.css used to blank the box-shadow), ghost/outline overrides no longer beat per-button colour/hover classes (red delete hover, featured star, show-form pickers), header row no longer lights on hover, nested `<main>` removed, `<a><button>` replaced by `Button asChild`, cast editor controls use logical `end-*`, hero URL inputs get a visible focus ring.
Gate re-run: tsc 0, lint 0 errors/19 warnings, unit 369/369, build exit 0 (placeholder public env).
Behaviour-adjacent layout changes to know about: Add short stays visible during selection; Create show moved to the page header; row delete buttons are now destructive-variant with an aria-label; inbox section headings and show-form section headings changed level (h2); archive `adminConsole` eyebrow dropped; `getBrandAccent` fallback `#6073FF` -> `#A1A1A1`.
Not from this PR: `admin.seasonForm.addSeason` i18n key missing in en and ar (season-tabs.tsx:94).

## After merging main cfbc8fb (#18, #20, #21)

- Clean merge, no conflicts. #21 made `ui/checkbox` 20px by default and `ui/tabs` triggers `min-h-11`; admin keeps its signed rule (checkbox 20px visible + 44px hit area; tabs 36px visible + 44px hit area), so `admin.css` is still the single place for it. `ui/button.tsx` unchanged.
- Hit areas must not overlap: a 36px control with a 4px-inset hit area needs 8px between neighbours. Row action groups (shows, shorts, episodes, categories, FAQ, legal) moved from `gap-1` to `gap-2`; genre colour swatches 32 -> 36px with `gap-2` and a hit area; "Default" swatch reset and the hero-media mode toggle got 36px height and a vertical-only hit area.
- Gate re-run after merge: tsc 0, lint 0 errors/17 warnings, unit 377/377, build exit 0 (placeholder public env).

## Second review round (local `reviewer`, Opus) - fixed

Hero URL inputs now have a real focus ring (the earlier claim was wrong until this commit); phone targets raised to 44px (tabs, profile link, secret-field replace and eye, hero overlay buttons, which also show on focus-within); footer icon button no longer clips its hit area; season tabs wrap with `gap-2` so hit areas do not overlap; cast clear button moved off the avatar and the delete button has an aria-label; Unschedule keeps its hover colour; remaining `<a><button>` pairs in shows-table use `Button asChild`; RTL: `text-end`, `me-*`, `start-*`, `end-*`, `border-s`.
Gate re-run: tsc 0, lint 0 errors/17 warnings, unit 377/377, build exit 0 (placeholder public env).
Left alone: `src/lib/category-chip.ts` is now unused (delete in a cleanup); switch knobs keep `left-0.5` (pre-existing).

## Third review round (local `reviewer`, Opus) - fixed

Phone/tablet top bar is `fixed` again (sticky never engaged because `html, body` carry `overflow-x: hidden`; content gets `max-lg:pt-14`); the show-form Save bar is a plain row (its sticky never worked either). Table cells keep their own `py-*`/`text-xs` classes (admin.css guards), reviews table shows the review text under the user on phones, cast editor buttons and Branding mode toggles and drawer footer buttons have the 44px target, upload zones and the episode fetch button have a hover that shows. Gate re-run: tsc 0, lint 0 errors/17 warnings, unit 377/377, build exit 0.
Open, not done: audit details and inbox email columns are still hidden on phones; expired shorts rows use `opacity-60` (contrast); 36px-visible controls stay 36px (44px tap area) on phones in a few raw buttons; two icon-only buttons without a name (`artwork-upload-zone.tsx:133`, `shorts-table.tsx:424`); switch knobs use physical `left-0.5`; audit badge colours repeat; `:has()` needs Firefox 121+.

## Visual check on the real components (2026-10-20)

A throwaway page (not committed) rendered the real `AdminHeader`, `ShowsTable`, `ReviewsTable` and the shared Button/Checkbox/Tabs/Select/Textarea with mock props under `next dev`, placeholder env, no database. Measured in the browser at 1280 and 375, plus `/ar`:
- Found and fixed: every Tooltip-wrapped row action (move, feature, edit, archive) rendered 32px, because Radix overwrites `data-slot="button"` with `tooltip-trigger`. `admin.css` button rules now match the trigger slots too. After the fix: 36px visible with a 44px hit area on desktop, 44px on phone, no overlapping hit areas anywhere in the shows and reviews tables.
- Found and fixed: the table-cell guard (`py-*`) matched the shared default `py-4`, so rows were 69px; now 57px (10px cell padding) and only `py-8/10/12`, `pt-*`, `pb-*` cells keep their own padding.
- Confirmed: checkbox focus ring (yellow, 3px) with a real Tab key; header 40px at 11px; cell text 14px; the phone top bar stays at the top after scrolling; no horizontal page overflow at 375; sidebar mirrors to the right in `/ar` and tables mirror.
- Gate after this: tsc 0, lint 0 errors/17 warnings, unit 377/377, build exit 0.

## NOT verified

- No render of the real admin app with real data and a signed-in session (the check above used mock props on the real components; the other admin pages - settings, categories, episode drawer, inbox - were not rendered) (no local Supabase). `admin.css` selectors (`data-slot`, `data-size`, `data-state`) were checked by reading the shared components, not by looking at the running page. The picture used the same Tailwind classes but not `admin.css`.
- Unit tests do not cover visual changes.
- RTL (Arabic) layout of the sidebar (`start-0`, `border-e`, `lg:ps-60`) not looked at.
- Hit areas (44px) measured by CSS, not with a pointer.
- Shorts inline ExternalLink icon is still 12px (shared icon, not changed).

## Follow-ups for the controller

- `admin.css` blocks are removable once the shared button, checkbox, table, select and badge get the same fix (audit lists them).

## UAT (Koss, signed-in admin, local or preview with real data)

1. Open `/en/admin` at 1280px wide. Expect: left sidebar in three groups (Shows, Categories, Shorts / Reviews, Inbox / Archive, Settings, Audit), active item in yellow on dark tint, page title "Shows" with a Create Show button on the right, metric strip, table with 40px header and ~52px rows.
2. Resize to 375px. Expect: sidebar gone, 56px top bar with a menu button (44px); table scrolls inside its panel; buttons 44px tall.
3. Click each sidebar item. Expect: each page loads, same data as before, header block in the same place (title left, action right).
4. On Shows, type in the search box and pick a status. Expect: filter works and the result count updates.
5. Open a show, click Edit. Expect: form sections in cards, Save works exactly as before (toast, redirect).
6. Open a season/episode drawer (add episode). Expect: drawer fields 8px radius, Save and Cancel visible, no clipped text.
7. Tab through a table row with the keyboard. Expect: visible focus ring on every control.
8. Switch the language to Arabic (`/ar/admin`). Expect: sidebar on the right side, text right-aligned, nothing overlapping.
9. Settings: switch between tabs. Expect: active tab is a yellow pill, all tabs save as before.
10. Inbox: open a message. Expect: back link top-left (44px target), message card, recipients form unchanged.
