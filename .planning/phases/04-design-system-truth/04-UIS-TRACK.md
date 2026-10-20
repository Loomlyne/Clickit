# Phase 4 — UI System track (Koss's Q6 change)

Not a Clickit plan: GSD execute-phase does not run this file. It is the brief for a separate work session in the **Loomlyne/ui-system** repo (public, MIT, pnpm 10), with its own branch, PR and gate. Clickit plan 04-15 adopts its release; 04-07 and 04-08 build the canvas from it.

## Why

Koss, 2026-10-20 (relayed by the controller as his change to Q6): "The UI system is general, so if those are missing from the UI system, that will make the design system more powerful. Add them, with the design system colors and style, and then implement those into the program, to the Clickit here."

Rule from now on: a pattern Clickit needs that the UI System lacks is built in the UI System first, as a general part in the UI System's own colours and style; Clickit then uses it with its brand theme. Phase 5 and Phase 6 signed pictures stay the visual target for the Clickit theme: generalising must not redesign them.

## Scope (Q10 picks A or B; picture `mockups/04-q10.png`, source `mockups/04-q10.html`)

Checked against ui-system 0404be9 (`packages/react/src/primitives.tsx`, `nav/*`, `Root.tsx`, `packages/core/src/*`).

| # | Part | In | Clickit use (phase) | Clickit visual target (signed) |
|---|------|----|---------------------|--------------------------------|
| 1 | `CodeInput` — N boxes (default 6), always `dir="ltr"`, paste fills all, `autocomplete="one-time-code"`, Arabic-Indic / Persian digits normalised to 0-9, invalid and disabled states, one `aria-label` for the group | A, B | sign-in code, admin TOTP (5) | 05 #q1, #q7 (boxes 46×54 at 375) |
| 2 | `SecretInput` — Input with a show/hide eye button inside the field at the logical end (`aria-pressed`, label Show/Hide), optional copy button, masked by default | A, B | password (5), YouTube key (6) | 05 #q1 password, 06 #g6-editing |
| 3 | `CountdownBar` — ring with seconds, title + meta, primary + secondary action, stops on cancel, no ring and no auto-advance under reduced motion, compact (phone) layout | A, B | up-next (6) | 06 #g1b, #g1b-states |
| 4 | `SelectableTable` — Table with a tick column, per-row status Badge, rows that cannot be picked greyed and skipped, summary bar with the main action, loading (Skeleton rows), empty and error states | A, B | playlist import preview (6) | 06 #q1, #g7-10, #g7-11 |
| 5 | `ReorderList` — rows with up/down buttons (44px), first/last arrow disabled, moved row tinted 1.2 s, `aria-live` "moved to position N" | A, B | episode order (6) | 06 #q13, #g7-13 |
| 6 | `Skeleton` — line, block, media and row shapes; shimmer off under reduced motion | A, B | loading lists (5-7) | Clickit's current skeletons on main (look kept) |
| 7 | `TotpSetup` — two steps: QR slot + manual key (SecretInput with copy), then CodeInput; recovery line slot | A, B | admin authenticator (5) | 05 #q7 |
| 8 | `Inbox` — `MessageList` (unread dot in primary), `MessageView`, `ReplyBox` with sending / failed / sent states | A only | admin inbox (7) | none yet: canvas board A4 is new and needs Koss's signature |
| 9 | Engine: own font files — `type.fonts: [{ family, src, weight }]` in `ui.config.json`, emitted as `@font-face` in theme CSS and in the Claude Design tokens | A, B | LBC in the theme and on the canvas | live LBC 400/700 |

Already in the UI System, not added: status chips = `Badge` tones success / warning / danger / neutral; side sheets = `Drawer` (the start side must flip for `dir="rtl"`: the track checks it and fixes it if it does not); Dialog, Toast, Tabs, Table, Checkbox.

Not general, stay Clickit-only: the YouTube player area (YouTube rules) and the emails (mail apps cannot use the UI System CSS; `src/lib/email-tokens.ts` stays the source).

## How (ui-system rules, from its CLAUDE.md)

- Branch `clickit-patterns` from ui-system `main`, own clone outside the Clickit repo; one session, one product.
- New visual values go through the engine as `--uis-*` variables; components never hard-code colours or radii. Each part works three ways: React props, plain `uis-*` CSS classes, and `x-import` in Claude Design. Text keeps 4.5:1 in both modes (`contrast()`).
- Update `scripts/design-catalog.mjs` (README + preview per part), run `pnpm build && pnpm design && pnpm typecheck`, add the parts to the playground.
- Brand-neutral UI System canvas: add one board per new part in the default theme (this is the only edit to that canvas; Clickit boards never go there).
- No Clickit name, colour or font in any default.
- Consumers that only use these parts must not pull in DiceBear or anime.js: `@ui-system/react` lists `@dicebear/*` and `animejs` as dependencies today, so make them optional peers (or ship the parts at a subpath such as `@ui-system/react/parts` that imports neither). Clickit 04-15 still asks Koss before any new npm package is installed.

## Gate (separate from the Clickit plan gate)

1. Koss answers Q10 (and Q11) in `04-GATE.md` §1 and signs the sheet (`mockups/04-q10.png`).
2. The track session builds the parts on `clickit-patterns`; local gates green.
3. PR in Loomlyne/ui-system; review by Grok on Koss's subscription, fallback the local `reviewer` agent (said on the PR).
4. Koss's Ship: squash-merge, tag `v0.2.0`, GitHub release with `pnpm pack` tarballs of `@ui-system/core` and `@ui-system/react` (workspace versions resolved in the tarballs).
5. The orchestrating session republishes the "UI System" Claude Design design system from `design/claude-design-system/project` (index `design-system.json` last, `createdOnFiles` kept, `lastChange` updated) and adds the new boards to the brand-neutral canvas.
6. Only then: Clickit 04-15 (adopt), 04-07 and 04-08 (canvas).

Record the release tag and the tarball URLs in `04-GATE.md` §7 when step 4 is done. No secret is needed: the repo is public and the release assets download without a token.
