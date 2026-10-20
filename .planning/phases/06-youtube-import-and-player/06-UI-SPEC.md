---
phase: 06
slug: youtube-import-and-player
status: draft
revision: 2
shadcn_initialized: true
preset: "shadcn new-york, baseColor neutral, cssVariables; every token overridden by UI System (ui.config.json → src/styles/globals.css, 2026-10-20)"
created: 2026-10-20
signed_source: "06-CONTEXT.md D-01..D-19 + mockups/06-mockups.html option A (#q1, #q8, #q9, #q11, #q13, #q15), Koss 2026-10-20"
---

# Phase 6 — UI Design Contract

> Visual and interaction contract for YouTube import, the stacked watch page, the up-next and error cards, safe episode order and the editable YouTube key field (Vault, G6) status. Every value comes from the signed option A pictures, CONTEXT.md, or the live tokens in `src/styles/globals.css`. Where the picture was silent or this contract differs from it, the item is listed in "Owner-visible deviations" at the end. Nothing here reopens a signed decision.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (`components.json`, style new-york, `rsc: true`, Tailwind v4, CSS variables) |
| Preset | not applicable (tokens come from UI System `ui.config.json`, applied to `globals.css` 2026-10-20) |
| Component library | Radix (`radix-ui` package) via `src/components/ui/*` |
| Icon library | lucide-react |
| Font | LBC (local, `--font-lbc`), English and Arabic. Only two files exist: 400 and 700 |
| Mode | Dark only |
| Radius roles | pill 999px (controls, chips, buttons), field 8px (`rounded-lg`), card 12px (`rounded-[12px]`), media 11px (`rounded-[11px]`), panel 16px (`rounded-[16px]`) |
| Touch target | 44px (`min-h-11` / `size-11`) for every interactive element this contract specifies; hit areas wider than the visible control are opt-in per call site only where neighbours are ≥12px apart (memory rule "tap area opt-in", PR #20) |
| Minimum text | 11px. Nothing smaller anywhere in this phase |
| Contrast | 4.5:1 for every text/background pair (computed values under Color) |

### Primitives used (all exist, none added)

`ui/sheet`, `ui/table`, `ui/checkbox`, `ui/select`, `ui/dialog`, `ui/button`, `ui/input`, `ui/label`, `ui/skeleton`, `ui/tooltip` (admin arrows only), `admin/admin-shell` (`AdminPanel`), `admin/status-badge` (unchanged, not restyled), `admin/schedule-episodes-button` (extended with an episode filter, look unchanged, see §1.9).

**Inherited primitive typography: none.** Every primitive this contract places gets its text size and weight at the call site, so no 13.5px / 12.5px / 18px / `font-medium` / `font-semibold` from a primitive default reaches new UI:

| Primitive | Default it would inherit | Call-site override (mandatory) |
|-----------|--------------------------|--------------------------------|
| `Button` (every variant) | 13.5px `font-medium` | `text-sm font-bold`; size `default` (44px) or `icon-lg` (44px) only. `size="sm"`, `xs`, `icon`, `icon-sm`, `icon-xs` are not used in this phase |
| `Input` | `text-base md:text-sm` | `text-sm` |
| `SelectTrigger` | `text-sm`, `w-fit` | `w-full text-sm` |
| `SheetTitle` | `font-semibold` | `text-[20px] leading-tight font-bold` |
| `DialogTitle` | `text-lg font-semibold` | `text-[20px] leading-tight font-bold` |
| `DialogDescription` | `text-sm leading-6` | `text-sm leading-normal` |
| `TableHead` | `h-12 text-[11px] font-semibold tracking-[0.18em]` | `h-11 text-[11px] font-normal tracking-[0.14em]` |
| `TableCell` | `px-4 py-4` | `px-2 py-0` (row height comes from the row, §1.6) |
| `TooltipContent` | `text-xs` | `text-[11px]` |

The existing scheduler dialog (`ScheduleEpisodesButton`) opens unchanged; it is existing UI and not restyled by this phase.

### Upstream branches: what Phase 6 must preserve

1. `origin/claude/phase-02-execute-19d86a` has **no changes of its own** to `src/components/watch` or `src/components/ui`. The diff `origin/main → phase-02` only shows the reverse of #20 (phase-02 branched before the viewer design pass landed). Phase 6 keeps #20's values on main: `Button` default/lg `min-h-11`; `Checkbox` `size-5 rounded-[6px]`; `TabsTrigger` `min-h-11`; logical `start-*`/`end-*` and `rtl:rotate-180` / `rtl:scale-x-[-1]` on chevrons; `var(--text*)`, `var(--line*)`, `var(--primary)` instead of `white/NN` text, `zinc-950`, `pink-400`. If phase-02 is rebased after Phase 6, it must not bring back the `white/NN` text colours, `size-8`, `left-3`/`right-3`.
2. `origin/claude/design-b4-admin-be0a4c` (admin UI System pass, unmerged) edits `episodes-table.tsx`, `episode-form-drawer.tsx`, `settings/advanced-tab.tsx`, `settings/settings-card.tsx`, `status-badge.tsx`, `schedule-episodes-button.tsx`, `empty-state.tsx`. Whichever lands second rebases. When Phase 6 touches those lines it uses B4's tokens: `border-[var(--line)]`, `bg-[var(--bg-2)]`, `text-brand-*-safe` instead of `amber-*`/`orange-300`, `end-3` instead of `right-3`, `text-[11px]` minimum, arrow group `gap-2`.

---

## Spacing Scale

Declared values (multiples of 4 only):

| Token | Value | Tailwind | Usage in this phase |
|-------|-------|----------|---------------------|
| xs | 4px | `1` | Icon-to-text gap inside chips, title-to-subline gap, top-bar icon group gap |
| sm | 8px | `2` | Chip row gap, button groups, control bar vertical padding, rail vertical padding (keeps 4px focus rings unclipped), chip/hint offsets (`mt-2`) |
| sm+ | 12px | `3` | See exception below |
| md | 16px | `4` | Sheet body section gap, phone card padding, rail card gap, error banner inline padding |
| lg | 24px | `6` | Sheet header/body/footer inline padding, desktop card block padding |
| xl | 32px | `8` | Desktop up-next row gap (text block to thumbnail) |
| 2xl | 48px | `12` | Desktop replace-card inline padding, empty panel vertical padding |
| 3xl | 64px | `16` | Import table row height (`h-16`) |

Exceptions (each justified):
- **12px (`3`)** is the one step between 8 and 16. It is used only for: chip inline padding (`px-3`, signed chip is 10px, rounded up to the grid), the gap between paired fields and between control-bar columns, phone list row gap, phone card block gap, the countdown ring offset (`-top-3 -end-3`) and the 44px hit-area stretch (`-inset-y-3`). 8px makes these cramped next to 44px controls; 16px breaks the 60px control bar and the 211px phone card.
- 44px touch targets (`size-11`, `min-h-11`, `h-11` header row).
- 2px focus/current outline with 2px offset.
- 3px progress bar height and 3px countdown ring stroke.
- Fixed element heights: top bar 56px / 72px plus safe area, control bar 60px, thumbnail boxes (96×54, 64×36, 220×124, 112×63).

No half steps (`*.5`) appear anywhere in this contract.

---

## Typography

Exactly four sizes and two weights for everything this contract specifies (see "Inherited primitive typography: none" above).

| Role | Size | Weight | Line height |
|------|------|--------|-------------|
| Label | 11px (`text-[11px]`) | 400; 700 for chips only | 1.4 |
| Body | 14px (`text-sm`) | 400; 700 for the rows named below | 1.5 |
| Heading | 20px (`text-[20px]`) | 700 | 1.25 |
| Display | 24px (`text-[24px]`) | 700 | 1.2 |

**Where each size is used**
- 11px: status chips (700); overline labels (400, uppercase, `tracking-[0.14em]`); import table column headers (400, uppercase); episode card meta ("Watched", "14 min left"); top-bar season/episode line; import row sublines; "Can't play" reason line; gap hint; tooltip text; the needs-English hint. (No duration pills exist in this phase: the import table shows length in its Time column at 14px, and episode cards show length in the 11px meta line.)
- 14px: sheet description, import row titles, Time column, control-bar lines, card meta and reason text, settings status text, inline errors, numbering note, dashboard list, all buttons, season pills, inputs and select.
- 20px: import sheet title, success heading, renumber dialog title, the error-card "!" glyph, up-next / error card title when the card box is under 560px wide.
- 24px: up-next / error card title when the card box is 560px wide or more; countdown number in the 64px ring.

**Bold (700) at 14px, exact list:** every `Button` label; the watch top-bar episode title; the desktop control-bar episode title; `allAlreadyHeading` in the import sheet. Everything else at 14px is 400.

Rules:
- Weights are 400 (`font-normal`) and 700 (`font-bold`) only. LBC has no 500/600 file.
- Uppercase + tracking only on 11px overline labels and column headers. Arabic pages already strip `tracking-[…]` via the global rule in `globals.css`; use the bracket form so that rule applies.
- **Mixed-script text.** Titles and names (`{show}`, `{title}`, `{season}` titles) are isolated so Arabic and English never reorder each other:
  - Standalone title text renders inside `<bdi>` within a block that keeps the page direction.
  - Inside messages (both locales, so the keys match), the placeholder is wrapped in a `<bdi>` tag in the message text, e.g. `"Back to <bdi>{show}</bdi>"` / `"العودة إلى <bdi>{show}</bdi>"`. JSX sinks render with `t.rich(key, { bdi: (c) => <bdi>{c}</bdi> })`; string sinks (aria-label, toast, `title` attribute) use `t.markup(key, { bdi: (c) => '⁨' + c + '⁩' })` (first-strong isolate … pop isolate).
  - Existing keys reused unchanged (`watch.backToShow`, `watch.addToWatchlist` etc.) receive the value pre-wrapped: `isolate(name)` = `'⁨' + name + '⁩'`.
- **Numbers and digits.** Phase 6 does not choose the digit system; Phase 7 (AR-01..03) owns the switch to ٠–٩. Phase 6 rule: inside one string every number goes through the same ICU path, so a sentence never mixes digit systems and Phase 7 changes one place:
  - Counts inside plurals use `#`; every other number argument uses `{n, number}` (no bare `{n}` for numbers in new keys, and no literal digits in new message text: "1 to N" is `{first, number}` to `{count, number}`).
  - Times (`9:12`, `1:02:45`) and lengths (`24:10`) come from one helper `formatClock(seconds, locale)` that formats each part with `Intl.NumberFormat(localeTag, { minimumIntegerDigits })` using the same locale tag as next-intl, then is passed to messages as a string `{time}`. `m:ss` under one hour, `h:mm:ss` from one hour.
  - Dates come from the existing pattern `Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' })`, passed as `{date}`.
  - Number lists (gap hint "1, 2, 4, 7") come from `Intl.ListFormat` over `Intl.NumberFormat` parts with the same locale tag.
  - The existing key `seasonEpisodeShort` ("S{season} E{episode}" / "م{season} ح{episode}") is reused unchanged.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--bg-0` #090909 | Watch page canvas and top bar, admin canvas, up-next / error card base |
| Secondary (30%) | `--bg-1` #101010 | Import sheet surface and footer, watch control bar, watch episode section; `--bg-2` #191919 for fields, table header row, current episode row on phone, settings rows, renumber list rows |
| Letterbox | `#000` (`bg-black`) | The player stage around the 16:9 video box only |
| Accent (10%) | `--primary` #ffcc00, ink `--primary-foreground` #090909; soft tint `--uis-primary-soft` #312915 | Named list below only |
| Status safe tints | `--color-brand-green-safe` #77d586, `--color-brand-red-safe` #ff8b82, `--color-brand-orange-safe` #ffb46e | Status chips, status text and the import error banner only |
| Destructive | `--destructive` #ff3b30 | Existing form validation text only. No destructive action in this phase |
| Show brand glow | `BRAND_COLOR_HEX[show.brandColor]` at 25% alpha (`{hex}40`) | Radial glow in the up-next and error card background only, placed on the end side, away from the text block (§4.1) |

**Accent uses (named list; nothing else is yellow):**
1. Primary buttons: "Import season from YouTube", "Import N episodes as drafts", "Schedule these N episodes", "Play now", "Play next episode", "Try again" (error card), "Renumber episodes" (dialog confirm).
2. Checked checkbox fill in the import table.
3. The 2px current-episode outline on the episode thumbnail.
4. Episode progress bar fill (watch page).
5. Countdown ring arc in the up-next card.
6. The "!" glyph in the error card.
7. Filled Watchlist and Like icons when active (`fill-[var(--primary)] text-[var(--primary)]`, as on main after #20).
8. Moved-row highlight in the admin episodes table (`bg-[var(--uis-primary-soft)]`, 1200ms).
9. Keyboard focus rings (`ring-[var(--primary)]`, `--ring`).

Not accent: the active season pill on the watch page is `bg-[var(--text)] text-[var(--bg-0)]` (signed picture).

**Allowed overlay tints (existing codebase convention; white at low alpha over the dark surfaces, never used for text):**

| Class | Use |
|-------|-----|
| `bg-white/[0.03]` | Import table row hover |
| `bg-white/[0.04]` | Icon-button fill (sheet close, phone prev/next, admin up/down arrows), sheet Cancel hover |
| `bg-white/[0.18]` | Progress bar track |
| `border-white/8` | Existing table row borders (primitive, unchanged) |

### Status chip classes (one component, `YouTubeStatusChip`)

Base: `inline-flex min-h-6 items-center gap-1 rounded-full border px-3 text-[11px] leading-none font-bold tracking-[0.04em] whitespace-nowrap`

| Tone | Classes | Statuses |
|------|---------|----------|
| ok | `border-brand-green-safe/35 bg-brand-green-safe/8 text-brand-green-safe` | Ready, Key set, All episodes play |
| bad | `border-brand-red-safe/35 bg-brand-red-safe/8 text-brand-red-safe` | Private, Removed, Not embeddable, Blocked in UAE, Can't play, Key missing, Test failed |
| warn | `border-brand-orange-safe/35 bg-brand-orange-safe/8 text-brand-orange-safe` | Not ready, Needs English title, Check overdue |
| neutral | `border-[var(--line-2)] bg-transparent text-[var(--text-mute)]` | Already on Clickit, Not tested yet |

Meaning is never colour alone: every chip carries its words, and every greyed row also carries a reason line.

### Contrast (computed, WCAG 2.x relative luminance)

On `--bg-1` #101010 unless noted:

| Pair | Ratio |
|------|-------|
| `--text` #F4F4F4 | 17.3:1 |
| `--text-dim` #CCCCCC | 11.8:1 |
| `--text-mute` #A1A1A1 | 7.4:1 |
| brand-green-safe #77d586 | 10.6:1 |
| brand-red-safe #ff8b82 | 8.4:1 |
| brand-orange-safe #ffb46e | 10.9:1 |
| `--destructive` #ff3b30 (existing inline errors) | 5.4:1 (5.0:1 on `--bg-2`) |
| `--primary-foreground` #090909 on `--primary` #ffcc00 | 13.2:1 |
| `--text-mute` on `--bg-2` #191919 | 6.8:1 |

On the up-next / error card glow, worst case (text at the glow centre, 25% brand over `--bg-0`):

| Brand colour | Glow centre | `--text` | `--text-dim` | `--text-mute` (not allowed on cards) |
|--------------|-------------|----------|--------------|--------------------------------------|
| Innovative Blue #2C3569 | #121421 | 16.6:1 | 11.4:1 | 7.1:1 |
| Royal Purple #9F54A0 | #2e1c2f | 14.4:1 | 9.9:1 | 6.1:1 |
| Oasis Green #50A258 | #1b2f1d | 13.0:1 | 8.9:1 | 5.5:1 |
| Crimson Red #DB3F34 | #3e1614 | 14.4:1 | 9.8:1 | 6.1:1 |
| Sunset Orange #EA8C2E | #412a12 | 12.2:1 | 8.4:1 | 5.2:1 |
| Desert Sand #F8C623 | #453810 | 10.5:1 | 7.2:1 | 4.5:1 |

Card text therefore uses `--text` and `--text-dim` only. (Desert Sand is not in `BRAND_COLOR_HEX` today; it is listed so a future mapping stays safe.)

Greyed (skipped) import rows keep text at `--text-mute`; opacity is applied only to the thumbnail (`opacity-40`) and the disabled checkbox, never to text.

---

## 1. Admin import sheet (D-01 to D-07)

Signed picture: `#q1` option A.

### 1.1 Entry points

| Where | Control |
|-------|---------|
| Show admin page header (`admin/shows/[id]/page.tsx`), first item in the action group, before "Schedule episodes" and "Edit show" | `<Button className="text-sm font-bold">` (primary, default size 44px), icon `ListVideo size-4` at start, label `admin.youtubeImport.openButton` |
| Season tabs empty state (show with no seasons), next to the existing "Add season" action | `<Button variant="outline" className="text-sm font-bold">`, same label and icon |

Both open the same sheet. The button is enabled even when the key is missing (the sheet explains why import is off, §1.8).

### 1.2 Sheet frame

- `<Sheet>` with `<SheetContent side={locale === 'ar' ? 'left' : 'right'} showCloseButton={false} className="flex w-full flex-col gap-0 p-0 sm:max-w-[640px]">`. Full width under 640px.
- The primitive's own close button uses `right-4` (not logical), so it is turned off and the header renders its own.
- **Header** `shrink-0 border-b border-[var(--line)] px-6 pt-6 pb-4`:
  - Row `flex items-start justify-between gap-4`: `<SheetTitle className="text-[20px] leading-tight font-bold">` (`title`) and a close button `size-11 rounded-full border border-[var(--line)] bg-white/[0.04] text-[var(--text-dim)] hover:text-[var(--text)]` with `XIcon size-4`, `aria-label={common.close}`.
  - `<SheetDescription className="mt-1 text-sm text-[var(--text-mute)]">` (`description`).
- **Body** `flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4`.
- **Footer** `shrink-0 flex items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--bg-1)] px-6 py-4`:
  - Start: Cancel, `<Button variant="ghost" className="border-transparent bg-transparent text-sm font-bold text-[var(--text-dim)] hover:bg-white/[0.04] hover:text-[var(--text)]">` (`common.cancel`).
  - End: primary `<Button className="text-sm font-bold">` (`importButton`, count = ticked rows).

### 1.3 Link field

- Overline label (11px/400, uppercase, `tracking-[0.14em] text-[var(--text-mute)] mb-2`): `linkLabel`.
- `<Input type="url" inputMode="url" dir="ltr" className="text-sm" placeholder={linkPlaceholder} autoFocus>` (links are always LTR, also on the Arabic admin).
- Reading starts by itself when the value parses as a playlist link: on paste immediately, after 400ms without typing, and on Enter. No separate "Read" button.
- Parse errors show under the field, `mt-2 text-sm text-brand-red-safe`, `role="alert"`, input gets `aria-invalid`:
  - Not a YouTube link, or no `list=`: `youtubeErrors.notAPlaylistLink`.
  - A single-video link with no `list=`: `youtubeErrors.videoLinkInImport`.
  - A `watch?v=…&list=…` link is accepted as the playlist.

### 1.4 Target picker and season title (D-02)

Row `grid gap-3 sm:grid-cols-2` under the link field (visible from the start, so the admin can set it while the playlist loads).

| Field | Spec |
|-------|------|
| Put into | Overline label `targetLabel`. `<Select>` with `<SelectTrigger className="w-full text-sm">` (44px). First option, default: `targetNewSeason` (number = highest season number + 1). Then one option per existing season, ascending: `targetExistingSeason`. |
| Season title (new season only) | Overline label `seasonTitleLabel`. `<Input className="text-sm">` prefilled with the playlist title once read (empty while reading, placeholder `seasonTitlePlaceholder`), editable, required, `maxLength={120}`, `dir="auto"`. Empty on submit: `seasonTitleRequired` under the field (`mt-2 text-sm text-brand-red-safe`), import button disabled. If the admin edited the title, a later re-read never overwrites it. |
| Existing season chosen | The title field is replaced in the same grid cell by a read-only line, `text-sm text-[var(--text-dim)]`, `self-end min-h-11 flex items-center`: `appendNote`, or `appendNoteEmpty` when that season has no episodes. |

### 1.5 Summary row and numbering note

- Row `flex flex-wrap items-center gap-2`: three chips, then meta at `ms-auto text-sm text-[var(--text-mute)]`.
  - `summaryReady` (ok), `summaryCantPlay` (bad; counts Private, Removed, Not embeddable, Blocked in UAE and Not ready), `summaryAlready` (neutral). A chip with count 0 is not rendered.
  - Meta: `readMeta`.
- Numbering note under the row, `text-sm text-[var(--text-dim)]`: `numberingNote`. Recomputed when ticks or target change; numbers follow playlist order over the ticked rows (D-03).

### 1.6 Table

Container: `overflow-hidden rounded-[12px] border border-[var(--line)]`. Built with `ui/table` and the call-site overrides above.

| Column | Width | Header (11px/400 uppercase) | Cell |
|--------|-------|-----------------------------|------|
| Tick | 44px | Header checkbox: ticks or clears all **Ready** rows; `checked="indeterminate"` when some are ticked; `aria-label={selectAllAria}` | `<label>` box `flex size-11 items-center justify-center` wrapping `<Checkbox>` (`size-5`, primitive unchanged), `aria-label={rowSelectAria}` |
| # | 28px, `text-end`, hidden under 640px | `#` | Playlist position (1-based, `Intl.NumberFormat`), `text-sm text-[var(--text-mute)]` |
| Thumb | 96×54 (64×36 under 640px) | none | `<Image unoptimized>` from the API `thumbnails.medium.url` (i.ytimg.com), `rounded-[11px] object-cover`, `alt=""` (the title is next to it). Missing: `bg-[var(--bg-3)]` box |
| Title | flex, `min-w-0` | `titleColumn` | Line 1: `<div className="truncate text-sm"><bdi>{title}</bdi></div>`. Line 2 `mt-1 text-[11px] text-[var(--text-mute)]`: for Ready rows the visibility (`visibilityPublic` / `visibilityUnlisted`), plus ` · ` + `arabicTitle` when the title is Arabic script; for skipped rows the reason (§1.7). Under 640px the length is appended to line 2 (` · 24:10`) |
| Time | 56px, `text-end`, hidden under 640px | `timeColumn` | `formatClock`, `text-sm text-[var(--text-dim)] tabular-nums`; `—` when unknown |
| Status | 152px (`auto` under 640px), `text-end` | `statusColumn` | `YouTubeStatusChip` |

- Header row: `<TableHeader>` row `sticky top-0 z-[1] h-11 bg-[var(--bg-2)]`; cells `h-11`.
- Body rows: `h-16` (64px), `border-t border-[var(--line)]`, cells `px-2 py-0 align-middle`. Ready rows: hover `bg-white/[0.03]`; clicking anywhere on the row toggles its checkbox.
- Skipped rows (any status other than Ready): checkbox `disabled` and unticked, title colour `--text-mute`, thumbnail `opacity-40`, no hover, row `aria-disabled="true"`.
- Ready rows start ticked. The admin may untick any Ready row (to leave out a trailer); the import count follows.
- All rows render (no virtualisation; seasons are under ~200 videos).

### 1.7 Status chip set and reason lines

| Status | Chip key | Tone | Rule (CONTEXT discretion) | Row | Reason line key |
|--------|----------|------|---------------------------|-----|-----------------|
| Ready | `status.ready` | ok | embeddable, public or unlisted, processed, AE allowed, not on Clickit | ticked | `visibilityPublic` / `visibilityUnlisted` |
| Private | `status.private` | bad | `privacyStatus=private` | skipped | `reason.private` |
| Removed | `status.removed` | bad | item missing from `videos.list` | skipped | `reason.removed` |
| Not embeddable | `status.notEmbeddable` | bad | `status.embeddable=false` | skipped | `reason.notEmbeddable` |
| Blocked in UAE | `status.blockedUae` | bad | region blocked list has AE, or allowed list lacks AE | skipped | `reason.blockedUae` |
| Not ready | `status.notReady` | warn | `uploadStatus≠processed`, or live/upcoming | skipped | `reason.processing` or `reason.premieres` |
| Already on Clickit | `status.alreadyOnClickit` | neutral | `youtube_video_id` exists anywhere in the catalog | skipped | `reason.alreadyOnClickit` |

Row order is always playlist order; statuses do not sort rows.

### 1.8 States

| State | What shows |
|-------|-----------|
| Empty (sheet just opened) | Link field focused; target row visible; in place of summary + table a dashed panel `rounded-[12px] border border-dashed border-[var(--line-2)] px-6 py-12 text-center text-sm text-[var(--text-mute)]` with `emptyBeforeLink`. Import button disabled, label `importButton` with count 0 |
| Reading (first page) | Meta only, `flex items-center gap-2`: `Loader2 size-4 animate-spin motion-reduce:animate-none` + `reading`, `aria-live="polite"`. Table shows the header + 6 `<Skeleton>` rows at 64px (44px checkbox box, 96×54 thumb, two text bars, chip bar). Import button disabled |
| Paging (more pages) | Rows already read stay visible and tickable; meta keeps updating `reading` with the page number; 2 skeleton rows at 64px at the end. Import button stays disabled until the last page and the `videos.list` checks finish, so the count is final |
| Loaded | Summary, numbering note, full table; import button enabled when ≥1 row is ticked and (for a new season) the title is filled |
| Nothing new | Every video `Already on Clickit`: the table still lists them (the admin sees where each one is) and a neutral panel above it `rounded-[12px] border border-[var(--line-2)] px-4 py-3`: `allAlreadyHeading` (14px/700), `allAlreadyBody` (14px/400 `text-[var(--text-dim)]`). The footer's import button is replaced by `<Button variant="outline" className="text-sm font-bold">` `common.close` |
| Nothing importable | Every row skipped for other reasons: warn panel above the table (`border-brand-orange-safe/35 bg-brand-orange-safe/8`, same padding) with `noneImportable`. Import button disabled |
| Empty playlist | `youtubeErrors.emptyPlaylist` in the dashed panel |
| Error: private or missing playlist | Error banner with `youtubeErrors.playlistPrivate`. Link field keeps the value for editing |
| Error: quota used up | Banner `youtubeErrors.quota`. Rows already read stay; import button disabled |
| Error: key missing | Banner `youtubeErrors.keyMissing` + `<Button variant="outline" asChild className="text-sm font-bold">` `youtubeErrors.openSettings` to `/admin/settings?tab=advanced`. Link field disabled |
| Error: key rejected | Banner `youtubeErrors.keyRejected` + the same Settings button |
| Error: network / YouTube down | Banner `youtubeErrors.network` + `<Button variant="outline" className="text-sm font-bold">` `youtubeErrors.retry` that re-reads |
| Importing | Primary button shows `Loader2 size-4` + `importing`, disabled; Cancel and close disabled; the sheet ignores Esc and outside click (`onOpenChange` no-op while importing); checkboxes and fields disabled |
| Import failed | Banner `youtubeErrors.importFailed` with the server reason; preview and ticks kept so the admin can press Import again |
| Success | §1.9 |

Error banner: `role="alert"`, `flex items-center gap-3 rounded-[12px] border border-brand-red-safe/35 bg-brand-red-safe/8 px-4 py-3 text-sm text-[var(--text)]`; `TriangleAlert size-4 shrink-0 text-brand-red-safe` at start; text `flex-1`; optional action button at end (`shrink-0`). Placed directly under the target row. Under 640px the action button drops to its own line (`flex-wrap`, button `w-full`).

### 1.9 Success state (D-07)

The body is replaced (same sheet, no new dialog):

- Centered column `flex flex-col items-center gap-4 px-6 py-12 text-center`:
  - Circle `size-11 rounded-full border border-brand-green-safe/35 bg-brand-green-safe/8 flex items-center justify-center` with `Check size-5 text-brand-green-safe` (`aria-hidden`).
  - Heading `text-[20px] leading-tight font-bold`: `successHeading`. Receives focus on mount (`tabIndex={-1}`, `outline-none`) so screen readers hear it.
  - Body `text-sm text-[var(--text-dim)] max-w-md`: `successBody`.
  - If any imported episode has an Arabic-only title: `flex items-center gap-2` with warn chip `status.needsEnglishTitle` + `text-sm text-[var(--text-dim)]` `successNeedsEnglish`.
- Footer: start `<Button variant="outline" className="text-sm font-bold">` `done` (closes, `router.refresh()`); end `<Button className="text-sm font-bold">` with `CalendarClock size-4` + `scheduleButton`.
- "Schedule these N episodes" closes the sheet and opens the existing scheduler dialog limited to the imported episode ids (planner note in §Planner notes). Its dialog copy and look are unchanged.

### 1.10 Keyboard and screen reader

- Tab order: close, link, Put into, Season title, header checkbox, row checkboxes, Cancel, Import.
- Esc closes (except while importing). Focus returns to the entry button.
- The meta line and the summary row are one `aria-live="polite"` region; it announces the final summary once, not each page.

---

## 2. Single-link add in the episode form

The form (`episode-form-drawer.tsx`) keeps its layout. Changes:

1. `YouTubeFetchButton` calls the new server module instead of `/api/youtube-meta`. Fill rules follow D-04: Arabic-script title → `title_ar` (and `title` only if `title` is empty), Arabic-script description → `description_ar`; otherwise `title` / `description`. Fill only empty fields (existing rule). The fetch button becomes `<Button variant="outline" className="mt-2 text-sm font-bold">` (44px), icon `Sparkles size-4` / `Loader2 size-4` while loading.
2. Refusals (client check on fetch, and the server re-check on save) render through `YouTubeUrlInput`'s existing `error` prop, under the URL field (`text-destructive text-sm`, existing style), and the URL input gets `aria-invalid`. On a save refusal the form also scrolls the URL field into view, focuses it, and shows `toast.error(episodeForm.notSavedToast)`. Nothing else in the form is cleared.
3. While saving: existing `savingLabel`.
4. "Needs English title" hint: when the `title` field contains Arabic script, show under it `mt-2 flex items-center gap-2`: warn chip `status.needsEnglishTitle` + `text-[11px] text-[var(--text-mute)]` `episodeForm.needsEnglishTitleHint`. Disappears as soon as the title has no Arabic script.
5. `toastNoYoutubeKeyDescription` gets new text (the old one pointed to the removed settings field).

Messages (all in `admin.youtubeErrors`): `notAVideoLink`, `playlistLinkInForm`, `videoNotFound`, `videoPrivate`, `videoNotEmbeddable`, `videoBlockedUae`, `videoNotReady`, `videoDuplicate`, `keyMissing`, `keyRejected`, `quota`, `network`.

---

## 3. Watch page, stacked layout (D-08, D-10, D-12)

Signed picture: `#q8` option A, desktop 1280 and phone 375.

### 3.1 Hard rule

No element is ever drawn over any pixel of the YouTube iframe while it is mounted and visible: no top bar, arrow, tray, overlay, gradient, tooltip, toast, focus ring, hit-area pseudo-element, skeleton or loading tint. The player box contains the iframe and nothing else (the loading tint and the old error overlay inside `youtube-player.tsx` are removed; loading shows the black stage until `onReady`). The up-next and error cards **replace** the iframe (§4), they never sit on it.

Removed from the watch page: the `fixed` top chrome strip, the `fixed` prev/next arrows over the video, `AutoplayOverlay` as an overlay, the vaul `Drawer` tray with snap points and hover raise, the `useIdleTimer` chrome auto-hide, every tooltip, and every toast.

**No Toaster on the watch route.** The global `<Toaster>` in `src/app/[locale]/layout.tsx` moves into a client wrapper `RouteScopedToaster` that returns `null` when next-intl's `usePathname()` starts with `/watch/`. On the watch route no Toaster is mounted at all, so nothing (including a toast fired by shared code such as `useWatchlist`) can appear over the video. Watch feedback is inline (§3.3).

### 3.2 Page frame

`WatchShell` root: `flex h-dvh flex-col overflow-hidden bg-[var(--bg-0)]` with `padding-bottom: env(safe-area-inset-bottom)`. Order, top to bottom, on every width:

1. Top bar (`flex-none`)
2. Player stage (`flex-none`)
3. Control bar (`flex-none`)
4. Episode section (`flex-1 min-h-0 overflow-y-auto`) — the only part that scrolls

Because only the episode section scrolls, and it sits below the control bar, nothing can scroll over the stage.

Landscape phones (`@media (orientation: landscape) and (max-height: 500px)`): the root becomes `h-auto min-h-dvh overflow-visible` and the whole document scrolls; the top bar is in normal flow (never `sticky` or `fixed`), so it scrolls away with the page instead of over the video. Stage height there: `calc(100dvh - 56px - env(safe-area-inset-top))`.

### 3.3 Top bar

| | Phone (<768px) | Desktop (≥768px) |
|---|---|---|
| Height | `h-[calc(56px+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)]` (56px content row) | `md:h-[calc(72px+env(safe-area-inset-top))]` with the same top padding (72px content row) |
| Surface | `bg-[var(--bg-0)] border-b border-[var(--line)]` | same |
| Padding | `px-2` | `px-5` |
| Start | Back icon button `size-11`, `ArrowLeft size-5 rtl:rotate-180`, `aria-label={watch.backToShow}` with `isolate(show)` | Back link `min-h-11 inline-flex items-center gap-2 text-sm text-[var(--text-dim)] hover:text-[var(--text)]`: `ArrowLeft size-5 rtl:rotate-180` + `<bdi>{show}</bdi>` |
| Center | Episode title `text-sm font-bold truncate` (`<bdi>`), under it `text-[11px] text-[var(--text-mute)]` `seasonEpisodeShort` (existing, unchanged) | Episode title `text-sm font-bold`, under it `text-[11px] text-[var(--text-mute)]` `player.seasonEpisodeLong` |
| End | Share icon button `size-11` | Watchlist, Like, Share icon buttons, each `size-11 rounded-full text-[var(--text-dim)] hover:text-[var(--text)]`, `gap-1`; active Watchlist/Like fill `var(--primary)` |

The content row is a fixed 56/72px under the safe-area inset, so the 44px buttons are never squeezed on notched phones.

Focus: `focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-0)]`. The 44px buttons sit centred in a 56/72px row, leaving ≥6px below them, so the 4px ring never reaches the stage.

Phone: Watchlist and Like are not in the top bar (signed picture shows back, title, share only). They move to the end of the season row in the episode section (§3.6), same icons and behaviour.

Share feedback without a toast: after copy, the share icon swaps to `Check` and the button's `aria-label` becomes `watch.linkCopied` for 2s; a visually hidden `aria-live="polite"` node announces `watch.linkCopied`. Watchlist/Like errors (if the hook fails) flip the icon back and announce through the same live node; they never call `toast()` on this route.

### 3.4 Player stage and box

- Stage: `relative flex-none flex justify-center bg-black`, height
  - desktop (≥768px): `max(200px, min(56.25vw, calc(100dvh - 372px - env(safe-area-inset-top))))` (372 = top bar 72 + control bar 60 + 240 for the first row of episodes)
  - phone: `max(200px, min(56.25vw, calc(100dvh - 356px - env(safe-area-inset-top))))` (56 + 60 + 240); on a 375px phone this is 211px, as in the picture.
- Video box (inside the stage): `relative h-full aspect-video max-w-full min-h-[200px] min-w-[200px]`, centred. When the screen is wider than 16:9 at that height the black stage shows at both sides (letterbox). On screens narrower than 356px the box is full width and 200px tall; YouTube letterboxes inside.
- The box holds exactly one visible child at a time: the YouTube container, or the up-next card, or the error card. While a card shows, the YouTube container stays mounted with the `hidden` attribute (display none) so its player instance can be reused, and the video is stopped (§4.1).
- `role="region" aria-label={player.videoPlayerAria}`, `tabIndex={-1}`, `outline-none focus:outline-none` on the box: it may receive programmatic focus (§3.5) but never draws a ring on the iframe edge.
- Player vars (D-12): add `hl` = site locale (`en` / `ar`); English site adds `cc_load_policy: 1` and `cc_lang_pref: 'en'`; Arabic site adds neither. Keep `rel: 0`, `playsinline: 1`, `iv_load_policy: 3`, `origin`. Referrer policy stays `strict-origin-when-cross-origin`.

### 3.5 Control bar

`flex-none h-[60px] grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--line)] bg-[var(--bg-1)] px-3 py-2 md:px-5` (8px vertical padding keeps every 4px focus ring inside the bar).

| | Phone | Desktop |
|---|---|---|
| Previous | `<Button variant="outline" size="icon-lg" className="border-[var(--line)] bg-white/[0.04]">`, `ChevronLeft size-5 rtl:rotate-180`, `aria-label={watch.previousEpisode}` | `<Button variant="outline" className="text-sm font-bold">` (44px): `ChevronLeft size-4 rtl:rotate-180` + `common.previous` |
| Center | One line, `text-sm text-[var(--text-mute)] text-center truncate`: the status line | Two lines, `text-center min-w-0`: title `text-sm font-bold truncate` (`<bdi>`), then the status line `text-sm text-[var(--text-mute)] truncate` |
| Next | As previous with `ChevronRight`, `aria-label={watch.nextEpisode}` | `<Button variant="outline" className="text-sm font-bold">`: `watch.nextEpisode` + `ChevronRight size-4 rtl:rotate-180` |

No previous / no next: the button stays in place for a stable layout, `disabled` (`opacity-50`, primitive default), not focusable.

Status line states:

| State | Desktop text | Phone text |
|-------|-------------|------------|
| Resumed (saved position > 0 and < 95%) | `resumedAt` + ` · ` + button `startFromBeginning` | `resumedAt` + ` · ` + button `startOver` |
| Fresh start (no saved position, or ≥95% completed → starts at 0:00) | `player.seasonEpisodeLong` | `episodeOfTotal` |
| After "Start from the beginning" | same as fresh start | same as fresh start |
| Ended, up-next card showing | `finished` | `finished` |
| Error card showing | `player.seasonEpisodeLong` | `episodeOfTotal` |

"Start from the beginning" / "Start over": `<button type="button">` styled `relative underline underline-offset-4 text-[var(--text-dim)] hover:text-[var(--text)] after:absolute after:-inset-x-3 after:-inset-y-3 after:content-['']`. The 21px line plus 12px above and below gives a 45px-tall hit area; the word is at least 44px wide with the 12px side stretch.
- Phone (one centred line in the 60px bar): the hit area runs from 7px to 52px inside the bar. It never leaves the bar.
- Desktop (status line under the title): the hit area runs from 17px inside the bar to 2px below it, into the episode section. It never reaches up to the stage.
- Neighbours: nothing interactive within 12px (the title is text, the prev/next buttons are in other grid columns with a 12px gap), so the opt-in rule is met.

Action: `player.seekTo(0, true)`, the progress tracker saves 0, the line switches to the fresh-start text, and focus moves to the stage box (`tabIndex={-1}`, no ring) so it is not lost when the button unmounts.

Resume behaviour (D-10): on every episode switch, `loadVideoById({ videoId, startSeconds })` with that episode's saved seconds. Silent: no prompt.

### 3.6 Episode section (replaces the tray)

`flex-1 min-h-0 overflow-y-auto bg-[var(--bg-1)]`. Visually hidden heading `<h2 className="sr-only">` `watch.episodesHeading`.

Season row `flex items-center gap-2 px-4 pt-3 md:px-5`:
- Season pills only when the show has more than one season: `<button>` `min-h-11 rounded-full border px-4 text-sm` — active `border-[var(--text)] bg-[var(--text)] text-[var(--bg-0)]`, others `border-[var(--line)] text-[var(--text-dim)] hover:text-[var(--text)]`; `aria-pressed`; horizontal scroll if they overflow. Label: existing `seasonShort`-style key is not used; pills read `player.seasonLabel` ("Season {number, number}").
- Phone only, at `ms-auto`: Watchlist and Like icon buttons (`size-11`, as in the desktop top bar).

Desktop (≥768px), horizontal rail `flex gap-4 overflow-x-auto px-5 py-2 snap-x` (8px vertical padding stops overflow from clipping focus rings):
- Card: `<button>` `w-[220px] flex-none snap-start text-start rounded-[12px] outline-none focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2`.
- Thumbnail 220×124 `rounded-[11px]` (`ShowArt` with the YouTube thumbnail, `unoptimized`, maxres → standard → high fallback); current episode: `outline-2 outline-[var(--primary)] outline-offset-2` on the thumbnail.
- Progress bar `mt-2 h-[3px] rounded-full bg-white/[0.18]`, fill `bg-[var(--primary)]` at the saved percent; completed = 100%; not started = track only.
- Title `mt-2 text-sm truncate`: `{n} · <bdi>{title}</bdi>` (episode number via `Intl.NumberFormat`).
- Meta `mt-1 text-[11px] text-[var(--text-mute)]`: `nowPlaying` (current), `watched` (completed), `minutesLeft` (in progress), `episode.minutesAbbr` (not started), `notOutYet` (not published / no video).
- On select: the rail scrolls the current card into view (`scrollIntoView({ inline: 'nearest', block: 'nearest' })`, `behavior: 'auto'` under reduced motion).

Phone (<768px), vertical list `flex flex-col gap-2 px-4 py-3`:
- Row: `<button>` `flex w-full items-center gap-3 rounded-[12px] p-2 text-start`; current `bg-[var(--bg-2)]`; focus ring as desktop.
- Thumbnail 112×63 `relative overflow-hidden rounded-[11px]`; progress bar inside the thumbnail at the bottom: `absolute inset-x-0 bottom-0 h-[3px] bg-white/[0.18]` with primary fill.
- Text: title `text-sm line-clamp-2` (`{n} · <bdi>{title}</bdi>`), meta `mt-1 text-[11px] text-[var(--text-mute)]` (same keys as desktop).

Not playable (not published or no video): `disabled`, `aria-disabled`, thumbnail `opacity-40`, meta `notOutYet`; text colours unchanged (no opacity on text).

`aria-current="true"` on the current item.

### 3.7 RTL

- Flex/grid order mirrors by itself: in Arabic, Previous sits at the right edge, Next at the left; Back at the right of the top bar.
- Every chevron and the back arrow: `rtl:rotate-180`.
- Only logical utilities: `ps-/pe-`, `ms-/me-`, `start-/end-`, `text-start/text-end`, `border-s/border-e`. No `left-`/`right-`/`text-left` in new code.
- The rail scrolls from the right in Arabic (native `overflow-x` with `dir="rtl"`).
- Names and titles isolated per the Typography rule; numbers per the Typography digit rule (Phase 7 owns the digit system).

---

## 4. Up-next card (D-09) and branded error card (D-11)

Signed pictures: `#q9` option A, `#q11` option A.

### 4.1 Shared frame

- Rendered inside the video box, `absolute inset-0` of the box, with the YouTube container `hidden`. Same size as the video, so the stage does not jump.
- **The video is silent and idle while a card shows.** On `ENDED`, on `onError`, and when switching to a `blocked_ae` episode, call `player.stopVideo()` (if a player exists) before hiding the container. Never call `loadVideoById` or `cueVideoById` while the container is hidden (no preloading the next episode).
- **Un-hide before load.** For "Play now", "Try again", "Watch again", Previous/Next or a list pick while a card shows: (1) remove the card and the `hidden` attribute in one state update, (2) after that commit (`useEffect` on the visible flag, or `flushSync`), call `loadVideoById` (or `seekTo(0)` + `playVideo()` for Watch again). Target `blocked_ae`: stay hidden and show its card instead of loading. The video only plays once the container is visible and at least 200×200.
- `@container` on the card. Wide layout from `@min-[560px]`.
- Background: `radial-gradient(ellipse at 85% 40%, {brandHex}40 0, transparent 50%), var(--bg-0)`; in RTL the ellipse sits at `15% 40%`. `{brandHex}40` = the show's brand colour at 25%, centred on the end side (behind the thumbnail on the up-next card, empty space on the error card), away from the text block at the start. Text on the card uses `--text` and `--text-dim` only (contrast table under Color).
- Padding: `p-4` narrow; `@min-[560px]:px-12 @min-[560px]:py-6` wide.
- Buttons: `<Button className="text-sm font-bold">` (primary, 44px) and `<Button variant="outline" className="text-sm font-bold">` (44px), group `flex gap-2`; in the narrow layout both are `flex-1` in one row and their labels truncate.

### 4.2 Up-next card

Shown on `ENDED` when a next episode exists (same season next number, else the first episode of the next season — existing `findNextEpisode`).

Wide (≥560px box), `flex items-center gap-8`:
- Text block `flex-1 min-w-0`:
  - Overline `text-[11px] uppercase tracking-[0.14em] text-[var(--text-dim)] mb-2`: `upNextEyebrow`.
  - Title `text-[24px] leading-tight font-bold text-[var(--text)] line-clamp-2 mb-2` (`<bdi>`), `id` used by `aria-labelledby` on the card.
  - Meta `text-sm text-[var(--text-dim)] mb-4`: `episode.minutesAbbr`.
  - Buttons: primary `Play size-4 fill-current` + `player.autoplayPlayNow`; outline `upNextCancel`.
- Thumbnail block `relative flex-none`: 220×124 `rounded-[11px]`; countdown ring 64×64 at `absolute -top-3 -end-3`, `rounded-full bg-[var(--bg-0)]`.

Narrow (<560px box, e.g. 375px phone at 211px tall), `flex flex-col justify-center gap-3`:
- Row `flex items-center gap-3`: overline (as above, `truncate`) + countdown ring 44×44 at `ms-auto`.
- Title `text-[20px] leading-tight font-bold line-clamp-1`.
- No meta, no thumbnail.
- Buttons row, each `flex-1`.

Countdown ring: inline SVG, circle radius set so the stroke sits inside the box; track `stroke-[var(--line-2)]`, arc `stroke-[var(--primary)]`, `stroke-width 3`, `stroke-linecap round`, starts at 12 o'clock and runs clockwise (mirrored with `rtl:-scale-x-100` on the circle group only, not the number). Number centred, `font-bold text-[var(--text)] tabular-nums`, 24px in the 64px ring and 14px in the 44px ring, formatted with `Intl.NumberFormat`, `aria-hidden`. 8 → 0 in 1s steps; the arc's `stroke-dashoffset` animates linearly over each second. At 0: same as Play now.

Behaviour:
- On show: one polite announcement via a hidden live region: `upNextAnnounce`. Focus is not moved (no focus theft at the end of a video).
- Esc while the card is visible = Cancel.
- Play now: un-hide, then switch episode (resumes at its saved position, §3.5); the card unmounts.
- Cancel: ring and countdown stop and disappear; the card stays (YouTube's end screen is never shown, D-09); buttons become primary `player.autoplayPlayNow` and outline `watchAgain` (un-hide, then `seekTo(0)` + play the current episode).
- Previous/Next or a list pick while the card shows: un-hide, then load that episode.
- Reduced motion (`prefers-reduced-motion: reduce`): no countdown and no auto-advance; the card opens directly in the cancelled state (Play now / Watch again). DESIGN.md "gate animations and video autoplay".

Series end (no next episode): same frame; overline `upNextDoneEyebrow` (the finished episode), title `seriesEndHeading`, body `text-sm text-[var(--text-dim)] mb-4` `seriesEndBody`, buttons primary `watchAgain`, outline `watch.backToShow` (link to `/series/{slug}`, `isolate(show)`).

### 4.3 Error card

When it shows:
- **Stored status `blocked_ae` (Blocked in UAE at the last daily check or import): before loading.** A UAE region block has no distinct player error code (06-RESEARCH.md Pattern 9/10, A16), so the card would otherwise never appear. The watch page passes the `blocked_ae` episode ids from a server read; for those, the card shows with `errorReasonUae` and the player is never asked to load them: no `loadVideoById`/`cueVideoById`, and if the page opens on such an episode the YouTube player is not created until the viewer moves to a playable one. No viewer report is sent (the episode is already flagged by the check).
- **Every other stored status (Removed, Private, Not embeddable, Not ready, ok, unknown): only on a real player error.** The player always tries; the card shows on `onError`. The episode is reported to the D-17 flag (one report per episode per page load), except for error 153. Stored status is used only to pick a more precise reason sentence when it agrees with the error code.
- **Error 153 (missing Referer / client identification): a site problem, not the episode's.** Generic card: `errorTitle`, reason `errorReasonSite` (no "We've told the Clickit team" line), primary `tryAgain`, secondary `watch.backToShow`. The episode is never flagged; `console.error` once.

In the list, `blocked_ae` episodes stay selectable (picking one shows this card); their meta line is unchanged.

Wide, `flex flex-col items-start justify-center` (text aligned start):
- Icon: a bare "!" in one circle, as signed: `<span aria-hidden className="mb-4 flex size-11 items-center justify-center rounded-full border border-[var(--line-2)] text-[20px] font-bold text-[var(--primary)]">!</span>`. No lucide icon inside.
- Title `text-[24px] leading-tight font-bold text-[var(--text)] mb-2`: `errorTitle`.
- Reason `text-sm text-[var(--text-dim)] max-w-[440px] mb-6`: reason sentence + space + `errorReported` (omitted for 153).
- Buttons: see table.

Narrow: no icon; title `text-[20px] line-clamp-2`; reason `line-clamp-2 mb-3`; title `mb-2`; buttons `flex-1` in one row; the show name in "Back to {show}" truncates.

| Player error | Stored status (if known) | Reason key | Primary | Secondary |
|--------------|--------------------------|-----------|---------|-----------|
| 100 | Private | `errorReasonPrivate` | `playNextEpisode` | `watch.backToShow` |
| 100 | anything else | `errorReasonRemoved` | `playNextEpisode` | `watch.backToShow` |
| 101 / 150 | Not embeddable | `errorReasonNotEmbeddable` | `playNextEpisode` | `watch.backToShow` |
| 101 / 150 | Private | `errorReasonPrivate` | `playNextEpisode` | `watch.backToShow` |
| 101 / 150 | none / Ready | `errorReasonUnavailable` (signed text) | `playNextEpisode` | `watch.backToShow` |
| 2 | any | `errorReasonBadLink` | `playNextEpisode` | `watch.backToShow` |
| 5 | any | `errorReasonPlayback` | `tryAgain` (un-hide, reload this video) | `watch.backToShow` |
| 153 | any (never flagged) | `errorReasonSite` (no `errorReported`) | `tryAgain` | `watch.backToShow` |
| none (preflight) | `blocked_ae` | `errorReasonUae` | `playNextEpisode` | `watch.backToShow` |
| other | any | `errorReasonGeneric` | `playNextEpisode` | `watch.backToShow` |

No next episode: "Play next episode" is not rendered and "Back to {show}" becomes the primary button.

`role="alert"` on the card root so it is announced once on mount. Focus is not moved.

---

## 5. Admin episodes table: order, renumber, flags (D-13, D-14, D-17, D-04)

Signed picture: `#q13` option A.

### 5.1 Up/down arrows

In the existing actions cell, replacing the `ghost icon-sm` buttons:

- Each arrow: `<Button variant="outline" size="icon-lg" className="border-[var(--line)] bg-white/[0.04] text-[var(--text-dim)] hover:text-[var(--text)] disabled:opacity-35">` → visible 44px circle; icons `ChevronUp` / `ChevronDown` `size-4`. Group `flex items-center gap-2`. No invisible hit-area pseudo (44px is already visible).
- First row: up `disabled`; last row: down `disabled`.
- Actions cell width grows from `w-52` to `w-64` to fit 44 + 8 + 44 + Edit + Archive.
- The existing tooltips stay (`moveUp`, `moveDown`) with `<TooltipContent className="text-[11px]">`; `aria-label` stays (`moveUpAria`, `moveDownAria`, with `isolate(title)`).

Behaviour (D-14 nearest neighbour):
- "Up" swaps numbers with the nearest lower-numbered active episode in the season, "Down" with the nearest higher one, whatever the gap (season 1, 2, 4: moving 4 up gives the moved row number 2 and the other row number 4).
- Optimistic: rows re-sort at once.
- Pending: every arrow in that season's table is `disabled`; the clicked arrow shows `Loader2 size-4 animate-spin motion-reduce:animate-none` instead of its chevron.
- Success: the moved row gets `bg-[var(--uis-primary-soft)]` for 1200ms, then fades back (`transition-colors duration-700`; under reduced motion it switches off without fade). A visually hidden `aria-live="polite"` region in the table says `moved`. Focus stays on the same arrow of the moved row (re-focus by episode id after re-render).
- Failure: rows snap back to the server order; `toast.error(moveFailed)` with the server reason; no highlight.

### 5.2 Renumber 1 to N

- Where: season panel in `season-tabs.tsx`, in the action group with "Edit season" and "Add episode", placed first.
- Shown only when the season's active episode numbers are not exactly 1..N. Otherwise not rendered.
- Button: `<Button variant="outline" className="text-sm font-bold">` (44px) with `ListOrdered size-4 me-1` + `renumberButton`.
- Gap hint on the line of the existing episode count, `ms-2 text-[11px] text-[var(--text-mute)]`: `gapsHint`.
- Click opens its own `<Dialog>` (not `ConfirmDialog`, so the archive dialogs are untouched):
  - `<DialogTitle className="text-[20px] leading-tight font-bold">` `renumberTitle`; `<DialogDescription className="text-sm leading-normal">` `renumberDescription`.
  - List `mt-4 max-h-48 space-y-1 overflow-y-auto` of changed episodes only; each row `flex items-center gap-3 rounded-[12px] bg-[var(--bg-2)] px-3 py-2 text-sm`: `renumberChange` then the title `truncate` (`<bdi>`). At most 8 rows, then `text-sm text-[var(--text-mute)]` `renumberMore`.
  - Footer: `<Button variant="outline" className="text-sm font-bold">` `common.cancel`; `<Button className="text-sm font-bold">` `renumberConfirm` (loading: `Loader2 size-4` + `admin.confirmDialog.processing`).
- Success: dialog closes, `toast.success(renumberDone)`, `router.refresh()`. Failure: dialog stays open, `mt-4 text-sm text-brand-red-safe` `role="alert"` under the list with `renumberFailed`.

### 5.3 "Can't play" badge (D-17)

In the status cell, under the existing `StatusBadge`, block `mt-2 flex flex-col items-start gap-1`:
- Bad chip with `CircleAlert size-4` at start + `cantPlayBadge`.
- Reason line `text-[11px] text-[var(--text-mute)] max-w-[180px]`: `cantPlayReason`, where `{reason}` is one of `status.private`, `status.removed`, `status.notEmbeddable`, `status.blockedUae`, `status.notReady`, or `cantPlayViewerReport` when the flag came from a viewer error report (D-11).
- No hiding, no unpublish button (D-17 "flag only").

### 5.4 "Needs English title" mark (D-04)

In the title cell, after the title / Arabic title lines: warn chip `status.needsEnglishTitle`, `mt-2`. Rule: `title` contains Arabic script. When the mark is present, Edit opens the form with focus in the Title field (`setFocus('title')` after open).

### 5.5 Dashboard count

New `AdminPanel` "YouTube check" between the profile card and the shows table on `/admin`:

- Header row `flex items-center justify-between gap-4`: overline 11px uppercase `youtubeCheckTitle`; at end `flex items-center gap-2`: `text-[11px] text-[var(--text-mute)]` `lastCheck`, plus warn chip `checkOverdue` when the last check is older than 36 hours.
- Body, `mt-3`:
  - All good: `flex items-center gap-2`: ok chip `allPlay` + `text-sm text-[var(--text-dim)]` `allPlayBody`.
  - Some broken: bad chip `cantPlayCount`, then a list `mt-3 divide-y divide-[var(--line)]` of up to 5 entries, each a `Link` to `/admin/shows/{showId}` `flex min-h-11 items-center justify-between gap-3 text-sm`: `<bdi>{show}</bdi> · seasonEpisodeShort` at start, reason chip at end. More than 5: `text-sm text-[var(--text-mute)]` `cantPlayMore`.
  - Never checked: `flex items-center gap-2`: neutral chip `notCheckedChip` + `text-sm text-[var(--text-dim)]` `notCheckedBody`.

---

## 6. Settings: editable YouTube key (D-15, D-20; changed by Koss at plan gate G6)

Pictures: `mockups/06-g6-key-missing.png`, `06-g6-key-editing.png`, `06-g6-key-saved.png`, `06-g6-key-test.png`. Supersedes the read-only row signed in `#q15`.

Replaces the YouTube `IntegrationRow` in `settings/advanced-tab.tsx`. It is its own small form (not part of the integrations `<form>`), saved by an admin-only server action. The UI never receives the key: only `hasKey: boolean` and `last4: string | null`.

Layout:
- Overline 11px uppercase `mb-2`: `youtubeKeyTitle`.
- Card `rounded-[12px] border border-[var(--line)] bg-[var(--bg-2)] px-4 py-3 flex flex-col gap-3`:
  - Row 1 `flex items-center gap-3`: status chip (start) + text `flex-1 min-w-0 text-sm text-[var(--text-dim)]` (`keyHelp`).
  - Row 2 `flex flex-col gap-2 sm:flex-row sm:items-center`:
    - Field: reuse `secret-field.tsx`, updated. `<Input type="password" autoComplete="off" spellCheck={false} className="h-11 rounded-[8px] pe-12 font-mono text-sm">` with the show/hide eye **inside the field on the end side** (`absolute end-0 top-0 size-11`, `Eye` / `EyeOff` `size-4`, `aria-label` `revealValue` / `hideValue`, `aria-pressed`). Label `<Label>` (11px uppercase override) `keyLabel`, placeholder `keyPlaceholder`.
    - Saved state: the field shows `keySavedMasked` (`•••• {last4}`) read-only, `font-mono`, with `<Button variant="outline" className="px-6 text-sm font-bold">` `changeKey` (44px). Change clears the field and focuses it; Esc or `cancelChange` returns to the saved state.
    - Buttons (end, `w-full` under 640px): primary `saveKey` (disabled while empty or unchanged) and outline `testKey`.
  - Row 3 `aria-live="polite"` `text-sm`: last test line (`lastTestOk` / `lastTestFailed` + `testReason.*`) or `notTested`.

| State | Chip | Field | Buttons | Row 3 |
|-------|------|-------|---------|-------|
| Key missing | bad `keyMissing` | empty, masked, eye | Save (disabled until typed), Test (disabled) | `missingBody` |
| Editing | unchanged | masked dots; eye toggles plain text | Save enabled, Test disabled until saved | unchanged |
| Saving | unchanged | read-only | Save shows `Loader2 size-4` + `savingKey`, both disabled | unchanged |
| Saved | ok `keySet` | `•••• abcd` read-only + Change | Test enabled | `keySavedJust` (once), then the last-test line |
| Test running | unchanged | unchanged | Test shows `Loader2` + `testingButton`, disabled | `testing` |
| Test ok | ok `keySet` | unchanged | enabled | `lastTestOk` (`text-[var(--safe-green)]` icon `Check size-4` + text in `--text-dim`) |
| Test failed | bad `testFailed` | unchanged | enabled | `lastTestFailed` with reason |
| Save failed | unchanged | keeps the typed value (still masked) | enabled | `saveFailed` with reason |

Rules:
- The plaintext key is never sent back to the browser after save, never rendered in the DOM except while the admin is typing it, never logged, never put in a toast or audit row (audit: `youtube_key_changed` + last 4 only).
- Saving runs a cheap format check first (`^AIza[0-9A-Za-z_-]{35}$`, refused with `formatInvalid`) and does not call YouTube; Test key is separate (1 unit).
- Saving a new key resets the last-test line to `notTested`.
- 44px targets everywhere; the eye's focus ring stays inside the field.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA (import) | "Import 21 episodes as drafts" (`admin.youtubeImport.importButton`) |
| Primary CTA (after import) | "Schedule these 21 episodes" |
| Primary CTA (viewer) | "Play now" (up next), "Play next episode" (error) |
| Empty state heading | Import sheet before a link: no heading; body "Paste a playlist link to see its videos here." |
| Empty state body | "Every video in this playlist is already on Clickit." / "Nothing new to import." |
| Error state | Problem + next step, e.g. "This playlist is private or doesn't exist. Set it to Unlisted or Public on YouTube, then try again." |
| Destructive confirmation | None in this phase. Renumber is confirmed but not destructive: "Renumber episodes 1 to 9?" → "Episodes keep their order and get the numbers 1 to 9. Viewers will see the new numbers. The change is saved in the audit log." |

Every string below is new or replaced. Keys are relative to the namespace in the heading. ICU: English `one/other` (plus `=0` where noted); Arabic full `zero/one/two/few/many/other` where a counted noun appears, following `admin.scheduleEpisodes`. Every number argument is `{n, number}` or `#` (Typography digit rule). Names are wrapped in `<bdi>` tags (Typography mixed-script rule). Arabic is MSA; the brand is "كليك إت" (as in existing `ar.json`); YouTube Studio terms use YouTube's own Arabic UI words (عام، غير مُدرج، خاص، السماح بالتضمين).

### `admin.youtubeImport`

| Key | EN | AR |
|-----|----|----|
| openButton | Import season from YouTube | استيراد موسم من يوتيوب |
| title | Import a season from YouTube | استيراد موسم من يوتيوب |
| description | Nothing is saved until you press Import. Episodes land as drafts. | لن يُحفظ أي شيء حتى تضغط «استيراد». تُضاف الحلقات كمسودات. |
| linkLabel | Playlist link | رابط قائمة التشغيل |
| linkPlaceholder | https://www.youtube.com/playlist?list=… | https://www.youtube.com/playlist?list=… |
| targetLabel | Put into | أضِف إلى |
| targetNewSeason | New season · Season {number, number} | موسم جديد · الموسم {number, number} |
| targetExistingSeason | Season {number, number} · <bdi>{title}</bdi> | الموسم {number, number} · <bdi>{title}</bdi> |
| seasonTitleLabel | Season title (from playlist) | عنوان الموسم (من قائمة التشغيل) |
| seasonTitlePlaceholder | Filled in from the playlist | يُملأ من قائمة التشغيل |
| seasonTitleRequired | Give the new season a title. | أدخل عنواناً للموسم الجديد. |
| appendNote | New episodes go after episode {last, number}. | تُضاف الحلقات الجديدة بعد الحلقة {last, number}. |
| appendNoteEmpty | New episodes start at episode {first, number}. | تبدأ الحلقات الجديدة من الحلقة {first, number}. |
| summaryReady | {count, number} ready | جاهز: {count, number} |
| summaryCantPlay | {count, number} can't play | يتعذّر تشغيله: {count, number} |
| summaryAlready | {count, number} already on Clickit | موجود على كليك إت: {count, number} |
| readMeta | {videos, plural, one {# video} other {# videos}} · {pages, plural, one {# page read} other {# pages read}} | الفيديوهات: {videos, number} · الصفحات المقروءة: {pages, number} |
| reading | Reading the playlist… page {page, number} | جارٍ قراءة قائمة التشغيل… الصفحة {page, number} |
| numberingNote | {count, plural, one {This becomes episode {first, number} of Season {season, number}.} other {These become episodes {first, number} to {last, number} of Season {season, number}.}} | {count, plural, one {ستصبح هذه الحلقة رقم {first, number} في الموسم {season, number}.} other {ستصبح هذه الحلقات من {first, number} إلى {last, number} في الموسم {season, number}.}} |
| titleColumn | Title | العنوان |
| timeColumn | Time | المدة |
| statusColumn | Status | الحالة |
| selectAllAria | Select all ready videos | تحديد كل الفيديوهات الجاهزة |
| rowSelectAria | Import <bdi>{title}</bdi> | استيراد <bdi>{title}</bdi> |
| visibilityPublic | Public | عام |
| visibilityUnlisted | Unlisted | غير مُدرج |
| arabicTitle | Arabic title | عنوان عربي |
| reason.private | Set it to Unlisted or Public, then import again | اجعله «غير مُدرج» أو «عام» ثم استورده مجدداً |
| reason.removed | Deleted from YouTube or no longer available | حُذف من يوتيوب أو لم يعد متاحاً |
| reason.notEmbeddable | Embedding is off. Turn on "Allow embedding" in YouTube Studio | التضمين متوقف. فعّل «السماح بالتضمين» في YouTube Studio |
| reason.blockedUae | YouTube blocks this video in the UAE | يحجب يوتيوب هذا الفيديو في الإمارات |
| reason.processing | Still processing on YouTube. Import again when it's done | ما زال قيد المعالجة على يوتيوب. استورده مجدداً عند اكتماله |
| reason.premieres | Premieres {date}. Import again after that | العرض الأول في {date}. استورده مجدداً بعد ذلك |
| reason.alreadyOnClickit | <bdi>{show}</bdi> · Season {season, number} · Episode {episode, number} | <bdi>{show}</bdi> · الموسم {season, number} · الحلقة {episode, number} |
| emptyBeforeLink | Paste a playlist link to see its videos here. | الصق رابط قائمة تشغيل لتظهر فيديوهاتها هنا. |
| allAlreadyHeading | Every video in this playlist is already on Clickit. | كل فيديوهات قائمة التشغيل هذه موجودة على كليك إت. |
| allAlreadyBody | Nothing new to import. Add new videos to the playlist on YouTube first. | لا جديد للاستيراد. أضف فيديوهات جديدة إلى قائمة التشغيل على يوتيوب أولاً. |
| noneImportable | None of these videos can be imported yet. Fix them on YouTube, then paste the link again. | لا يمكن استيراد أي من هذه الفيديوهات بعد. أصلحها على يوتيوب ثم الصق الرابط مجدداً. |
| importButton | {count, plural, =0 {Import episodes as drafts} one {Import # episode as a draft} other {Import # episodes as drafts}} | {count, plural, =0 {استيراد الحلقات كمسودات} one {استيراد حلقة واحدة كمسودة} two {استيراد حلقتين كمسودتين} few {استيراد # حلقات كمسودات} many {استيراد # حلقة كمسودات} other {استيراد # حلقة كمسودات}} |
| importing | Importing… | جارٍ الاستيراد… |
| successHeading | {count, plural, one {# episode added as a draft} other {# episodes added as drafts}} | {count, plural, one {أُضيفت حلقة واحدة كمسودة} two {أُضيفت حلقتان كمسودتين} few {أُضيفت # حلقات كمسودات} many {أُضيفت # حلقة كمسودات} other {أُضيفت # حلقة كمسودات}} |
| successBody | They're in <bdi>{season}</bdi> as drafts. Viewers can't see them until they're scheduled or published. | أصبحت في <bdi>{season}</bdi> كمسودات، ولن يراها المشاهدون حتى تُجدوَل أو تُنشر. |
| successNeedsEnglish | {count, plural, one {# needs an English title before it goes live.} other {# need an English title before they go live.}} | تحتاج إلى عنوان إنجليزي قبل النشر: {count, number} |
| scheduleButton | {count, plural, one {Schedule this episode} other {Schedule these # episodes}} | {count, plural, one {جدولة هذه الحلقة} two {جدولة هاتين الحلقتين} few {جدولة هذه الحلقات الـ#} many {جدولة هذه الحلقات الـ#} other {جدولة هذه الحلقات الـ#}} |
| done | Done | تم |

### `admin.youtubeStatus` (chips, shared by import, table, dashboard)

| Key | EN | AR |
|-----|----|----|
| ready | Ready | جاهز |
| private | Private | خاص |
| removed | Removed | محذوف |
| notEmbeddable | Not embeddable | التضمين متوقف |
| blockedUae | Blocked in UAE | محجوب في الإمارات |
| notReady | Not ready | غير جاهز |
| alreadyOnClickit | Already on Clickit | موجود على كليك إت |
| needsEnglishTitle | Needs English title | يحتاج عنواناً إنجليزياً |

### `admin.youtubeErrors` (import sheet and single-link add)

| Key | EN | AR |
|-----|----|----|
| notAPlaylistLink | This isn't a YouTube playlist link. Paste a link with list= in it, like youtube.com/playlist?list=… | هذا ليس رابط قائمة تشغيل على يوتيوب. الصق رابطاً يحتوي على list= مثل youtube.com/playlist?list=… |
| videoLinkInImport | This link is one video. To add one episode, use Add episode. To import a season, paste the playlist link. | هذا الرابط لفيديو واحد. لإضافة حلقة واحدة استخدم «إضافة حلقة»، ولاستيراد موسم الصق رابط قائمة التشغيل. |
| playlistPrivate | This playlist is private or doesn't exist. Set it to Unlisted or Public on YouTube, then try again. | قائمة التشغيل هذه خاصة أو غير موجودة. اجعلها «غير مُدرجة» أو «عامة» على يوتيوب ثم أعد المحاولة. |
| emptyPlaylist | This playlist has no videos. Add videos on YouTube, then paste the link again. | لا تحتوي قائمة التشغيل هذه على أي فيديو. أضف فيديوهات على يوتيوب ثم الصق الرابط مجدداً. |
| quota | YouTube's daily limit for Clickit is used up. Try again tomorrow. | استُنفد الحد اليومي المخصص لكليك إت على يوتيوب. أعد المحاولة غداً. |
| keyMissing | The YouTube key isn't set, so YouTube can't be checked. Save a key in Settings › Advanced. | مفتاح يوتيوب غير مُعدّ، لذا يتعذّر التحقق من يوتيوب. احفظ مفتاحاً في الإعدادات › متقدّم. |
| keyRejected | YouTube rejected the key. Check it in Settings › Advanced. | رفض يوتيوب المفتاح. تحقّق منه في الإعدادات › متقدّم. |
| network | YouTube didn't answer. Try again in a minute. | لم يستجب يوتيوب. أعد المحاولة بعد دقيقة. |
| importFailed | Import failed and no episodes were added. {reason} Press Import to try again. | فشل الاستيراد ولم تُضف أي حلقة. {reason} اضغط «استيراد» لإعادة المحاولة. |
| retry | Try again | أعد المحاولة |
| openSettings | Open Settings | فتح الإعدادات |
| notAVideoLink | This isn't a YouTube video link. Paste a link like youtube.com/watch?v=… or youtu.be/… | هذا ليس رابط فيديو على يوتيوب. الصق رابطاً مثل youtube.com/watch?v=… أو youtu.be/… |
| playlistLinkInForm | This is a playlist link. Paste one video's link, or use Import season from YouTube for the whole playlist. | هذا رابط قائمة تشغيل. الصق رابط فيديو واحد، أو استخدم «استيراد موسم من يوتيوب» للقائمة كاملة. |
| videoNotFound | YouTube has no video at this link. Check the link, or pick another video. | لا يوجد فيديو على يوتيوب بهذا الرابط. تحقّق من الرابط أو اختر فيديو آخر. |
| videoPrivate | This video is private. Set it to Unlisted or Public on YouTube, then try again. | هذا الفيديو خاص. اجعله «غير مُدرج» أو «عام» على يوتيوب ثم أعد المحاولة. |
| videoNotEmbeddable | This video can't play on other sites. Turn on "Allow embedding" in YouTube Studio, then try again. | لا يمكن تشغيل هذا الفيديو على مواقع أخرى. فعّل «السماح بالتضمين» في YouTube Studio ثم أعد المحاولة. |
| videoBlockedUae | YouTube blocks this video in the UAE, so viewers here can't play it. Change its country settings on YouTube, or pick another video. | يحجب يوتيوب هذا الفيديو في الإمارات، فلن يتمكن المشاهدون هنا من تشغيله. غيّر إعدادات البلدان على يوتيوب أو اختر فيديو آخر. |
| videoNotReady | This video is still processing or hasn't premiered yet. Try again when it's live on YouTube. | ما زال هذا الفيديو قيد المعالجة أو لم يُعرض بعد. أعد المحاولة عندما يصبح متاحاً على يوتيوب. |
| videoDuplicate | This video is already on Clickit: <bdi>{show}</bdi> · Season {season, number} · Episode {episode, number}. Pick another video. | هذا الفيديو موجود على كليك إت: <bdi>{show}</bdi> · الموسم {season, number} · الحلقة {episode, number}. اختر فيديو آخر. |

### `admin.episodeForm` (additions / replacements)

| Key | EN | AR |
|-----|----|----|
| needsEnglishTitleHint | The English site shows this text until you write an English title. | يعرض الموقع الإنجليزي هذا النص حتى تكتب عنواناً إنجليزياً. |
| notSavedToast | Episode not saved. Check the YouTube link. | لم تُحفظ الحلقة. تحقّق من رابط يوتيوب. |
| toastNoYoutubeKeyDescription (replace) | Save a key in Settings › Advanced. | احفظ مفتاحاً في الإعدادات › متقدّم. |

### `admin.episodesTable` (additions)

| Key | EN | AR |
|-----|----|----|
| moved | <bdi>{title}</bdi> is now episode {number, number} | أصبحت <bdi>{title}</bdi> الحلقة {number, number} |
| moveFailed | Couldn't move <bdi>{title}</bdi>, so the order is unchanged. {reason} Refresh the page and try again. | تعذّر نقل <bdi>{title}</bdi>، فلم يتغير الترتيب. {reason} حدّث الصفحة وأعد المحاولة. |
| renumberButton | Renumber {first, number} to {count, number} | إعادة الترقيم من {first, number} إلى {count, number} |
| gapsHint | Numbers have gaps: {numbers} | في الترقيم فجوات: {numbers} |
| renumberTitle | Renumber episodes {first, number} to {count, number}? | إعادة ترقيم الحلقات من {first, number} إلى {count, number}؟ |
| renumberDescription | Episodes keep their order and get the numbers {first, number} to {count, number}. Viewers will see the new numbers. The change is saved in the audit log. | تحافظ الحلقات على ترتيبها وتأخذ الأرقام من {first, number} إلى {count, number}. سيرى المشاهدون الأرقام الجديدة، ويُسجَّل التغيير في سجل التدقيق. |
| renumberChange | Episode {from, number} → Episode {to, number} | الحلقة {from, number} ← الحلقة {to, number} |
| renumberMore | and {count, number} more | و{count, number} أخرى |
| renumberConfirm | Renumber episodes | إعادة ترقيم الحلقات |
| renumberDone | Episodes renumbered {first, number} to {count, number} | أُعيد ترقيم الحلقات من {first, number} إلى {count, number} |
| renumberFailed | Renumber failed, so nothing changed. {reason} Refresh the page and try again. | فشلت إعادة الترقيم، فلم يتغير شيء. {reason} حدّث الصفحة وأعد المحاولة. |
| cantPlayBadge | Can't play | يتعذّر تشغيلها |
| cantPlayReason | {reason} · checked {date} | {reason} · فُحصت في {date} |
| cantPlayViewerReport | Reported by a viewer | أبلغ عنها مشاهد |

### `admin.dashboard` (additions)

| Key | EN | AR |
|-----|----|----|
| youtubeCheckTitle | YouTube check | فحص يوتيوب |
| lastCheck | Checked {date} | فُحص في {date} |
| allPlay | All episodes play | كل الحلقات تعمل |
| allPlayBody | Every published episode can play. | يمكن تشغيل كل الحلقات المنشورة. |
| cantPlayCount | {count, plural, one {# episode can't play} other {# episodes can't play}} | {count, plural, zero {لا توجد حلقة يتعذّر تشغيلها} one {حلقة واحدة يتعذّر تشغيلها} two {حلقتان يتعذّر تشغيلهما} few {# حلقات يتعذّر تشغيلها} many {# حلقة يتعذّر تشغيلها} other {# حلقة يتعذّر تشغيلها}} |
| cantPlayMore | and {count, number} more | و{count, number} أخرى |
| notCheckedChip | Not checked yet | لم يُفحص بعد |
| notCheckedBody | The daily check hasn't run yet. | لم يُجرَ الفحص اليومي بعد. |
| checkOverdue | Check overdue | الفحص متأخر |

### `admin.settings` (YouTube block; removes `getKey`, `apiKeyLabel`, `apiKeyPlaceholder`, `apiKeyHint`, `youtubeApiDescription`, `storedInCloudflare`)

| Key | EN | AR |
|-----|----|----|
| youtubeKeyTitle | YouTube Data API | YouTube Data API |
| keySet | Key set | المفتاح مُعدّ |
| keyMissing | Key missing | المفتاح مفقود |
| testFailed | Test failed | فشل الاختبار |
| keyHelp | Paste the key from Google Cloud. It's stored encrypted and only the server can read it. Changes work right away. | الصق المفتاح من Google Cloud. يُخزَّن مشفّراً ولا يقرؤه إلا الخادم. تسري التغييرات فوراً. |
| keyLabel | API key | مفتاح API |
| keyPlaceholder | Paste the key (starts with AIza) | الصق المفتاح (يبدأ بـ AIza) |
| keySavedMasked | •••• {last4} | •••• {last4} |
| changeKey | Change key | تغيير المفتاح |
| cancelChange | Keep current key | الإبقاء على المفتاح الحالي |
| saveKey | Save key | حفظ المفتاح |
| savingKey | Saving… | جارٍ الحفظ… |
| keySavedJust | Key saved. Press Test key to check it. | حُفظ المفتاح. اضغط «اختبار المفتاح» للتحقق منه. |
| saveFailed | The key wasn't saved. {reason} Try again. | لم يُحفظ المفتاح. {reason} أعد المحاولة. |
| formatInvalid | This doesn't look like a YouTube API key. Copy it again from Google Cloud (it starts with AIza). | لا يبدو هذا مفتاح YouTube API. انسخه مجدداً من Google Cloud (يبدأ بـ AIza). |
| missingBody | Import and the daily video check are off until a key is saved. | الاستيراد والفحص اليومي للفيديوهات متوقفان حتى يُحفظ مفتاح. |
| notTested | Not tested yet | لم يُختبر بعد |
| lastTestOk | Last test: {date} · key works | آخر اختبار: {date} · المفتاح يعمل |
| lastTestFailed | Last test: {date} · failed. {reason} | آخر اختبار: {date} · فشل. {reason} |
| testKey | Test key | اختبار المفتاح |
| testingButton | Testing… | جارٍ الاختبار… |
| testing | Asking YouTube… | جارٍ سؤال يوتيوب… |
| testReason.rejected | YouTube rejected the key. Check it in Google Cloud, then save it again. | رفض يوتيوب المفتاح. تحقّق منه في Google Cloud ثم احفظه مجدداً. |
| testReason.apiNotAllowed | The key isn't allowed to use YouTube Data API v3. Fix its restriction in Google Cloud. | المفتاح غير مسموح له باستخدام YouTube Data API v3. صحّح قيوده في Google Cloud. |
| testReason.quota | Today's YouTube limit is used up. It resets at {time} UAE time. | استُنفد حد يوتيوب لهذا اليوم. يُعاد ضبطه الساعة {time} بتوقيت الإمارات. |
| testReason.network | YouTube didn't answer. Test again in a minute. | لم يستجب يوتيوب. اختبر مجدداً بعد دقيقة. |
| revealValue / hideValue | (existing keys, reused) | |

### `player` (additions)

| Key | EN | AR |
|-----|----|----|
| seasonEpisodeLong | Season {season, number} · Episode {episode, number} | الموسم {season, number} · الحلقة {episode, number} |
| seasonLabel | Season {number, number} | الموسم {number, number} |
| episodeOfTotal | Episode {current, number} of {total, number} | الحلقة {current, number} من {total, number} |
| resumedAt | Resumed at {time} | استُؤنف التشغيل من {time} |
| startFromBeginning | Start from the beginning | ابدأ من البداية |
| startOver | Start over | ابدأ من جديد |
| finished | Finished | انتهت الحلقة |
| upNextEyebrow | Up next · Season {season, number} · Episode {episode, number} | التالية · الموسم {season, number} · الحلقة {episode, number} |
| upNextAnnounce | {seconds, plural, one {Next episode starts in # second} other {Next episode starts in # seconds}} | {seconds, plural, one {تبدأ الحلقة التالية خلال ثانية واحدة} two {تبدأ الحلقة التالية خلال ثانيتين} few {تبدأ الحلقة التالية خلال # ثوانٍ} many {تبدأ الحلقة التالية خلال # ثانية} other {تبدأ الحلقة التالية خلال # ثانية}} |
| upNextCancel | Cancel | إلغاء |
| watchAgain | Watch again | شاهدها مجدداً |
| upNextDoneEyebrow | Season {season, number} · Episode {episode, number} | الموسم {season, number} · الحلقة {episode, number} |
| seriesEndHeading | You've finished <bdi>{show}</bdi> | أنهيت مشاهدة <bdi>{show}</bdi> |
| seriesEndBody | No more episodes for now. | لا توجد حلقات أخرى حالياً. |
| errorTitle | This episode can't play right now | يتعذّر تشغيل هذه الحلقة الآن |
| errorReasonRemoved | The video was removed from YouTube. | أُزيل الفيديو من يوتيوب. |
| errorReasonPrivate | The video's owner made it private on YouTube. | جعل صاحب الفيديو هذا الفيديو خاصاً على يوتيوب. |
| errorReasonNotEmbeddable | The video's owner doesn't allow it to play outside YouTube. | لا يسمح صاحب الفيديو بتشغيله خارج يوتيوب. |
| errorReasonUnavailable | The video was removed or isn't available in your region. | أُزيل الفيديو أو أنه غير متاح في منطقتك. |
| errorReasonUae | This video isn't available in the UAE. | هذا الفيديو غير متاح في الإمارات. |
| errorReasonBadLink | This episode's video link is broken. | رابط فيديو هذه الحلقة معطّل. |
| errorReasonPlayback | Your browser couldn't play this video. | تعذّر على متصفحك تشغيل هذا الفيديو. |
| errorReasonGeneric | YouTube couldn't play this video. | تعذّر على يوتيوب تشغيل هذا الفيديو. |
| errorReasonSite | Something went wrong on our side. Try again. | حدث خطأ من جهتنا. أعد المحاولة. |
| errorReported | We've told the Clickit team. | أبلغنا فريق كليك إت بذلك. |
| playNextEpisode | Play next episode | شغّل الحلقة التالية |
| tryAgain | Try again | أعد المحاولة |

(The error card's reasons are not standalone: the card always carries its next-step buttons.)

### `watch` (additions)

| Key | EN | AR |
|-----|----|----|
| episodesHeading | Episodes | الحلقات |
| nowPlaying | Now playing | يُعرض الآن |
| watched | Watched | شوهدت |
| minutesLeft | {minutes, plural, one {# min left} other {# min left}} | {minutes, plural, zero {انتهت تقريباً} one {تبقّت دقيقة واحدة} two {تبقّت دقيقتان} few {تبقّت # دقائق} many {تبقّت # دقيقة} other {تبقّت # دقيقة}} |
| notOutYet | Not out yet | لم تُعرض بعد |

Existing keys reused unchanged: `player.autoplayPlayNow`, `player.videoPlayerAria`, `watch.backToShow`, `watch.previousEpisode`, `watch.nextEpisode`, `watch.linkCopied`, `watch.addToWatchlist`, `watch.removeFromWatchlist`, `watch.likeShow`, `watch.unlikeShow`, `watch.shareEpisode`, `common.previous`, `common.cancel`, `common.close`, `episode.minutesAbbr`, `show.seasonEpisodeShort` ("S{season} E{episode}" / "م{season} ح{episode}"), `admin.confirmDialog.processing`. Names passed to reused keys are pre-wrapped with `isolate()`. Keys left unused after this phase (`player.autoplayCountdown`, `player.autoplayCancelButton`, `player.errorVideoUnavailableRetry`, `player.errorVideoNotFound`, `player.errorPlayerRefresh`, `watch.raiseTray`, `watch.lowerTray`, `watch.nowPlayingBadge`) are deleted from both files in the same change.

---

## Motion

| Element | Motion | Reduced motion |
|---------|--------|----------------|
| Import sheet open/close | Primitive slide (existing) | Primitive (MotionConfig + tw-animate respect the setting) |
| Skeleton rows | `animate-pulse` (primitive) | `motion-reduce:animate-none` |
| Spinners | `animate-spin` | `motion-reduce:animate-none` (static icon) |
| Moved row highlight | colour fade 700ms | instant off after 1200ms |
| Countdown ring | linear `stroke-dashoffset`, 1s per step | no ring, no countdown, no auto-advance |
| Card swap (player ↔ card) | none (instant swap; no cross-fade over the iframe) | none |
| Rail scroll to current | smooth | `behavior: 'auto'` |

Hover/focus transitions 180–260ms with `var(--ease)` (DESIGN.md).

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none added; uses existing `sheet`, `table`, `checkbox`, `select`, `dialog`, `button`, `input`, `label`, `skeleton`, `tooltip` | not required |
| @react-bits (declared in `components.json`) | none | Nothing may be pulled from `@react-bits` (or any other third-party registry) in this phase. A plan or executor step that runs `npx shadcn add @react-bits/…` violates this contract |

---

## Planner notes (not owner-visible)

1. `progressMap` must carry saved seconds per episode, not only percent and completed, so switching resumes (D-10).
2. The scheduler (`ScheduleEpisodesButton` / `previewShowSchedule` / `applyShowSchedule`) needs an optional `episodeIds` filter so "Schedule these N episodes" previews only the imported drafts.
3. `unique (season_id, episode_number)` also covers archived rows; `renumber_season` must handle archived numbers so "1 to N" stays true.
4. `RouteScopedToaster` replaces the direct `<Toaster>` in `src/app/[locale]/layout.tsx`.
5. Key test result and time need a stored location (read-only status, D-15).
6. Mixed-script and digit rules: add one `isolate()` helper and one `formatClock()` helper, used everywhere above.
7. Watch page server read: the ids of visible episodes whose stored `youtube_status` is `blocked_ae` (admin client; the column is not readable by anon/authenticated), passed to the shell. Only `blocked_ae` gates loading; other statuses do not.
8. `classifyPlayerError`: 153 → generic card, not reportable; all other codes reportable.
9. 06-RESEARCH.md Pattern 8 flags a policy risk on D-09 (hiding YouTube's end screen) and proposes an `ENDED_MODE` switch; this contract specifies the signed `card-replaces-player` mode only.

---

## Owner-visible deviations

### Differs from the signed picture

1. **Import table "#" column.** Kept as the playlist position (the picture numbers skipped rows too). The episode numbers the import will assign are in an added line under the summary ("These become episodes 5 to 25 of Season 3").
2. **Reason "Music claim: blocked in the UAE".** YouTube doesn't say why, so the row reads "YouTube blocks this video in the UAE".
3. **Import button position.** The picture shows it beside the season buttons; it goes first in the show page's header actions instead, where the real page keeps its actions.
4. **Phone top bar.** Back, title and share as pictured; Watchlist and Like (not in the phone picture) are kept and sit at the end of the season row in the episode list.
5. **Video height.** The picture's 436px at 1280×800 becomes 428px from the rule `min(56.25vw, 100dvh − 372px)`; the episode list scrolls on its own so nothing scrolls over the video.
6. **Up-next and error card text and glow.** The overline on the cards is `--text-dim`, not the picture's grey `--text-mute`, and the show-colour glow is 25% on the end side (the picture had 35% purple behind the text), so text stays readable on every show colour.
7. **Type sizes and weights.** The picture used 12, 13 and 15px in places; everything is 11 / 14 / 20 / 24 at weight 400 or 700. Buttons are 14px bold, as pictured.
8. **Chip padding.** 12px sides instead of the picture's 10px (8-point grid).
9. **Import rows.** 64px tall instead of 62px; header row 44px instead of 40px.
10. **Arrow tooltips** in the admin table stay (not in the picture) at 11px.
11. **Phone admin inputs at 14px.** The import sheet's inputs are 14px on phones as well (the shared input is 16px on phones today); iOS Safari may zoom in when one is tapped.

### New UI with no picture

1. Up-next card after "Cancel": stays, with "Play now" and "Watch again" (YouTube's end screen is never shown).
2. Reduced-motion viewers: the up-next card has no countdown and never plays by itself.
3. Last episode of a show: "You've finished {show}" card with "Watch again" and "Back to {show}".
4. Error card for a browser playback failure (code 5): "Try again" instead of "Play next episode".
5. Error card reasons for private and embedding-off videos, chosen when the stored YouTube status agrees with the error.
6. **Blocked in the UAE: the error card shows before the video loads.** YouTube gives no error for a UAE block, so an episode marked "Blocked in UAE" at the last daily check or import opens straight to the card ("This video isn't available in the UAE.") and the player is not loaded. Removed, private and embedding-off episodes still try to play and show the card only if YouTube actually fails.
7. **Error 153 (a site setup problem): a generic card** "This episode can't play right now / Something went wrong on our side. Try again." with "Try again" and "Back to {show}". It does not say the team was told and never marks the episode as broken.
8. Phone versions of both cards (211px tall): no thumbnail, meta or icon; one-line or two-line titles.
9. Watch page: no auto-hiding bars, no tooltips, no toast pop-ups; Share confirms on its own button.
10. Import sheet states: reading/paging skeletons, empty, nothing new, nothing importable, error banners (private playlist, quota, key missing, key rejected, network, import failed), success panel with "Schedule these N episodes".
11. Import starts reading on paste (no "Read" button).
12. Single-link add: plain refusal messages under the link field and a "Needs English title" hint under the title.
13. Admin table: 1.2s yellow-tint flash on the moved row; "Renumber 1 to N" button (only when numbers have gaps), gap hint, and confirm dialog listing each change; "Can't play" badge with reason and check date; "Needs English title" chip.
14. Dashboard "YouTube check" panel: count, up to five broken episodes, last check time, "Check overdue" after 36 hours.
15. **Editable key field (G6, changed by Koss):** masked input with the eye inside on the end side, Save key, saved state `•••• abcd` with Change key, Test key next to it; states Key missing, editing, saving, saved, test running, test ok, test failed, save failed (pictures `06-g6-key-*.png`).

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
