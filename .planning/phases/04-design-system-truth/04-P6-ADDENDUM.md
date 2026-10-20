# Phase 4 addendum for Phase 6 (class mapping, identical values)

For the Phase 6 planner and executor. Phase 4 lands first (Phase 6 depends on Phase 5, which depends on Phase 4). After Phase 4, `npm run lint` fails on bracket radii, bracket shadows and raw hex in `src/` (`clickit/no-raw-design-values`, at error level from plan 04-13), so Phase 6 code must use the names below. Every value is identical to the one it replaces, so the signed Phase 6 pictures do not change.

Pinned Phase 6 tip: `ffb531a` (`origin/phase-06-youtube-import-player`, fetched 2026-10-20). The first pin was `cfa99df`; the `06-UI-SPEC.md` line numbers below are the same at both tips. Phase 6 source files have changed since `cfa99df`, so the file lines below are the `ffb531a` ones. Re-check before use:

```
git show origin/phase-06-youtube-import-player:.planning/phases/06-youtube-import-and-player/06-UI-SPEC.md | grep -n 'rounded-\['
git grep -nE 'rounded-(t-|b-)?\[|shadow-\[|brand-(green|orange|red)-safe' origin/phase-06-youtube-import-player -- src
```

## Radius (identical px)

| Phase 6 class | Use instead | px | `06-UI-SPEC.md` lines |
|---------------|-------------|----|----------------------|
| `rounded-[12px]` | `rounded-card` | 12 | 28, 255, 290, 294, 306, 436, 444, 587, 622 |
| `rounded-[11px]` | `rounded-media` | 11 | 28, 261, 437, 445, 486 |
| `rounded-[16px]` / `rounded-t-[16px]` | `rounded-panel` / `rounded-t-panel` | 16 | 28 |
| `rounded-[8px]` (secret-field Input) | `rounded-field` | 8 | 625 |
| `rounded-[6px]` (Checkbox) | `rounded-md` | 6 | 55 |

Line 28 also names the roles in the Radius row (`rounded-lg` for field, `rounded-[12px]` card, `rounded-[11px]` media, `rounded-[16px]` panel): write the named utilities there. The same classes appear in Phase 6 code (for example `import-playlist-sheet.tsx`, `import-playlist-table.tsx`, `renumber-season-dialog.tsx`, `secret-field.tsx`, `admin-shell.tsx`, `skeletons/viewer-skeletons.tsx`); apply the same table.

## Status tones (identical colours)

| Phase 6 class | Use instead |
|---------------|-------------|
| `text-brand-green-safe` | `text-status-success` |
| `border-brand-green-safe/35` | `border-status-success/35` |
| `bg-brand-green-safe/8` | `bg-status-success/8` |
| `text-brand-orange-safe` | `text-status-warning` |
| `border-brand-orange-safe/35` | `border-status-warning/35` |
| `bg-brand-orange-safe/8` | `bg-status-warning/8` |
| `text-brand-red-safe` | `text-status-danger` |
| `border-brand-red-safe/35` | `border-status-danger/35` |
| `bg-brand-red-safe/8` | `bg-status-danger/8` |
| `text-[var(--text-mute)]` | `text-status-neutral` |
| `border-[var(--line-2)]` | `border-status-neutral-line` |
| `bg-transparent` | unchanged |

Files at tip `ffb531a`:

- `src/components/admin/youtube-status-chip.tsx` lines 22-25, `TONE_CLASSES`: `ok` becomes success, `bad` danger, `warn` warning, `neutral` neutral (the file carries a `TODO(phase-4)` at line 20 about this rename; remove it).
- `src/components/admin/settings/advanced-tab.tsx`: line 279 `TEST_OK_ICON` `text-brand-green-safe` becomes `text-status-success` (its `TODO(phase-4)` at line 278 asks for a green token; `status-success` is it, remove the TODO); lines 418, 421, 439 `text-brand-red-safe` become `text-status-danger`; line 607 `text-brand-orange-safe` becomes `text-status-warning`. At the first pin `cfa99df` the file had only the orange use, at line 352.
- The spec lines that use these classes (161-163 chip table, 231, 295, 306, 313, 589) get the same renames.

`brand-*-safe` classes keep working; the status classes are the rule for state from Phase 6 on.

## Shadows

Any `shadow-[...]` in Phase 6 code uses the `SHADOW_CODEMOD` names (`shadow-popover`, `shadow-modal`, `shadow-bar`, `shadow-soft`, `shadow-panel`, `shadow-inset-hairline`). `06-UI-SPEC.md` has none today.

## Toaster

Phase 4 changes the global Sonner toast class in `src/app/[locale]/layout.tsx` to `border border-white/10 bg-[var(--bg-1)] text-foreground shadow-popover`. At tip `ffb531a` Phase 6 has already moved the Toaster into `src/components/route-scoped-toaster.tsx` (`RouteScopedToaster`) and that file still carries the old class string (indigo-era hex background and a bracket `shadow-[0_24px_80px_rgba(0,0,0,0.45)]`, the one flagged `shadow-[` hit in that file). When Phase 6 merges after Phase 4, its `RouteScopedToaster` must carry the Phase 4 class string above unchanged, and `src/app/[locale]/layout.tsx` will conflict on the Toaster lines: keep Phase 6's `<RouteScopedToaster />` and drop the inline Toaster.

## Not flagged (unchanged)

`text-[11px]`, `text-[20px]`, `w-[220px]`, `h-[3px]`, `bg-white/[0.04]`, `bg-white/[0.18]`, `bg-black`, `tracking-[…]`, `outline-[var(--primary)]`, and `{brandHex}40` from the brand map (data-driven).
