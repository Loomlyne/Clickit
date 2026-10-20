# Job C: Cloudflare move (Phase 2 → Phase 3 plan)

Base: branch `phase-02-workers-r2` (Phase 2: 22 signed plans in `.planning/phases/02-worker-and-r2-media-on-workers-dev/`, plan gate signed 2026-10-20). Phase 2 depends on Phase 1.1: merge `phase-01.1-admin-actions-hardening-inserted` into your branch first (1.1 has code done, UAT pending), then `origin/main` whenever it moves.
GSD: `/gsd-execute-phase 2` in your worktree.

Must deliver (ROADMAP Phase 2 success criteria):
- The app on Workers (OpenNext) at its workers.dev URL, ClickitStory account, with every gate.
- R2 media: bucket + upload path + `scripts/migrate-supabase-media-to-r2.mjs` dry run with checksum report (no live run without Koss).
- Rule 2: remove `vercel.json`, the two Vercel crons (`/api/cron/cleanup-media` Mon 04:00, `/api/cron/publish-scheduled` daily 01:00) → Worker Cron Triggers (deployed OFF until cutover), `@vercel/analytics`, `@vercel/speed-insights`, `botid` and any Vercel code.
- Rule 4 CI: one Linux workflow on `pull_request: [opened]` only, `paths-ignore` docs/.planning/**/*.md, `concurrency` cancel-in-progress, `timeout-minutes`; `gate:local` exists. Also fix `.github/workflows/supabase-migrations.yml` so it does not auto-apply to live on push to main (live migrations are the controller's, on Koss's word): make it `workflow_dispatch` only.
- Then the Phase 3 cutover plan with rollback (zone onboarding, DNS-only record copy so www stays on Vercel until the switch, NS at tasjeel, Worker custom domain on www + apex, media URL rewrite with backup table, rollback to the frozen Vercel deploy). Never take www off Vercel before the Worker is proven on workers.dev.
- Coordinate with job D (media Worker): D owns `media.clickitstory.ae` and its Worker; you consume `NEXT_PUBLIC_MEDIA_ORIGIN`. Do not create a second media Worker.

Stops (end turn with `NEEDS KOSS:`): creating R2/D1/KV resources, Worker secrets, Turnstile keys, any deploy beyond your own workers.dev preview, Workers Paid ($5/mo) if Free CPU fails, any live DB write, any DNS step, UAT on workers.dev. Deploys to workers.dev need Koss's word once (ask for it with the exact command).
Open one PR per wave or one for the phase, your call; say which in the hand-over.
