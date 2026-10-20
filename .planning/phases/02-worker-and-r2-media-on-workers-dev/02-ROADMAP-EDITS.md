# Phase 2 roadmap edits 1-9 (signed)

Asked one at a time in the question form of work session `phase-02-workers-r2`, 2026-10-20 10:25-10:31 CET. Koss's answer to every edit: "Sign (Recommended)". Source text: 02-CONTEXT.md `<proposed_roadmap_changes>`.

| # | Edit | Status | Koss's words |
|---|------|--------|--------------|
| 1 | PLAT-10 split: Vercel code removal in Phase 2 (PLAT-10); Vercel project + domain deletion is the last step of Phase 3 (new PLAT-11); Phase 8 only checks no Vercel trace is left | signed | "Sign (Recommended)" |
| 2 | DNS-01 and MAIL-02 move from Phase 1 to the start of Phase 3; SAFE-05 stays in Phase 1 and closes before Phase 3 | signed | "Sign (Recommended)" |
| 3 | Phase 2 depends on Phase 1.1 (merged), not Phase 1; SAFE-01/02/04 close before Phase 3; SAFE-03 does not block Phase 2 | signed | "Sign (Recommended)" |
| 4 | PLAT-08 reworded: local wrangler deploy from the control session after `npm run gate:local` and Koss's Ship; whoami first; no deploy token in GitHub | signed | "Sign (Recommended)" |
| 5 | MEDIA-03 split: copy with checksums and optimized copies in Phase 2 (MEDIA-03); live DB URL rewrite with backup table in Phase 3 (new MEDIA-08); "86" becomes "every object in the reviewed manifest" | signed | "Sign (Recommended)" |
| 6 | MEDIA-04 reworded: pre-optimized WebP/AVIF copies plus original, served from R2, no paid image feature, original shown if a copy is missing | signed | "Sign (Recommended)" |
| 7 | Phase 2 criterion 4: media from the media Worker on workers.dev now, media.clickitstory.ae after Phase 3; MEDIA-02 stays in Phase 3 | signed | "Sign (Recommended)" |
| 8 | Phase 2 owner list: drop Queue and GitHub Environment; media custom domain and Supabase CAPTCHA to Phase 3; Image Transformations decision closed | signed | "Sign (Recommended)" |
| 9 | PLAT-04 note: crons built in Phase 2, deployed off, switched on at the Phase 3 cutover after the Vercel crons are off | signed | "Sign (Recommended)" |

No edit was changed or rejected, so no plan revision is needed. In plan 02-22's coverage table, no row stays "unsigned".

## How the edits reach main

- `02-ROADMAP-EDITS.patch` holds the exact text change to `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md`, made against main `be6e221`. Checked: `git apply --check` passes on `be6e221`.
- **Control session:** on main, run `git apply .planning/phases/02-worker-and-r2-media-on-workers-dev/02-ROADMAP-EDITS.patch` (or copy the patch from this branch first), commit as a planning note (no code, no deploy), and write the commit sha here.
- The phase branch carries the same edits plus the Phase 2 plan list, so a later merge only adds the plan list.
- New IDs: PLAT-11 (Vercel project deletion, Phase 3) and MEDIA-08 (DB URL rewrite, Phase 3). v1 count 73 → 75.

**Planning-note commit on main:** `840dc5b` (local main, applied by the control session 2026-10-20, not pushed)
