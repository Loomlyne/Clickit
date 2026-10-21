---
phase: 04-design-system-truth
plan: 14
subsystem: design
tags: [claude-design, canvas, review, signatures]

requires:
  - phase: 04-design-system-truth
    provides: 04-07 and 04-08 boards (22), 04-13 guard at error
provides:
  - "## Legends" and "## Review" in 04-CANVAS.md (22 board legends; 17 reviewer findings, all fixed)
  - Koss's four canvas signatures in 04-GATE.md §3, mirrored in 04-CANVAS.md
  - Decision: Arabic password eye on the physical right (Koss, "A: right (Recommended)")
affects: [05-accounts-and-email, 06-youtube-import-player, 07]

requirements-completed: [DS-03]

completed: 2026-10-21
---

# Phase 4 Plan 14: Reviewer pass, signatures, final gate

**A reviewer on a different model checked every board, all 17 differences were fixed on the canvas, and Koss signed Foundations, Viewer, Admin and Email.**

## Task 1: legends and reviewer pass (a986d9e)
- 04-CANVAS.md "## Legends" lists each board's legend with its source. There is no URL in it.
- The `reviewer` agent ran on Sonnet 5.5, read-only; the boards were built by Opus 5.5. It returned 17 findings: CSS specificity on the email fine print, the V2/V4 nav, the hero sizes, field values, F4 values, A3 against G6, V3 error card and rows, A1 columns, the F0 index, layout heights, the V1 logo and focus, A2 rows, and emoji glyphs. Each one was fixed and republished, and is listed with its fix in "## Review".
- The reviewer confirmed statically that the spike items (LBC faces linked, field radius 8) are in place. Seeing them on screen was part of Koss's Foundations signature.

## Task 2: signatures (Koss, 2026-10-21 00:05 CET)
- Koss answered in the question form, relayed verbatim by the controller: "Foundations signed", "Viewer signed", "Admin signed", "Email signed".
- 04-GATE.md §3 has the four lines `- <Group> — Koss, 2026-10-21`. The verify command counts 4.
- Decision asked with the signatures: "A: right (Recommended)". The show/hide eye sits on the physical right in English and Arabic. DESIGN.md already says this. Live `password-field.tsx` (`end-0`) is a Phase 5 follow-up.

## Task 3: final gate
- `/Users/koss/.clickit-checks/p04-w10-final-gate.log`, rerun after the signature commit. The result is in the hand-over.

## Open items (not fixed in Phase 4)
- F4: the live Badge default draws ink #090909 on primary/16, which is hard to read. Recorded only.
- Phase 5: `password-field.tsx` moves its eye to the physical right in Arabic.
- Phase 5: the #q1 picture drew text fields as --bg-1 / --line-2 / 15px. The live Input is --bg-2 / --line / 14px, and the boards follow the live Input.
