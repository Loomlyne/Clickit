---
phase: 05-accounts-and-email
plan: 00
subsystem: gate
tags: [gate, merge, preconditions]
requires: []
provides: [phase-5-wave-0-gate]
affects: [all Phase 5 plans]
key-files:
  created: [.planning/phases/05-accounts-and-email/05-00-SUMMARY.md]
  modified: []
key-decisions:
  - "Every Phase 5 migration (05-09, 05-13) uses a timestamp greater than 20261021120000 (newest on main)"
duration: 10min
completed: 2026-10-21
---

# Phase 5 Plan 00: Wave 0 gate Summary

**Plan gate signed in every row, origin/main merged (merge 6935528 over main 787ca3a), Phase 2 present, and migrations reach live only through the approved apply-live-migrations.yml.**

## Task 1: plan gate, merge, Phase 2

- Plan gate: G1-G25 all carry Koss's answer, and each matches the planned or recommended option (G4 B, G12 C, G16 n/a and G19 B were planned as signed; G20 A, G21 accepted, G23 A, G24 A x4, G25 A).
- Merge: `origin/main` (787ca3a, Phase 2 squash 6ebc802) was merged into `claude/phase-05-accounts-and-email-61ece8` as 6935528. `git merge-base --is-ancestor origin/main HEAD`: OK.
- Phase 2 files: all 13 paths in the verify command exist. The six export greps each print a line:
  - `src/server/form-guard.ts:65 export function readCaptchaToken`
  - `src/server/auth-guards.ts:10 export async function requireAdminUser`
  - `src/server/cron-schedule.ts:5 export const CRON_ROUTES`
  - `custom-worker.ts:23 async scheduled(`
  - `src/components/security/turnstile-field.tsx:27 export function useTurnstileToken`
  - `src/server/cloudflare.ts:47 export async function getWorkerEnv`

### Upstream state (record only)

**Phase 3:**
- Worker crons: ABSENT. `wrangler.jsonc` has `"crons": []`, with the comment "Crons go on at the Phase 3 cutover (P3-8, after P3-6)".
- Resend domain verified (MAIL-02): ABSENT. There is no `03-*-SUMMARY.md` on main; `.planning/phases/03-production-cutover/` holds only `03-CUTOVER-DRAFT.md`.
- www served by the Worker (cutover): ABSENT. There is no Phase 3 SUMMARY, and CLAUDE.local.md says www is a CNAME to frozen Vercel.
- Supabase CAPTCHA on: ABSENT. There is no Phase 3 SUMMARY.
- Consequence: the live plans 05-35..05-37 wait for Phase 3.

**Phase 4:**
- Canvas signatures: PRESENT, all four. `04-GATE.md` lines 52-55: "Foundations — Koss, 2026-10-21", "Viewer — Koss, 2026-10-21", "Admin — Koss, 2026-10-21", "Email — Koss, 2026-10-21".
- Line 5 records the Arabic password eye as "A: right", the physical right, with the follow-up in 05-12 Task 3.
- `src/lib/email-tokens.ts`: PRESENT, with `export const EMAIL_TOKENS` at line 13.

**Phase 6** (already on main):
- `requireAdminForYouTube`: PRESENT. `src/app/[locale]/admin/actions.ts:180 const requireAdminForYouTube = (): Promise<{ id: string }> => assertAdmin()`.
- Admin directories: one new directory compared with the planning list, `design-system` (from Phase 4). The others are archive, audit, categories, inbox, reviews, settings, shorts and shows.
- Phase 6 migration: `20261020150526_youtube_episode_status_and_order.sql` is on main.

**Newest migration:**
- On main: `20261021120000_legal_pages_arabic_review.sql`.
- On the Phase 6 branch: no branch named `phase-06-youtube-import-player` is left on origin (it landed). The Phase 6 file 20261020150526 is on main.
- Every Phase 5 migration timestamp must be greater than 20261021120000.
- The controller notes that live migrations 20261020150526 and 20261021120000 are about to be applied after Koss's approval.

**Local Supabase stacks:**
- `docker ps` shows only `supabase_db_Clickit`, the expected shared stack.
- The controller left it with 20261021120000 applied. Use `db reset --local` under the heavy lock if `migration up` complains.

## Task 2: migration path

No workflow pairs a push trigger with `supabase db push`, `migration up` or `psql`; the verify check exits 0.

`.github/workflows/apply-live-migrations.yml`:
- Line 62: `environment: live-db-plan`. Line 100 runs the dry run: `supabase db push --dry-run --db-url "$SUPABASE_DB_URL"`.
- Line 123: `environment: live-db`. Line 180 runs the apply: `supabase db push --db-url "$SUPABASE_DB_URL" --yes`.
- The workflow applies ALL pending files in one approval. That is why M2+M3 ship in a second PR, prepared in 05-41 and applied in 05-37.

The waiver syntax comes from `scripts/migration-guard.mjs` (lines 12 and 89): `-- safe-drop: <reason>` goes on the same line as each `drop`, `delete from` or `truncate`.

## Deviations

- The merge used the app's `sync_with_base_branch` tool (the worktree rule) instead of `git merge`. The result is the same: a merge commit with origin/main as an ancestor.
- No source files changed.

## Self-Check: PASSED
