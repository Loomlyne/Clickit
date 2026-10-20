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
| 1. Font: LBC 400/700 loads from canvas assets | asset upload + `@font-face` (assets, not base64) | pass (method): both uploads returned asset paths and every board's stylesheet declares them. The visual check that the glyphs differ from `system-ui` goes in the 04-14 reviewer pass, because Design-type boards are not rendered by the author. |
| 2. Field radius 8px, button pill | `config` prop + `--uis-r-field: 8px` wrapper (both) | pass (method): the F4 board mounts `UIS.Input` and `UIS.Button` under this theme next to the live primitives drawn from tokens. The visual check is in the 04-14 reviewer pass. |

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
| A1 | Playlist import preview | 1280 (sheet 640), 375, EN + AR | reproduced Phase 6 #q1 | not built |
| A2 | Episodes order and flags | 1280, 375 | reproduced Phase 6 #q13 | not built |
| A3 | YouTube key setting | 1280, 375 | reproduced Phase 6 G6 | not built |
| A4 | Inbox | 1280, 375, EN + AR | new | not built |
| E0 | Template shell | 600, 375, light + dark | Phase 5 05-q12-schemes | not built |
| E1 | Sign-in code | 600, 375, light + dark | Phase 5 05-q12-schemes | not built |
| E2 | Confirm signup | 600, 375, light + dark | Phase 5 05-q12-schemes | not built |
| E3 | Reset password | 600, 375, light + dark | Phase 5 05-q12-schemes | not built |
| E4 | Email change | 600, 375, light + dark | Phase 5 05-q12-schemes | not built |
| E5 | Welcome | 600, 375, light + dark | Phase 5 05-q12-schemes | not built |
| E6 | New-episodes digest | 600, 375, light + dark | Phase 5 05-q12-schemes | not built |
| E7 | Support auto-reply | 600, 375, light + dark | Phase 5 05-q12-schemes | not built |

Shared support file on the canvas: `clickit.css` (the `.cl` token layer and board styles). Every board carries a token legend.

## Signatures

Recorded in `04-GATE.md` §3 when Koss signs (04-14).

- Foundations: not signed
- Viewer: not signed
- Admin: not signed
- Email: not signed
