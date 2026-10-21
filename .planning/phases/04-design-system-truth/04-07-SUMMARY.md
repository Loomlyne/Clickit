---
phase: 04-design-system-truth
plan: 07
subsystem: design
tags: [claude-design, canvas, design-system, foundations, viewer]

requires:
  - phase: 04-design-system-truth
    provides: 04-01 tokens and email tokens, 04-03 brand map, 04-GATE answers Q1/Q2/Q6/Q8, Q7 = C, Q9 = yes
provides:
  - Private Claude Design canvas "Clickit Story" (Koss's account) with the UI System installed and 10 boards: F0-F5 Foundations, V1-V4 Viewer
  - 04-CANVAS.md, the canvas record with no URL (22 board rows, spike, signatures)
affects: [04-08, 04-14, 04-06]

tech-stack:
  added: []
  patterns:
    - "Every board mounts UIS.Root with Clickit props, then a .cl layer from a shared clickit.css pins each --uis-* variable to the live globals.css value"
    - "LBC is loaded from canvas assets through @font-face (no Google Fonts, loadFonts false)"

key-files:
  created:
    - .planning/phases/04-design-system-truth/04-CANVAS.md
  modified: []

key-decisions:
  - "Field radius uses both the config override and a --uis-r-field: 8px pin, so the board does not depend on one method"
  - "V1 code boxes follow Phase 5's signed #q1 (46 x 54), which supersedes the 44px boxes first written in 04-UI-SPEC"
  - "V3 reproduces #q8 A, G1-B (which supersedes #q9) and #q11 A, including the Phase 6 error table"
  - "F4 flags one live issue without changing it: Badge default draws ink #090909 on primary/16"

requirements-completed: []  # DS-03 needs the Admin and Email boards (04-08) and the four signatures (04-14)

duration: 75min
completed: 2026-10-20
---

# Phase 4 Plan 07: Canvas spike, Foundations and Viewer boards

**The private "Clickit Story" canvas exists, with the UI System installed and 10 boards built from live tokens and the signed Phase 5 and Phase 6 pictures.**

## Accomplishments

- The canvas was created under Koss's account and stays private. Its link is only in the local note `/Users/koss/.clickit-checks/p4-canvas-link.txt`, which is never committed.
- The UI System design system is installed in namespace `uis` (tokens.json plus the components bundle, as server-side copies), with its `designSystems` record.
- Foundations boards:
  - F0: cover, rules, UIS.Root values, sign-off boxes
  - F1: colour and brand map, with contrast ratios
  - F2: type in English and Arabic
  - F3: radius roles and elevation
  - F4: the six live Button variants and their states, Input, Badge, Select, Checkbox, Tabs, status chips, toast, plus the same pieces mounted from the UI System
  - F5: spacing, focus, motion
- Viewer boards:
  - V1: email-code sign-in, states a-g, in English and Arabic
  - V2: home and show, as live
  - V3: the watch page, reproduced, with the error table
  - V4: Arabic right-to-left
- Every board carries a token legend.
- 04-CANVAS.md lists all 22 boards. F0-F5 and V1-V4 are built, and A1-A4 and E0-E7 are not built yet (04-08).

## Task commits

1. Task 1 (owner gate): the verify command exited 0. There was no commit.
2. Task 2: `4167916` docs(04-07): canvas record, spike and Foundations boards
3. Task 3: `3d54e43` docs(04-07): Viewer boards V1-V4

## Deviations

- Spike results are recorded as "pass (method)". The Design-type rules say the author does not render or screenshot the boards. The visual check of the font (LBC against system-ui) and of the field corner (8px against the pill buttons) therefore moves to the 04-14 reviewer pass, which looks at the boards.
- V1 uses Phase 5's signed sign-in copy ("Sign in or join", "Send code") where it exists, and the UI-SPEC placeholders elsewhere. All of it is placeholder until Phases 5 and 7.

## Not verified

- No board was rendered or screenshotted by this session (Design-type rule). Koss and the 04-14 reviewer see them first.

## Next

- 04-08: the Admin boards A1-A4 and the Email boards E0-E7, in light and dark, from `05-q12-schemes`.
- 04-14: a reviewer pass, then NEEDS KOSS for the four signatures.
