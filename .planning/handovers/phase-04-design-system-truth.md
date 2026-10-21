# Hand-over: Phase 4 Design System Truth

The tokens, DESIGN.md, the admin page `/admin/design-system`, a codemod to tokens across `src/` with the guard rule at error, and the private "Clickit Story" canvas signed by Koss.

- Branch: `claude/phase-04-design-system-truth-26dcc6` (worktree `.claude/worktrees/phase-04-design-system-truth-26dcc6`). It contains `origin/main` c0da1d8 (merged; nothing is pending).
- Final commit: the head of the PR (this file's commit).
- Plans: 04-01 to 04-14 are all done. Each has its SUMMARY under `.planning/phases/04-design-system-truth/`.
- Requirements: DS-02 and DS-03 are complete. DS-01 and DS-04 wait for Koss's browser UAT (below).
- No live writes, no deploys, no migrations (`supabase/` is untouched), no secrets. No canvas URL is in any file; the link is only in `/Users/koss/.clickit-checks/p4-canvas-link.txt`.

## Owner record

- Discuss and plan gate: `04-GATE.md` §1 and §2 (Koss, 2026-10-20 18:48 CET, "all recommended"; Q7 = C via Phase 5 Q12; Q6 = A final).
- Canvas signatures (`04-GATE.md` §3, mirrored in `04-CANVAS.md`): Foundations, Viewer, Admin and Email are each "Koss, 2026-10-21". These are his own answers in the question form, relayed verbatim by the controller.
- Decision: the show/hide eye in an Arabic password field sits on the physical right ("A: right (Recommended)").

## Gates

| Gate | Result |
|------|--------|
| `npm run gate:local` (lint at error, typecheck, test:unit, guard:migrations, build with placeholder public env), heavy lock, detached | final run after the signatures: see `/Users/koss/.clickit-checks/p04-w10-final-gate.log` (head of this PR); the pre-signature run at a986d9e was `exit=0` |
| Wave gates | w4 `p04-w4-gate.log`, w5-w6 `p04-w5-w6-gate.log`, w7-w8 `p04-w7-w8-gate.log`, w9 `p04-w9-gate.log`: all `exit=0` |
| Unit tests | 678 pass, 0 fail (after the PR #28 review fixes) |
| Guard `clickit/no-raw-design-values` | error level; 0 findings in `src/`; no waivers. Widened after the PR #28 review (34dddd9): side/modifier palette prefixes, hsl()/oklch(), named colours in brackets, exact neutral rgb (`_` form); hex only #RGB/#RRGGBB/#RRGGBBAA, fragment links and order numbers skipped; email-folder allowlist removed; a waiver must end in ` -- reason` |
| Independent review of the boards | `reviewer` on Sonnet 5.5, 17 findings, all fixed (`04-CANVAS.md` "## Review") |

## Visible changes (everything else keeps its exact pixel value through tokens)

1. The select popover goes from #11151d to #101010.
2. The toast goes from #10131a to #101010, and its shadow alpha from 0.45 to 0.42.
3. The /portfolio "Browse shows" hover goes from #7082ff to #D7AD16, and its glow from indigo to yellow.
4. The preload cover and the avatar initials go from #0a0a0a to #090909 (one step).
5. A new admin-only page, `/admin/design-system`, with a "Design system" link in the admin sidebar (Operations, after Audit).

## UAT for Koss (numbered; local app, no live data)

1. Signed out, open `/en/admin/design-system`. Expected: you are sent away and no page content shows.
2. Signed in as a viewer, open the same URL. Expected: you land on `/watch`.
3. Signed in as admin, open `/en/admin/design-system`. Expected: five sections and "0 differences".
4. Open `/ar/admin/design-system`. Expected: the page mirrors, and the Arabic samples are in LBC.
5. At 375px width, scroll the page. Expected: no sideways page scroll.
6. On that page, open the Select and press the toast button. Expected: the popover and the toast are #101010.
7. Before and after: home, a show, watch, the admin dashboard and `/portfolio`. Expected: only the five visible changes above.

## Open items (not fixed in Phase 4)

- **F4 Badge default:** ink #090909 on primary/16 is hard to read. Recorded on the canvas only, per the controller.
- **Phase 5, `src/components/auth/password-field.tsx`:** the eye uses `end-0` (left in Arabic). Move it to the physical right (Koss, 2026-10-21).
- **Phase 5, text fields:** the #q1 picture drew them --bg-1 / --line-2 / 15px. The live Input is --bg-2 / --line / 14px (16px on phones), and the signed boards follow the live Input.
- **Phase 5 email templates:** colours come from `src/lib/email-tokens.ts` (every role of the signed 05-q12-schemes picture, pinned by its test). The copy, sender line, expiry, legal footer and logo PNG belong to Phase 5.
- **Deferred:** after Phases 5 and 6 ship, a separate job moves the proven patterns into Loomlyne/ui-system (ROADMAP Phase 4 note). That repo is not changed here.

## For the Phase 2 and Phase 6 branches (PR #27 is open)

- After this lands, new code under `src/` must pass `npm run lint` with the guard at error. Use the named utilities (`rounded-card|field|media|panel|control|shell|chip|hairline`, `shadow-*`, `status-*`). `04-P6-ADDENDUM.md` maps Phase 6's bracket radii and status classes.
- The modified files most likely to conflict are listed in `04-13-SUMMARY.md` ("Files Phase 4 touched"). Added files cannot conflict.
- `.planning/ROADMAP.md` (Phase 4 block and progress row) will conflict with other phase branches: keep both sides.
