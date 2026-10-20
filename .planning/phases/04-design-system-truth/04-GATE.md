# Phase 4 — Design System Truth: gate for Koss

Work session branch `claude/phase-04-design-system-truth-26dcc6`. Planning files only: no code, no database write, no deploy.
Status 2026-10-20: Koss answered "all recommended" in the Phase 4 session (Q1-Q5, Q8 = A; Q9 = yes); Q7 = C via Phase 5 Q12; Q6 changed to C later the same day (via the controller): missing patterns go into the general UI System first. Open: Q10, Q11 (new, from the Q6 change), the plan gate (§2), the UI System track gate (§7) and the canvas signatures (§3).

How the controller records an answer: write the letter and date in the "Koss" column, e.g. `A (Koss, 2026-10-21)`. "All recommended" fills every row with A.

## 1. Discuss decisions (one each, recommended first)

Full wording and examples: `04-DISCUSS-QUESTIONS.md`. Pictures: `mockups/04-q1.png` … `04-q7.png`, `04-q10.png`.

| Q | Decision | A (recommended) | B | Picture | If B, plans that change | Koss |
|---|----------|-----------------|---|---------|-------------------------|------|
| 1 | Page background number | #090909, as live | #0a0a0a (roadmap text) | 04-q1.png | 04-01, 04-05, 04-06, 04-07, 04-09 | A (Koss, 2026-10-20) |
| 2 | Corner shapes | live roles: pill buttons/chips, field 8, card 12, image 11, sheet 16 | 8px everywhere (every button changes; Phase 6 pictures redone) | 04-q2.png | 04-01, 04-04, 04-06, 04-07, 04-09..04-13 | A (Koss, 2026-10-20) |
| 3 | Blue-era leftovers (dropdown #11151d, toast #10131a, /portfolio button hover indigo) | snap to the tokens (only visible changes of the phase) | keep them as listed exceptions | 04-q3.png | 04-01, 04-05, 04-13 | A (Koss, 2026-10-20) |
| 4 | Category colours | stay free (content); one brand map for the app chrome | 6 brand colours only + live rewrite of 15 categories (your word) | 04-q4.png | 04-02, 04-03, 04-06 | A (Koss, 2026-10-20) |
| 5 | In-app design-system page | read-only `/admin/design-system`, admin guard | no page; DESIGN.md + canvas only | 04-q5.png | 04-04 dropped; 04-06 rewords DS-01/DS-04 | A (Koss, 2026-10-20) |
| 6 | Claude Design boards | new "Clickit Story" canvas installing UI System | add to the existing UI System canvas | 04-q6.png | 04-07, 04-08, 04-14, new 04-15 | C (Koss, 2026-10-20) |
| 7 | Email look | dark, like the site | light body, dark header | 04-q7.png | 04-01, 04-06, 04-08 | C (Koss, 2026-10-20) |
| 8 | How you sign the canvas | four signatures (Foundations, Viewer, Admin, Email) | one signature for all | no picture (process) | 04-07, 04-14 | A (Koss, 2026-10-20) |
| 9 | LBC font licence | yes: the LBC licence allows uploading the two font files to a private Claude Design canvas | no: boards use a system-font stand-in and are reviewed against the live site for type | no picture (licence) | 04-07 | yes (Koss, 2026-10-20) |
| 10 | What Clickit adds to the general UI System first | all nine parts (CodeInput, SecretInput, CountdownBar, SelectableTable, ReorderList, Skeleton, TotpSetup, Inbox, own font files) | the same without Inbox (added with Phase 7) | 04-q10.png | 04-UIS-TRACK.md scope, 04-15, 04-08 (A4 board drawn without the UI System Inbox) | |
| 11 | Phase 6 is already building its screens | Phase 6 keeps going; a small follow-up swaps its own parts for the UI System parts, pixel for pixel | Phase 6 pauses its screen tasks until the UI System release | no picture (process) | 04-P6-ADDENDUM.md (from 04-06), Phase 6 plans | |

Q6 note: Koss changed Q6 after "all recommended" (relayed by the controller, his words): "The UI system is general, so if those are missing from the UI system, that will make the design system more powerful. Add them, with the design system colors and style, and then implement those into the program, to the Clickit here." Recorded as C: every pattern Clickit needs that the UI System lacks goes into the general UI System first (own repo track, `04-UIS-TRACK.md`, gate §7); Clickit adopts it with its theme (04-15); the private "Clickit Story" canvas is built from those parts; Phase 5/6 signed pictures stay the target. Q10 and Q11 follow from it. Koss: if "C" does not match what you meant, say so before the plan gate.

Q7 note: answered as Phase 5 Q12 and relayed by the controller — emails follow the reader's colour scheme: light by default (black header, white body, yellow button) plus dark via `prefers-color-scheme: dark`. Phase 5 owns the templates and their picture; Phase 4 supplies email-safe hex tokens for both schemes (§6). Picture of the answer: `mockups/04-q7c.png` (light + dark). Not asked again.

## 2. Plan gate (sign after section 1; nothing executes before this answer)

| Wave | Plan | What it does | Runs without you? |
|------|------|--------------|-------------------|
| 1 | 04-01 | Merge main; named radius/shadow/status + exact-value tokens; `email-tokens.ts`; `cn()`; pin tests | stops for Q1/Q2/Q3 |
| 2 | 04-02 | Token lint rule (warn) + fixtures + inventory | yes |
| 3 | 04-03 | One brand-colour map; gate:local | stops for Q4 |
| 4 | 04-04 | Admin page `/admin/design-system` | stops for Q1/Q2/Q5 |
| 4 | 04-05 | The three snaps + two #0a0a0a literals | stops for Q1/Q3 |
| 5 | 04-06 | DESIGN.md (incl. both email schemes, the "UI System first" rule), requirement wording, Phase 6 addendum; gate:local | stops for Q1/Q2/Q4/Q5 |
| 6-8 | 04-09..04-12 | Codemod in 4 parts (bracket radii/shadows/hex → tokens), gate:local per wave | 04-09 stops for Q1/Q2 |
| 9 | 04-15 | Adopt the UI System release: install the pinned packages, theme mapping, "From the UI System" block on the admin page; gate:local | stops for Q10 and the release in §7 |
| 10 | 04-07 | Canvas (this session): spike, Foundations + Viewer boards built from the UI System parts | stops for Q1/Q2/Q8 = A, Q6 = C, Q7 = C, Q9 = yes, Q10 |
| 10 | 04-13 | Admin pages + admin.css codemod, lint rule to error; gate:local | stops for Q1/Q2/Q3 |
| 11 | 04-08 | Canvas: Admin boards (A1-A5) + Phase 5's email picture in light and dark (waits if Phase 5's picture is unsigned) | after 04-07 |
| 12 | 04-14 | Reviewer pass on the boards (different model), then your four canvas signatures; final gate:local | stops for you |

