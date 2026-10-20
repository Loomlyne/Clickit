# Phase 4: Claude Design canvas record

The repo is public, so this file names the canvas and holds no link. The link is kept only in the local note on Koss's Mac (never committed).

## Canvas

- Where: private canvas, Koss's account, name 'Clickit Story' (Claude Design, type Design). Not shared. The brand-neutral UI System canvas is not edited (D-06 = A, Q6 final 2026-10-20 18:45 CET).
- Created: 2026-10-20.
- Design system: the published "UI System" is installed on the canvas, namespace `uis`. The copy includes `tokens.json` and the components bundle (css + js); React files are skipped.
- UIS.Root values: `primary="#ffcc00" accent="#ffcc00" neutral="#737373" mode="dark" roundness={50} pill surface="glass"` and `config` = `{ radius: { overrides: { field: 8 } } }`, with `loadFonts={false}` so no Google Fonts load.
- Exact values: inside Root, each board wraps its content in a `.cl` layer from the shared `clickit.css`. That layer pins every `--uis-*` variable the boards use to the live Clickit value from `src/styles/globals.css`, so a derived near value never shows. It covers surfaces, lines, ink, primary/hover/soft, radii, focus and fonts.
- Font method: canvas assets. `lbc-regular.woff2` (400) and `lbc-bold.woff2` (700) are uploaded as canvas assets, and `@font-face` LBC points to the two returned asset paths. No base64 is used.
- Field method: both are applied. The `config` prop sets `radius.overrides.field = 8`, and the `.cl` wrapper pins `--uis-r-field: 8px`. Buttons and controls stay pills (`--uis-r-control: 999px`).

## Spike

| Test | Method used | Result |
|------|-------------|--------|
| 1. Font: LBC 400/700 loads from canvas assets | asset upload + `@font-face` (assets, not base64) | pass (method): both uploads returned asset paths and every board's stylesheet declares them. The 04-14 reviewer could not render either; it confirmed statically that every board links both faces. Seeing LBC on screen is part of Koss's Foundations signature. |
| 2. Field radius 8px, button pill | `config` prop + `--uis-r-field: 8px` wrapper (both) | pass (method): the F4 board mounts `UIS.Input` and `UIS.Button` under this theme next to the live primitives drawn from tokens. The 04-14 reviewer checked the values statically (findings 4-6 fixed); the on-screen check is part of Koss's Foundations signature. |

## Boards

