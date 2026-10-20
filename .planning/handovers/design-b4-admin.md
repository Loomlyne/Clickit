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

## NOT verified

- No render of the real admin app (no local Supabase, no admin session). `admin.css` selectors (`data-slot`, `data-size`, `data-state`) were checked by reading the shared components, not by looking at the running page. The picture used the same Tailwind classes but not `admin.css`.
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