The UI System track (`04-UIS-TRACK.md`, gate §7) is not a wave: it runs in its own session in the ui-system repo, starting as soon as you answer Q10. Waves 1-8 never wait for it. If its release lands early, the controller may run waves 9-11 before 6-8 (the executor checks the plans share no file first).

Plans in the same wave run one after another in this one branch.

Plan gate answer (Koss): 

Visible-change ledger (all A, Q6 = C): dropdown menus (still 98% opaque) and toasts go from blue-black to #101010; the /portfolio "Browse shows" hover and glow go from indigo to dark yellow; the preload cover and the avatar initials move #0a0a0a → #090909 (one step, not visible); one new admin-only page `/admin/design-system` and its sidebar link, with a "From the UI System" block showing the new parts (admin only). No existing viewer or admin screen changes because of the UI System parts in Phase 4; Phases 5-7 build their new screens with them. Everything else keeps its exact pixel value through tokens (scrims, the navbar live dot, the 1px bar, cinema gradients).

## 3. Canvas signatures (D-08; filled in 04-14)

After Koss's own answer, the line becomes `- <group> — Koss, <date>`.

- Foundations — pending
- Viewer — pending
- Admin — pending
- Email — pending

## 4. Phase 6 compatibility (for the controller)

With all A, Phase 6's signed spec keeps working: same #090909, pill/8/12/11/16 radii, LBC 400/700, 11px minimum. Two mechanical changes, identical pixels, written in `04-P6-ADDENDUM.md` (created by 04-06):
1. Bracket radii in 06-UI-SPEC (`rounded-[12px]` ×9, `[11px]` ×5, `[16px]` ×1) → `rounded-card`, `rounded-media`, `rounded-panel`. The new lint rule flags the brackets once it is `error` (04-13). Whichever lands second converts.
2. Status tones (controller relay #6/#7): new `--status-success` (#77d586), `--status-warning` (#ffb46e), `--status-danger` (#ff8b82), `--status-neutral` (#A1A1A1, border `--line-2`) with `text-/border-/bg-status-*`. `brand-*-safe` classes keep working. Maps: `settings/advanced-tab.tsx` uses `text-brand-orange-safe` (line 352, not green) → `text-status-warning`. Checked against phase-06 tip cfa99df: `youtube-status-chip.tsx` exists (lines 22-25: ok → success, bad → danger, warn → warning, neutral → neutral); `advanced-tab.tsx` has no green-safe use.

3. UI System parts (Q6 = C, Q11): Phase 6's branch (tip 3ddf08f, 2026-10-20) already has `youtube-status-chip.tsx` in code (stays: it is the Badge tones, renamed per item 2) and will build the import sheet, up-next bar, key field and order list. Q11 A: those are swapped for SelectableTable, CountdownBar, SecretInput and ReorderList in one follow-up after both land, pixel for pixel against Phase 6's signed pictures; Q11 B: Phase 6 waits for the UI System release.

Conflicts only if Koss answers B: Q1=B moves every surface one step (P6 spec values change); Q2=B makes P6's pill buttons and 12px cards 8px (P6 pictures re-signed).

## 5. Notes for the controller

- 04-01 and 04-09 merge origin/main into this branch (main moved to c0da1d8 with skeletons and navbar changes); merge, not rebase, because the branch is pushed.
- This branch edited `.planning/ROADMAP.md` (Phase 4 plan list + progress row). Other phase branches touching ROADMAP will conflict on that block: keep both.
- The canvas plans (04-07, 04-08, signatures in 04-14) run in this session, not a subagent; the canvas is a private artifact; nothing is shared.
- The UI System track is another repo (Loomlyne/ui-system): one product per session, so the controller launches its own work session there (own clone, branch `clickit-patterns`); brief `04-UIS-TRACK.md`. Its PR, review and Ship are separate from Clickit's. There is no local ui-system checkout yet under /Users/koss/Developer.
- Builds take `/Users/koss/.clickit-heavy.lock` with placeholder public env, detached, log ending `exit=`.
- Jev: fits the codemod triage (score each file in the post-merge inventory → `worker` or `worker-deep`, logged with confidence); advisory only, not added.
- Automation proposal: a nightly unattended run of the token lint rule against open phase branches (2, 5, 6, 7), posting new violations on their PRs before merge; Jev decides the risk gate. Proposal only.

## 6. Email tokens for Phase 5 (Q7 answered C)

Phase 4 ships `src/lib/email-tokens.ts` (literal hex, no CSS variables) and a DESIGN.md email section, taken from Phase 5's picture `05-q12.png` (`.m-light` / `.m-dark` in `05-mockups.html`). Phase 5 owns the templates and may refine these values; its signed picture wins. Phase 4 pins light footer text #767676 (4.54:1): Phase 5's picture shows #777777 (4.48:1, just under AA); same look. Phase 4 owns the colour values in `email-tokens.ts`; Phase 5 owns layout and copy.
- Light (default): header #090909, header text #F4F4F4, body #ffffff, heading #111111, text #333333, code box #f6f6f6 / border #e5e5e5 / digits #090909, button #ffcc00 with #090909 ink (pill), footer text #767676, divider #eeeeee.
- Dark (`prefers-color-scheme: dark`): page and body #090909, heading #F4F4F4, text #CCCCCC, dividers #1d1d1d, code box #191919 / border #2A2A2A / digits #ffcc00, same button, footer text #A1A1A1.

## 7. UI System track gate (Q6 = C; brief `04-UIS-TRACK.md`)

Separate from the Clickit plan gate. Each line becomes `- <step> — Koss, <date>` (steps 1 and 4 are Koss's own answer) or `- <step> — done <date>, <ref>` (steps 2, 3, 5).

- 1. Q10 answered and the sheet `mockups/04-q10.png` signed — pending
- 2. Parts built on ui-system branch `clickit-patterns`, local gates green — pending
- 3. PR in Loomlyne/ui-system reviewed (Grok on Koss's subscription; fallback `reviewer`, said on the PR) — pending
- 4. Ship: squash-merge, tag `v0.2.0`, release with the two package tarballs — pending
- 5. "UI System" Claude Design design system republished; new boards on the brand-neutral canvas — pending

Release (filled at step 4): tag `` · core tarball `` · react tarball ``

