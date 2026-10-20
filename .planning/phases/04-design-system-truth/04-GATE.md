# Phase 4 — Design System Truth: gate for Koss

Work session branch `claude/phase-04-design-system-truth-26dcc6`. Planning files only: no code, no database write, no deploy.
Status 2026-10-20: discuss + UI contract + research + 11 plans done on the **recommended** answers. Nothing here is signed yet.

How the controller records an answer: write the letter and date in the "Koss" column, e.g. `A (Koss, 2026-10-21)`. "All recommended" fills every row with A.

## 1. Discuss decisions (one each, recommended first)

Full wording and examples: `04-DISCUSS-QUESTIONS.md`. Pictures: `mockups/04-q1.png` … `04-q7.png`.

| Q | Decision | A (recommended) | B | Picture | If B, plans that change | Koss |
|---|----------|-----------------|---|---------|-------------------------|------|
| 1 | Page background number | #090909, as live | #0a0a0a (roadmap text) | 04-q1.png | 04-01, 04-05, 04-06, 04-07, 04-09 | |
| 2 | Corner shapes | live roles: pill buttons/chips, field 8, card 12, image 11, sheet 16 | 8px everywhere (every button changes; Phase 6 pictures redone) | 04-q2.png | 04-01, 04-04, 04-06, 04-07, 04-09..04-13 | |
| 3 | Blue-era leftovers (dropdown #11151d, toast #10131a, /portfolio button hover indigo) | snap to the tokens (only visible changes of the phase) | keep them as listed exceptions | 04-q3.png | 04-01, 04-05, 04-13 | |
| 4 | Category colours | stay free (content); one brand map for the app chrome | 6 brand colours only + live rewrite of 15 categories (your word) | 04-q4.png | 04-02, 04-03, 04-06 | |
| 5 | In-app design-system page | read-only `/admin/design-system`, admin guard | no page; DESIGN.md + canvas only | 04-q5.png | 04-04 dropped; 04-06 rewords DS-01/DS-04 | |
| 6 | Claude Design boards | new "Clickit Story" canvas installing UI System | add to the existing UI System canvas | 04-q6.png | 04-07 | |
| 7 | Email look | dark, like the site | light body, dark header | 04-q7.png | 04-01, 04-06, 04-08 | C (Koss, 2026-10-20) — follows the reader's colour scheme: light by default (black header, white body, yellow button) + dark via `prefers-color-scheme: dark`. Answered as Phase 5 Q12, relayed by the controller. Phase 5 owns the templates and their picture; Phase 4 supplies email-safe hex tokens for both schemes. Not asked again. |
| 8 | How you sign the canvas | four signatures (Foundations, Viewer, Admin, Email) | one signature for all | no picture (process) | 04-07, 04-14 | |
| 9 | LBC font licence | yes: the LBC licence allows uploading the two font files to a private Claude Design canvas | no: boards use a system-font stand-in and are reviewed against the live site for type | no picture (licence) | 04-07 | |

## 2. Plan gate (sign after section 1)

| Wave | Plan | What it does | Runs without you? |
|------|------|--------------|-------------------|
| 1 | 04-01 | Merge main; named radius/shadow/status tokens + exact-value tokens; `cn()`; pin tests | yes |
| 1 | 04-02 | Token lint rule (warn) + fixtures + inventory | yes |
| 2 | 04-03 | One brand-colour map; gate:local | yes |
| 3 | 04-04 | Admin page `/admin/design-system` | stops for Q1/Q2/Q5 |
| 3 | 04-05 | The three snaps + two #0a0a0a literals | stops for Q1/Q3 |
| 3 | 04-07 | Canvas: spike, Foundations + Viewer boards (this session) | stops for Q1/Q2/Q6/Q7/Q8/Q9 |
| 4 | 04-06 | DESIGN.md, requirement wording, Phase 6 addendum; gate:local | stops for Q1/Q2/Q4/Q5/Q7 |
| 4 | 04-08 | Canvas: Admin + Email boards (this session) | after 04-07 |
| 5-8 | 04-09..04-13 | Codemod in 5 parts (bracket radii/shadows/hex → tokens, admin.css), rule to error, gate:local per wave | 04-09 stops for Q1/Q2; 04-13 for Q1/Q2/Q3 |
| 9 | 04-14 | Your four canvas signatures; final gate:local | stops for you |

Plan gate answer (Koss): 

Visible-change ledger if all A: dropdown menus and toasts go from blue-black to #101010; the /portfolio "Browse shows" hover and glow go from indigo to dark yellow; the preload cover and the avatar initials move #0a0a0a → #090909 (one step, not visible); one new admin-only page `/admin/design-system` and its sidebar link. Everything else keeps its exact pixel value through tokens (scrims, the navbar live dot, the 1px bar, cinema gradients).

## 3. Canvas signatures (D-08; filled in 04-14)

After Koss's own answer, the line becomes `- <group> — Koss, <date>`.

- Foundations — pending
- Viewer — pending
- Admin — pending
- Email — pending

## 4. Phase 6 compatibility (for the controller)

With all A, Phase 6's signed spec keeps working: same #090909, pill/8/12/11/16 radii, LBC 400/700, 11px minimum. Two mechanical changes, identical pixels, written in `04-P6-ADDENDUM.md` (created by 04-06):
1. Bracket radii in 06-UI-SPEC (`rounded-[12px]` ×9, `[11px]` ×5, `[16px]` ×1) → `rounded-card`, `rounded-media`, `rounded-panel`. The new lint rule flags the brackets once it is `error` (04-13). Whichever lands second converts.
2. Status tones (controller relay #6/#7): new `--status-success` (#77d586), `--status-warning` (#ffb46e), `--status-danger` (#ff8b82), `--status-neutral` (#A1A1A1, border `--line-2`) with `text-/border-/bg-status-*`. `brand-*-safe` classes keep working. Maps: `youtube-status-chip.tsx` ok → success, warn → warning, broken → danger, neutral → neutral; `settings/advanced-tab.tsx` uses `text-brand-orange-safe` (line 352, not green) → `text-status-warning`. Checked against phase-06 tip b0bff0d: `youtube-status-chip.tsx` is not there yet (spec only); `advanced-tab.tsx` has no green-safe use.

Conflicts only if Koss answers B: Q1=B moves every surface one step (P6 spec values change); Q2=B makes P6's pill buttons and 12px cards 8px (P6 pictures re-signed).

## 5. Notes for the controller

- 04-01 and 04-09 merge origin/main into this branch (main moved to c0da1d8 with skeletons and navbar changes); merge, not rebase, because the branch is pushed.
- This branch edited `.planning/ROADMAP.md` (Phase 4 plan list + progress row). Other phase branches touching ROADMAP will conflict on that block: keep both.
- The canvas plans (04-07, 04-08, signatures in 04-14) run in this session, not a subagent; the canvas is a private artifact; nothing is shared.
- Builds take `/Users/koss/.clickit-heavy.lock` with placeholder public env, detached, log ending `exit=`.
- Jev: fits the codemod triage (score each file in the post-merge inventory → `worker` or `worker-deep`, logged with confidence); advisory only, not added.
- Automation proposal: a nightly unattended run of the token lint rule against open phase branches (2, 5, 6, 7), posting new violations on their PRs before merge; Jev decides the risk gate. Proposal only.
