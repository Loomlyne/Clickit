# Hand-over: Phase 1.1 admin actions hardening (landing)

- Branch: `claude/goofy-mclaren-ec2cf1` (cut from `phase-01.1-admin-actions-hardening-inserted` f793b31, merged `origin/main` cfbc8fb as b01da68).
- Final commit: see `git log -1` on the branch (this file's commit).
- PR: not opened yet. Opens after Koss's UAT pass (controller relays it).

## Gates (2026-10-20)

| Gate | Result |
|------|--------|
| `npm ci` | exit 0 |
| `npm run gate:local` (lint, unit, build with placeholder public Supabase env) | exit 0. Lint 0 errors / 17 warnings; unit 377/377; build ok |
| `npx tsc --noEmit` | exit 0 |
| migrations changed vs main | none |

Logs: `/Users/koss/.clickit-checks/p11-landing-gate.log`, `/Users/koss/.clickit-checks/p11-landing-tsc.log`.
Coverage of the 21 findings: `.planning/phases/01.1-admin-actions-hardening-inserted/01.1-13-SUMMARY.md`.

## Not verified (Ship prerequisites)

- R2 mirroring and `assertPublicMediaWriteReady`: `NEXT_PUBLIC_MEDIA_ORIGIN` is empty locally; unit tests only.
- BotID: bypassed by the dev server.
- Successful Google translation: key empty locally; only the strict-failure path is exercised.
- `public.reorder_episode` on live: unknown. Before Ship, a read-only check on live: `select to_regprocedure('public.reorder_episode(uuid,text)')` (controller/Koss).
- Findings 18 and 19: RED proof is the recorded module-absent run, not a separate RED commit (plan 12 committed tests and core together in b2fee78).

## Local UAT (stack: local `_Clickit` Supabase on 127.0.0.1:55321; app: http://127.0.0.1:3000; no live data)

Fixtures are in `~/clickit-uat-01.1/`.

1. Open http://127.0.0.1:3000/en/auth, create a NEW account with any email ending in `@clickit.local` and a password you choose (local only; do not paste it in chat). Expected: you are signed in.
2. Wait 10 seconds, open http://127.0.0.1:3000/en/admin. Expected: the admin dashboard loads (reload once if it says Unauthorized).
3. Categories: add a category named `UAT Drama`. Expected: it appears in the list.
4. Shows, New show: title `UAT Alpha`, slug `uat-alpha-custom`, Description `UAT`, category `UAT Drama`, save. Add Season 1 and Episode 1 (YouTube id `dQw4w9WgXcQ`). Expected: saved; no "Delete permanently" control appears anywhere for this active show or its episode.
5. Archive the show `UAT Alpha`. Open Admin > Archive. Expected: `UAT Alpha` is listed with "Restore" and "Delete permanently".
6. Shows, New show: title `UAT Alpha`, slug `uat-alpha`, Description `UAT`, save. Expected: saved.
7. Archive, click "Restore" on the archived `UAT Alpha`. Expected: a title conflict prompt. Type the title `UAT Alpha Returns`, leave the slug as it is, confirm. Expected: restored; http://127.0.0.1:3000/en/series/uat-alpha-custom loads with Episode 1.
8. On `UAT Alpha Returns`, archive Episode 1. Open Archive > "Archived episodes". Expected: Episode 1 listed with "Delete permanently"; click it and confirm. Expected: it disappears.
9. Settings > Branding > Favicon: click the upload control. Expected: hint "PNG or ICO. Max 1MB. Use a square image." and SVG files greyed out in the picker. Switch the picker to All Files, choose `~/clickit-uat-01.1/evil.svg`. Expected: error "SVG uploads are not accepted. Upload a raster image (PNG, JPEG, WebP or AVIF; ICO for the favicon)." and the favicon is unchanged.
10. Settings > Branding: upload `~/clickit-uat-01.1/favicon-test.ico` as the Favicon, then `~/clickit-uat-01.1/og-test.jpg` as the "Social share image". Expected: both save without error; previews show a red square and a blue rectangle.
11. Settings > Branding > "Hero video" (desktop): choose `~/clickit-uat-01.1/oversize-60mb.mp4`. Expected: error "Video must be under 50MB"; hero video unchanged. (Browser-side check only; the forged-size server check is a unit test.)
12. Same card: upload `~/clickit-uat-01.1/hero-with-audio.mp4`, wait for success, then click "Remove Video". Expected: upload succeeds, then the hero video is cleared.
13. Settings > General > "Top news ticker": add a line with tag `Breaking`, text `Hello`, Arabic fields blank, save. Expected: warning toast "Saved. 2 Arabic field(s) could not be translated automatically; fill them in by hand." Reload: Arabic fields still blank, not English.
14. Open http://127.0.0.1:3000/en/admin/audit. Expected: rows for create show, archive show, restore show (with the rename), archive episode, delete episode (a pending row and a committed row), favicon and OG uploads, hero upload, hero remove and the ticker update.

Pass word: "approved" / "done" / "correct" / "working". A failure: the step numbers and what was seen.

## After UAT

Stop dev server (PID 66552 wrapper, 66575 node) and poller (66553) by PID; stop the local stack only if no other session needs it (controller decides); delete this worktree's `.env.local` (marker `~/clickit-uat-01.1/.created-env-local-goofy`); then open the PR "Phase 1.1: admin actions hardening" based on `main`. No merge.