| ID | Title | Frames | Source | Status |
|----|-------|--------|--------|--------|
| F0 | Cover and rules | 1280 | new | built |
| F1 | Colour and brand map | 1280, 375 | live tokens | built |
| F2 | Type, English and Arabic | 1280, 375 | live + Phase 6 | built |
| F3 | Radius and surfaces | 1280, 375 | live tokens | built |
| F4 | Components | 1280 EN, 375 AR | live primitives | built |
| F5 | Spacing, focus, motion | 1280 | live + DESIGN.md | built |
| V1 | Email-code sign-in | 1280, 375, EN + AR | new (Phase 5 #q1 code boxes) | built |
| V2 | Home and show | 1280, 375 | live pages | built |
| V3 | Watch page (YouTube rules) | 1280, 375, EN | reproduced #q8 G1-B (supersedes #q9) #q11 | built |
| V4 | Arabic right-to-left | 1280, 375 | new | built |
| A1 | Playlist import preview | 1280 (sheet 640), 375, EN + AR | reproduced #q1 | built |
| A2 | Episodes order and flags | 1280, 375 | reproduced #q13 | built |
| A3 | YouTube key setting | 1280, 375 | reproduced G6 | built |
| A4 | Inbox | 1280, 375, EN + AR | new | built |
| E0 | Template shell | 600, 375, light + dark | Phase 5 05-q12-schemes | built |
| E1 | Sign-in code | 600, 375, light + dark | Phase 5 05-q12-schemes | built |
| E2 | Confirm signup | 600, 375, light + dark | reproduced Phase 5 05-q12-schemes (expiry, footer as {placeholders}) | built |
| E3 | Reset password | 600, 375, light + dark | Phase 5 05-q12-schemes | built |
| E4 | Email change | 600, 375, light + dark | Phase 5 05-q12-schemes | built |
| E5 | Welcome | 600, 375, light + dark | Phase 5 05-q12-schemes | built |
| E6 | New-episodes digest | 600, 375, light + dark | Phase 5 05-q12-schemes | built |
| E7 | Support auto-reply | 600, 375, light + dark | Phase 5 05-q12-schemes | built |

Shared support file on the canvas: `clickit.css` (the `.cl` token layer and board styles). Every board carries a token legend.

## Legends

Each board's token legend as drawn (label: value). Copied from the board files; no URL.

### F0 (Main)
- Source: live tokens (globals.css, design-truth.ts, brand-colors.ts)
- --bg-0: #090909
- --bg-1: #101010
- --line: rgba(255,255,255,.08)
- --line-2: rgba(255,255,255,.14)
- --text: #F4F4F4
- --text-dim: #CCCCCC
- --text-mute: #A1A1A1
- --primary: #ffcc00
- warn chip: #ffb46e
- rounded-card: 12px
- rounded-chip: 999px
- type: 11 / 14 / 24 · 400 / 700

### F1 (F1-colour)
- Source: live tokens (globals.css, design-truth.ts, brand-colors.ts)
- --bg-0..4: #090909 #101010 #191919 #2A2A2A #424242
- --text / dim / mute: #F4F4F4 #CCCCCC #A1A1A1
- --primary / ink: #ffcc00 / #090909
- hover / soft: #D7AD16 / #312915
- --destructive: #ff3b30
- status ok / bad / warn: #77d586 #ff8b82 #ffb46e
- rounded-card: 12px
- rounded-chip: 999px

### F2 (F2-type)
- Source: live tokens (globals.css, design-truth.ts, brand-colors.ts)
- font: LBC 400 / 700
- display: 24 / 1.2
- heading: 20 / 1.25
- body: 14 / 1.5
- label: 11 / 1.4 · 0.14em
- --text: #F4F4F4
- --text-mute: #A1A1A1
- --line: rgba(255,255,255,.08)

### F3 (F3-radius)
- Source: live tokens (globals.css, design-truth.ts, brand-colors.ts)
- chip / control / shell: 999px
- field: 8px
- media: 11px
- card / panel: 12px / 16px
- soft: 0 24 80 .38
- popover: 0 24 80 .42
- modal: 0 40 120 .6
- --line: rgba(255,255,255,.08)

### F4 (F4-components)
- Source: live tokens (globals.css, design-truth.ts, brand-colors.ts)
- button: min-h 44 · px 18 · 13.5px · rounded-control
- default hover: #FFFFFF
- CTA hover: #D7AD16 + cta-glow
- focus: 2px #ffcc00, 2px offset
- field: 44 · rounded-field 8 · --bg-2 · --line · px 16 · 14 (16 on phones)
- invalid: border --destructive #ff3b30 · message #ff8b82
- popover: --bg-1/98 · 0 24 80 .42
- chip: 11px 700 · 999px

### F5 (F5-spacing)
- Source: live tokens (globals.css, design-truth.ts, brand-colors.ts)
- scale: 4 8 16 24 32 48 64
- exceptions: 12 · 20
- target: 44px (min-h-11)
- focus: 2px #ffcc00 + 2px offset
- field focus: 3px rgba(255,204,0,.25)
- --ease: 0.2 0.8 0.2 1
- durations: 120–260ms
- --bg-0: #090909

### V1 (V1-signin)
- Source: Phase 5 #q1 (46 x 54 code boxes)
- code box: 46 × 54 · rounded-field 8 · --bg-1 · --line-2 (as #q1)
- box focus: #ffcc00 + 3px .25 ring
- error: #ff8b82 role=alert
- expired: warn #ffb46e
- success: #77d586
- field: 44 · 16px on phones
- primary: #ffcc00 / ink #090909
- type: 11 / 14 / 20 / 24

### V2 (V2-home-show)
- Source: live tokens (globals.css, design-truth.ts, brand-colors.ts)
- page: --bg-0 #090909
- nav: full width · --gradient-nav-fade · border-b --line
- Play: #ffcc00 / #090909 · 44px
- More info: white/8 · blur
- poster: rounded-media 11px
- progress: #ffcc00 on white/14
- season pill: active --bg-2 · --line
- category pill: content colour

### V3 (V3-watch)
- Source: Phase 6 #q8 A, G1-B (supersedes #q9), #q11 A
- top bar: 72 / 56 · --bg-0 · --line
- stage: #000 · box ≥ 200 × 200
- control bar: 60 · --bg-1
- up-next bar: --uis-primary-soft #312915
- current episode: outline 2px #ffcc00
- progress: #ffcc00 on white/18
- season pill active: #F4F4F4 / #090909
- error card: --bg-0 + brand glow 25% · ! in --line-2 circle

### V4 (V4-rtl)
- Source: live tokens (globals.css, design-truth.ts, brand-colors.ts)
- direction: dir="rtl" lang="ar"
- hero: bottom-right · start-10
- chevrons: rtl:rotate-180
- code boxes: dir="ltr" 46 × 54
- isolation: <bdi> titles, emails, hex
- tracking: none on Arabic
- primary: #ffcc00
- surfaces: #090909 / #101010 / #191919

### A1 (A1-import)
- Source: Phase 6 #q1
- sheet: 640 · --bg-1 · --line
- table: rounded-card · head 44 --bg-2 · rows 64
- chip ok / bad / warn: #77d586 #ff8b82 #ffb46e at 35/8%
- chip neutral: #A1A1A1 on --line-2
- thumb: 96 × 54 · rounded-media 11
- banner: bad 35/8% · rounded-card
- active nav: #312915 / #ffcc00
- primary: #ffcc00 / #090909

### A2 (A2-episodes)
- Source: Phase 6 #q13 A
- row: thumb 80 × 45 · r8 · Edit, Archive
- disabled arrow: opacity 35%
- moved row: --uis-primary-soft #312915
- can't play: bad #ff8b82
- needs English: warn #ffb46e
- dialog: rounded-panel 16 · shadow-modal
- change row: --bg-2 · rounded-card
- focus: 2px #ffcc00 + offset

### A3 (A3-key)
- Source: Phase 6 G6 (supersedes #q15)
- card: --bg-2 · border --line · rounded-card 12 · 12/16
- field: 44 · rounded-field 8 · mono 14 · eye 44 inside, right
- saved field: •••• last4 · read-only
- Key set / ok line: ok #77d586
- missing / failed: bad #ff8b82
- help, row 3: 14 · --text-dim
- Save: #ffcc00 / #090909 · 14 bold
- Test, Change: outline · 14 bold · Change px 24

### A4 (A4-inbox)
- Source: new (no earlier picture)
- unread dot: 8px #ffcc00 (not red)
- selected thread: --bg-2
- active nav: #312915 / #ffcc00
- message: --bg-1 · rounded-card
- sent reply: #312915
- composer: rounded-field 8 · focus ring .25
- send failed: bad 35/8% banner
- phone bar: h-14 56px

### E0 (E0-shell)
- Source: Phase 5 Q12 picture (signed 2026-10-20 ~19:00 CET)
- light page / card: #F4F4F4 / #FFFFFF
- light header: #090909
- light heading / body / hint: #111111 #333333 #555555
- light rule / footer: #E5E5E5 / #767676
- dark page / card / cardBorder: #090909 #101010 #222222
- dark header / headerRule: #101010 / #222222
- dark heading / body / hint / footer: #F4F4F4 #CCCCCC #A1A1A1 #A1A1A1
- button bg / ink / radius: #ffcc00 / #090909 / 999px

### E1 (E1-code)
- Source: Phase 5 Q12 picture (signed 2026-10-20 ~19:00 CET)
- code box light: #F6F6F6 / #E5E5E5 / #111111
- code box dark: #191919 / #2A2A2A / #ffcc00
- code type: mono 32 · tracking 8 · ltr
- button: #ffcc00 / #090909 · 999px
- heading: #111111 / #F4F4F4
- body: #333333 / #CCCCCC
- hint / url: #555555 / #A1A1A1
- footer: #767676 / #A1A1A1

### E2 (E2-confirm)
- Source: Phase 5 Q12 picture (signed 2026-10-20 ~19:00 CET)
- card: 440 max · radius 12
- header: 20/24 · plate #090909 r6
- body: 24/24/8 · h2 24/1.25 · p 16/1.5
- button: 12/32 · 999px · 16 bold
- url line: 12px
- code: r8 · mono 32 · tracking 8
- footer: 12px · top rule
- colours: EMAIL_TOKENS light / dark

### E3 (E3-reset)
- Source: Phase 5 Q12 picture (signed 2026-10-20 ~19:00 CET)
- page / card light: #F4F4F4 / #FFFFFF
- page / card dark: #090909 / #101010 · border #222222
- heading: #111111 / #F4F4F4
- body: #333333 / #CCCCCC
- hint / url: #555555 / #A1A1A1
- rule: #E5E5E5 / #222222
- footer: #767676 / #A1A1A1
- button: #ffcc00 / #090909 · 999px

### E4 (E4-change)
- Source: Phase 5 Q12 picture (signed 2026-10-20 ~19:00 CET)
- page / card light: #F4F4F4 / #FFFFFF
- page / card dark: #090909 / #101010 · border #222222
- heading: #111111 / #F4F4F4
- body: #333333 / #CCCCCC
- hint / url: #555555 / #A1A1A1
- rule: #E5E5E5 / #222222
- footer: #767676 / #A1A1A1
- button: #ffcc00 / #090909 · 999px

### E5 (E5-welcome)
- Source: Phase 5 Q12 picture (signed 2026-10-20 ~19:00 CET)
- page / card light: #F4F4F4 / #FFFFFF
- page / card dark: #090909 / #101010 · border #222222
- heading: #111111 / #F4F4F4
- body: #333333 / #CCCCCC
- hint / url: #555555 / #A1A1A1
- rule: #E5E5E5 / #222222
- footer: #767676 / #A1A1A1
- button: #ffcc00 / #090909 · 999px

### E6 (E6-digest)
- Source: Phase 5 Q12 picture (signed 2026-10-20 ~19:00 CET)
- thumb: 96 × 54 · r8 · #E5E5E5 / #191919
- show title: 16 bold · #111111 / #F4F4F4
- S/E line: 12 · #555555 / #A1A1A1
- row rule: #E5E5E5 / #222222
- watch link: 14 bold underline
- button: #ffcc00 / #090909 · 999px
- footer links: 12 · #767676 / #A1A1A1
- max rows: 3

### E7 (E7-support)
- Source: Phase 5 Q12 picture (signed 2026-10-20 ~19:00 CET)
- quote light: #F6F6F6 · #E5E5E5 · #333333
- quote dark: #191919 · #2A2A2A · #CCCCCC
- meta labels: 12 bold · heading colour
- meta values: 12 · hint colour
- quote: r8 · 12/14 · 14/1.5
- admin button: #ffcc00 / #090909 · 999px
- footer: #767676 / #A1A1A1
- time: Asia/Dubai

## Review

- Reviewer: `reviewer` agent on Sonnet 5.5 (claude-sonnet-5-5). The boards were built by Opus 5.5. Read-only; it did not render. Date: 2026-10-20.
- Inputs: the Legends above, globals.css, design-truth.ts, brand-colors.ts, email-tokens.ts, the live components, Phase 6 06-mockups.html and 06-UI-SPEC.md (origin/phase-06-youtube-import-player c0750ac), and Phase 5 05-mockups.html and 05-q12-schemes.html (origin/claude/phase-05-accounts-and-email-61ece8 e3a1c83).
- Clean: all 22 legends match their boards; E0-E7 colours match email-tokens.ts; E sizes match the Q12 picture; F1-F3 and F5 match globals.css and design-truth.ts; no URL in this file; every password and key field has an eye.
- Verdict: 17 findings. Each one is listed with its fix below. All fixes were republished to the canvas on 2026-10-20 (Opus).

| # | Board | Finding | Fix |
|---|-------|---------|-----|
| 1 | E1-E5, E7 | `.fine` and E7 `.meta` lost to `.em .eb p` (16px, wrong colour) | Selectors raised to `.em .eb p.fine` / `p.meta`; fine print is 12px in body colour as in the picture; meta is 12px in hint colour. Fixed. |
| 2 | V2, V4 | Nav drawn as a floating pill (rounded-shell, --bg-1/72) | Redrawn as the live full-width header: --gradient-nav-fade, --line bottom border; legend and notes updated. Fixed. |
| 3 | V2, V4 | Desktop hero buttons 13px / px 16 / no blur; title 72px | 15px, px 26, 52 tall, blur 8 on More info; title 77px (clamp at 1280). Phone stays 13px. Fixed. |
| 4 | F4, A1, A3, A4, V1 | Field drawn --bg-1, --line-2, px 14, 15px | Shared `.field` now --bg-2, --line, px 16, 14px (16px on phones), as input.tsx. Fixed. |
| 5 | F4 | Button px 20; invalid border #ff8b82; badges at 700 | `.btn` px 18; invalid border --destructive #ff3b30 (message stays #ff8b82); badges 400, px 10. Fixed. |
| 6 | F4 | Password eye 36 × 36 | 44 × 44, as password-field.tsx. Fixed. |
| 7 | F4, V1, A3 | Arabic eye side: DESIGN.md / 04-UI-SPEC say physical right (owner rule); Phase 6 G6 and password-field.tsx say end side | Boards draw option A (physical right); F4 shows option A and option B side by side. **Open question for Koss**, asked with the Foundations signature. Code is not changed in Phase 4. |
| 8 | A3 | Panel --bg-1 / r16 / p20; stacked layout | Redrawn to Phase 6 §6: card --bg-2, --line border, r12, 12/16; chip and help on row 1; field with Save and Test in one row; last-test line on row 3. Fixed. |
| 9 | V3 | Error card solid --bg-1; no phone progress bars; "Private" row missing | Card --bg-0 plus brand glow at 25% (85% 40%); progress bar inside phone thumbnails; Private row added. Fixed. |
| 10 | A1, chip | Chip px 10 / gap 6; Arabic sheet drops # and Time at ≥640; entry button outline | Chip px 12 / gap 4; Arabic table has # and Time; entry button primary. Fixed. |
| 11 | F0 | Wrong admin and email board names; yellow rule incomplete | Index matches A1-A4 and E0-E7; the yellow rule lists every drawn use. Fixed. |
| 12 | A1 | Row 6 ("Not ready") clipped in the 800px frame | Desktop frames 900px; board 3300px. Fixed. |
| 13 | F5 | Columns 1252px in 1200px; frame clip | Columns 340/340/400; frame 920px. Fixed. |
| 14 | F1-F5 | Board heights about 60-75px short | F1 1600, F2 1500, F3 1300, F4 2150, F5 1220 (canvas.json and files). Fixed. |
| 15 | V1 | Logo "CLICKIT STORY" vs #q1 "CLICK IT STORY"; focus on the 5th box | Logo as #q1; focus on the 4th box holding ٥. Also noted: #q1 drew text fields --bg-1 / --line-2 / 15px, while the live Input is --bg-2 / --line / 14px; the boards follow the live Input, and this is flagged to Phase 5. Fixed. |
| 16 | A2 | No 80 × 45 thumbnails; no Archive | Thumbnails 80 × 45 r8 and an Archive action on every row. Fixed. |
| 17 | V2, V3, V4, A1, A4 | ▶ ⤴ ⚠ may render as colour emoji | Text presentation selector U+FE0E added after each. Fixed. |

Also fixed during the review: E7 said the admin area is English-only. Phase 6 has Arabic admin strings, so the rule now says the admin copy goes out in each admin's language.

Follow-ups outside Phase 4 (not changed here):
- password-field.tsx eye side, depending on Koss's answer to #7.
- Phase 5 text fields should use the live Input values (#15).

## Signatures

Recorded in `04-GATE.md` §3 when Koss signs (04-14).

- Foundations: not signed
- Viewer: not signed
- Admin: not signed
- Email: not signed
