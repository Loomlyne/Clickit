# B1 viewer: audit against tokens and DESIGN.md rules

Date 2026-10-20. Branch `claude/design-b1-viewer-89c447` (cut from `ui-system-home`, PR #17).
Rules checked: 44px targets, nothing under 11px, 4.5:1 contrast, radius roles (pill / field 8 / card 12 / media 11 / panel 16), off-token colour, live controls, i18n.
Contrast numbers are computed (white at alpha over `--bg-0` #090909).

Pages: `(viewer)/browse` is a redirect to `/watch` (no UI, nothing to change). `(viewer)/watch`, `(viewer)/series/[slug]`, `(watch)/watch/[episodeId]`, `(viewer)/my-list` have UI.

## Bugs found (not only style)

| # | Where | Problem |
|---|-------|---------|
| 1 | `src/components/shows/portrait-show-card.tsx:39-40` | Card is a fixed `var(--poster-w)` wide (220px; 140px at <=720; 120px at <=420) inside a fluid grid. My list at 1280: 5 columns of 170px, cards 220px, so each card overlaps the next by 50px. At 375: cards 120px in 155px cells. |
| 2 | `portrait-show-card.tsx:55-74` | Title, genre and Play only appear on hover. On a phone my list shows bare posters with no title. |
| 3 | `src/components/home/content-rail.tsx:47` | When a rail has no `seeAllHref` (Coming soon rail) a "View all" label still renders as a plain span. Looks like a link, does nothing. |
| 4 | `src/components/shows/show-card.tsx:47-49` | The "+" chip in the card overlay looks like Add to list but is a span. Clicking it opens the show. |
| 5 | `src/components/browse/shorts-rail.tsx:55` | "View all" is a `<button>` with no handler and no destination. |
| 6 | `shorts-rail.tsx:62-69` | Short cards are `div onClick`, not focusable, no keyboard. |
| 7 | `src/components/series/review-composer.tsx:130-132` | Composer avatar is the hard-coded letter "K" for every signed-in user. |
| 8 | `src/components/watch/episode-tray.tsx:171-172` | Duration pill prints `{episode.duration}:00` ("25:00") but `duration` is minutes. |
| 9 | `portrait-show-card.tsx:60-71,78` | Hard-coded English "Play", "New" and EN/AR season words (the other cards use `Tr`). `show-card.tsx:40-41` hard-codes "season(s)" and "eps". `metadata-card.tsx:22,35` hard-codes "IMDb", "CIT Rating". |
| 10 | `series-detail-content.tsx:45` | Metadata card (IMDb, CIT rating, genre, counts) is `hidden lg:block`: platform rating is invisible on phones. |
| 11 | `src/app/[locale]/(viewer)/watch/page.tsx:127,169` | Category banner uses `px-10` on phones; rails use 16px (`.rail` at <=720). |

## Violations by file:line

### Size under 11px
- `review-composer.tsx:254,259` 10px. `series/[slug]/page.tsx:218` 10px (cast role).
- `episode-tray.tsx:179,192` 10px (S/E pill, "Now").
- `portrait-show-card.tsx:59` 10.5px, `:78` 9.5px. `show-card.tsx:39` 10.5px, `:55` 9.5px. `episode-card.tsx:41,52`, `continue-watching-card.tsx:41` 10.5px / 9.5px.
- `shorts-rail.tsx:87,100` 9px (badge, sub-label).
- `episode-art-card.tsx:82` 10px (unused file).
- Global, shared: `globals.css:386-392` `.label` 10.5px; `globals.css:595-597` `.mono` is 10px at <=720 (used on hero meta, rail "View all", review meta, my-list eyebrow).

### Target under 44px
- `hero-slide.tsx:107,122` CTAs `py-2.5 text-[13px]` = about 41px.
- `series-detail-hero.tsx:76` sticky-bar CTA `py-2 text-xs` = about 34px.
- `season-selector.tsx:30` tabs `py-2.5 text-[12px]` = about 38px.
- `review-composer.tsx:144-149` star buttons 26px; `:192,202` Clear / Post `py-1.5 text-[12.5px]` = about 31px.
- `watchlist-toggle-button.tsx:89` card variant `h-9 w-9` = 36px.
- `watch-shell.tsx:302-332` top-bar icon buttons `size-8` = 32px; `:276` back link has no min height; `:341,353` prev/next `size-10` = 40px.
- `episode-tray.tsx:85` season chips `h-10` = 40px; `:115` raise button `size-9` = 36px.
- `autoplay-overlay.tsx:71-85` buttons `py-2` = about 37px.
- `my-list/page.tsx:79` empty-state CTA `py-3 text-[12px]` = 42px.
- `series/[slug]/page.tsx:244` "See what's coming" link has no min height.
- Shared (controller): `button.tsx` `sm`, `xs`, `icon`(36), `icon-xs`, `icon-sm` have no 44px floor.

### Contrast under 4.5:1
- `series/[slug]/page.tsx:233` `text-white/38`, 11px: 3.5:1.
- `episode-tray.tsx:200` `text-white/45`, 12px: 4.49:1 on bg-0, 4.48 on bg-2.
- Decorative only (no text): `episode-row.tsx:60` white/40, `series-detail-hero.tsx:207` white/30.

### Off-token colour
- White-alpha text instead of `--text` / `--text-dim` / `--text-mute`: 31 uses across the group (white/50 x9, /70 x12, /60, /55, /80, /45, /40, /38, /30). White/50 is 5.3:1 so it passes, but it is not a token.
- `watch-shell.tsx:270` `bg-zinc-950/90`; `episode-tray.tsx:74` `bg-black/92`; `watch/[episodeId]/loading.tsx:8` `bg-[#0a0a0a]`.
- Pink: `like-button.tsx:57,61,67,124` and `watch-shell.tsx:323`. Pink is not in the palette.
- `review-composer.tsx:182` `red-500/10`, `:215` `amber-500/10`.
- Fallback hex `#2C3569` in `episode-row.tsx:37`, `episode-tray.tsx:47` (brand-blue, it is a token value but written as a literal).

### Radius roles
- Episode thumb `episode-row.tsx:47` 14px -> media 11.
- Episode row `episode-row.tsx:167,183,194` 10px -> card 12.
- Tray `episode-tray.tsx:74` 8px -> panel 16; tray card `:149` 8px -> card 12; tray thumb `:163` 16px -> media 11.
- Textarea `review-composer.tsx:173` 16px -> field 8.
- Shorts card `shorts-rail.tsx:67` 10px -> media 11.
- Prev/next `watch-shell.tsx:341,353` 10px -> control pill.

### RTL (physical sides)
- `watchlist-toggle-button.tsx:89` `right-3`; `watch-shell.tsx:341,353` `left-3` / `right-3`; `episode-tray.tsx:171` `right-3`; `show-card.tsx:55`, `portrait-show-card.tsx:78` `left-2.5`; `shorts-rail.tsx:84` `left-2.5`. Arabic mirrors the page but these stay on the same physical side.

## Shared files this group needs changed (controller sequences)
1. `globals.css` `.mono` at <=720: 10px -> 11px; `.label` 10.5px -> 11px.
2. `button.tsx`: 44px floor on `sm`, `icon`, `icon-sm`, `icon-xs` (or stop using them in viewer pages).
3. `portrait-show-card.tsx` is also used by `(viewer)/profile` (B2) and `series/shows-carousel.tsx`. B1 proposes to own it; B2 only consumes.
4. Navbar (`navbar.tsx:259,273`) has 10px badges. Not in B1 scope.
