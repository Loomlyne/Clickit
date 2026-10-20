# Hand-over: B1 viewer, UI System pass

Branch `claude/design-b1-viewer-89c447` (base: origin/main, #17 already merged in). PR: see below. Picture signed by Koss 2026-10-20 (`.planning/design/b1-viewer-before-after.html`), one change: no coloured side border on cards; cards use the UI System card (`ui/card.tsx` tokens: 12px radius, `--line` hairline, `--bg-1`).

## Commits
1. `.mono` / `.label` 11px floor (globals.css), `Button` 44px floor on `sm`, `icon`, `icon-sm`, `icon-xs` (shared; B4 admin will see taller icon buttons).
2. `PortraitShowCard` fills its cell with always-visible caption (shared with profile, B2); list and like toggles use primary-soft active state, 44px.
3. Page pass: /watch, /series/[slug], /watch/[episodeId], /my-list (see audit `.planning/design/b1-viewer-audit.md`).
4. Merge of origin/main.

## Gates (shared lock, 2026-10-20 ~11:34)
- `npm run lint`: 0 errors (1 old warning in review-composer exhaustive-deps)
- `npm run test:unit`: pass
- `npm run build`: pass only with placeholder `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Without them it fails at "Collecting page data for /[locale]/legal/[slug]: supabaseUrl is required" (no local env; page is B3's, untouched).

## Not verified
- No page was loaded in a browser (no Supabase locally): layout is checked only in the signed picture, not in the running app.
- Arabic (RTL) strings added for `show.seasonCountLabel`, `imdbLabel`, `citRatingLabel`; wording not reviewed by a native speaker.
- `.yt-side-*` classes in globals.css still use 10px; not used by B1 pages (not touched).
- Profile page and `shows-carousel` use `PortraitShowCard` too: check their look.

## UAT (type/click → expected)
1. Open `/en/watch`. → Hero buttons are tall (44px); no "+" chip on card hover; the Coming soon rail has no "View all"; Short Click has no "View all" and cards open with Enter/Space.
2. `/en/watch?category=<slug>`. → Banner has no coloured side border, a small colour dot before the name; same side padding as rails on a phone.
3. Open a series. → Hero unchanged; heart and list buttons are yellow-on-dark when active (no pink/white); season tabs 44px; the current episode row has a full neutral border (no coloured side); on a phone a 3-cell strip (IMDb, CIT rating, seasons) sits above the episodes.
4. Series, signed in → reviews: your initials (not "K") in the composer; stars and Clear/Post are 44px; textarea corners 8px.
5. Play an episode. → Top bar and tray use the dark app colours; icons and arrows 44px; liked heart is yellow; durations read "25 min"; let the episode end → "Play now" is yellow, both buttons 44px.
6. `/en/my-list` at 375 and 1280. → Posters fill their columns (no overlap at 1280), title and genre always under each poster; the list button is a yellow check at the top end; empty list shows a normal outline "Watch Shows" button.
7. Switch to `/ar/...` on 1 and 6. → Check mark, "New" badge and arrows sit on the mirrored side.
