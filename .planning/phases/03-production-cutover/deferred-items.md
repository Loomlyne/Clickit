# Phase 3 deferred items (out of scope for the plan that found them)

## Found by 03-06 (2026-10-21)

1. `scripts/cf/check-gates.mjs` (Phase 2 file) requires `GET /en` and `GET /ar` to answer 200 (`redirect: 'manual'`), but since the 02-21 CPU work the locale root answers 308 to `/<locale>/portfolio` (`src/server/locale-root.ts`). Against the Worker it can never print `ALL PASS`. Runbook Steps 28, 33, 36, 42, 54 and 56 need `ALL PASS`. Fix (one small reviewed change on its own branch, before Step 28): accept a 308 whose Location is `/<locale>/portfolio`, or probe `/<locale>/portfolio` for 200. Recorded in 03-GATES.md section 9 item 1 and in the hand-over. Not fixed here: 03-06 is writing-only and the file belongs to Phase 2.
