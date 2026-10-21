---
phase: 04-design-system-truth
plan: 08
subsystem: design
tags: [claude-design, canvas, admin, email]

requires:
  - phase: 04-design-system-truth
    provides: 04-07 canvas and shared clickit.css, 04-01 EMAIL_TOKENS (follow-ups 30f0d19, 54e2c79)
  - phase: 05-accounts-and-email
    provides: signed 05-q12-schemes picture (Q12 = C, 2026-10-20 ~19:00 CET), signed #q1 code boxes
  - phase: 06-youtube-import-player
    provides: signed #q1, #q13 A, G6 pictures and 06-UI-SPEC copy
provides:
  - Admin boards A1-A4 and Email boards E0-E7 on the private "Clickit Story" canvas, so all 22 boards are built
  - email.css on the canvas, which draws the Phase 5 shell from EMAIL_TOKENS literal hex
  - src/lib/email-tokens.ts carrying every colour role of the signed picture, under Phase 5's names, pinned by tests/unit/email-tokens.test.ts
affects: [04-14, 05-accounts-and-email]

tech-stack:
  added: []
  patterns:
    - "Email boards do not mount UIS.Root: mail clients cannot use it, so they link clickit.css plus email.css only"
    - "Each email board: LIGHT and DARK frames, English and Arabic at 600, phones at 375, a rules list and a token legend"

key-files:
  created:
    - .planning/phases/04-design-system-truth/04-08-SUMMARY.md
  modified:
    - .planning/phases/04-design-system-truth/04-CANVAS.md
    - src/lib/email-tokens.ts
    - tests/unit/email-tokens.test.ts

key-decisions:
  - "A1 to A3 reproduce Phase 6's signed pictures and real strings; A4 (support inbox) is new and waits for its 04-14 signature"
  - "The email body class is .eb, not .bd, so it does not clash with the board layout class"
  - "E1 is one email for both sign-in paths (code and Magic Link button), code first"
  - "E6 is the only email with Unsubscribe and Manage links; E7 has an English-only admin copy with a reply-to note"

requirements-completed: []  # DS-03 waits for the four signatures in 04-14

duration: 90min
completed: 2026-10-20
---

# Phase 4 Plan 08: Admin and Email boards

**All 22 boards on the private canvas are built. The Admin row reproduces Phase 6's signed pictures, and the Email row reproduces Phase 5's signed Q12 picture in both schemes.**

## Accomplishments

- Admin boards:
  - A1 playlist import (#q1)
  - A2 episodes order and flags (#q13 A)
  - A3 YouTube key setting (G6, with the eye on the right inside the field)
  - A4 support inbox (new)
- Email boards:
  - E0 shell
  - E1 sign-in code and Magic Link
  - E2 confirm signup
  - E3 reset password
  - E4 email change
  - E5 welcome
  - E6 new-episodes digest
  - E7 support auto-reply and the admin copy
- Each email board has light and dark frames in English and Arabic at 600, phones at 375, and a legend from EMAIL_TOKENS.
- email-tokens.ts was brought to the signed picture in two follow-ups, both pinned by the test (7/7):
  - 30f0d19 added every role.
  - 54e2c79 set the light code to #111111 and the dark rule to #222222.

## Differences from the signed picture (for the 04-14 reviewer)

- The logo plate is drawn as text, and Phase 5 ships the real PNG.
- The sender line, the expiry ("15 minutes") and the legal footer are shown as {placeholders}, as the plan says.
- E2 keeps the picture's English copy. All other copy is a [bracketed] stand-in until Phase 5 writes it.
- The visual spike check is still deferred to 04-14, because the author does not render the boards.

## Commits

- 30f0d19, 54e2c79: the email tokens
- 8dcedc8: A1-A4
- 648fcb6: E0-E7

No live writes and no deploys were made. No artifact URL appears in any committed file.
