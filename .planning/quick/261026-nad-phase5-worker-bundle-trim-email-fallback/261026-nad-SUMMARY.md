---
phase: quick-261026-nad
plan: 01
status: complete
subsystem: worker-bundle
tags: [cloudflare, bundle-budget, email, turbopack]
requirements: [MAIL-07]
key-files:
  created:
    - src/server/email/queue-select.ts
    - src/server/email/queue-local.ts
    - tests/unit/email-queue-select.test.ts
  modified:
    - src/server/email/queue.ts
    - next.config.ts
    - scripts/cf/build-target.mjs
commits:
  - ae978c59 test(quick-261026-nad): failing tests (RED)
  - 13b252b5 feat(quick-261026-nad): drop in-process email fallback from the Worker build (GREEN)
completed: 2026-10-26
---

# Quick 261026-nad: Worker bundle trim (email fallback) Summary

The in-process email fallback is no longer reachable in a cf:build: `compiler.defineServer` inlines `process.env.CLICKIT_WORKER_BUILD` as `"1"`, Turbopack folds the branch around `import('./queue-local.ts')`, and the Worker bundle drops from 2 copies of the app email templates to 1 (gzip 2,984.77 to 2,974.94 KiB).

## Worker bundle

| Item | Before (05-21 build, 40bba4d) | After (13b252b5) |
|---|---|---|
| bundle-budget gzip | 2,984.77 KiB | 2,974.94 KiB |
| bundle-budget total | 14,702.21 KiB | 14,563.22 KiB |
| headroom under 3,000 KiB | 15.23 KiB | 25.06 KiB |
| delta | | gzip -9.83 KiB, total -138.99 KiB |
| wrangler dry-run Total Upload | 14702.21 KiB / gzip: 2984.77 KiB | 14563.22 KiB / gzip: 2974.94 KiB |
| template marker copies in wrangler `custom-worker.js` | 2 | 1 |
| template marker in `.open-next/.../handler.mjs` | 1 (planner measure) | 0 |
| template marker files in `.open-next/.../.next/server` | n/a | 0 |
| `[email/queue-local]` in `.open-next/server-functions/default` | n/a | 0 files |
| `[email/queue-local]` in wrangler `custom-worker.js` | 1 | 0 |
| node-build (`npm run build`, no flag) fallback present | n/a | yes (2 files: chunk `src_server_email_queue-local_ts_*.js` plus its map) |

`CLICKIT_WORKER_BUILD` in handler.mjs: it survives only inside the serialized next config (`compiler:{defineServer:{"process.env.CLICKIT_WORKER_BUILD":"1"}}`, lines 343 and 2893). No runtime `process.env.CLICKIT_WORKER_BUILD` read remains in any `.next/server` file (0 files).

Build HEAD: 13b252b5, tree clean at build time (no 05-27 files uncommitted). Placeholder public env as in 05-21.

## Mechanism

Next 16.4.2 does not inline plain `process.env.X` in server code, and next.config `env` is left as a runtime read in some build modes. `compiler.defineServer` is replaced for server and edge code only. `scripts/cf/build-target.mjs` `nextBuildEnv()` adds `CLICKIT_WORKER_BUILD=1` to the opennextjs-cloudflare build spawn for every target (preview, workersdev, production); it is not part of `buildEnvFor()` or the stamp. `queue.ts` now has a literal guarded `import('./queue-local.ts')`; `queue-select.ts` keeps the fail-closed `EMAIL_QUEUE binding missing` (T-05-16-03). `custom-worker.ts` and `wrangler.jsonc` were not touched.

## Verified

- `tests/unit/email-queue-select.test.ts`: 7 of 7 pass (RED first: module not found).
- `npm run test:unit`: 2635 pass, 0 fail. `npx tsc --noEmit`: exit 0. eslint on the six touched paths: clean.
- `npm run build` (plain): fallback chunk present. `npm run cf:build`: fallback chunk and templates absent from `.open-next` Next server.
- Logs (all end `exit=0`): `/Users/koss/.clickit-checks/nad-before.log`, `nad-after-build.log`, `nad-after-dryrun.log`. Before figures: `/Users/koss/.clickit-checks/p5-21-build.log`.
- Stop condition: gzip 2,974.94 < 2,984.77 and one template copy in the Worker JS: met.

## Not verified

- Runtime behaviour in a deployed Worker or `next start` with Mailpit (no deploy, by rule). Covered by unit tests and bundle inspection only.
- workersdev and production targets were not built; they use the same spawn path as preview.

## Failed

None.

## Deviations

- Template marker counts: the plan expected 2 before in the wrangler outdir by `grep -rhoF`, but the outdir also holds `custom-worker.js.map` (source contents), so the recursive count was 4 before and 2 after. Counts above use `custom-worker.js` only (2 to 1); the map shows the same 2 to 1.
- Commit guard: this worktree branch is `claude/phase-05-accounts-and-email-61ece8` (the branch named in the task), not `worktree-agent-*`; it is not a protected ref, so commits went ahead.

## Self-Check: PASSED

Commits ae978c59 and 13b252b5 exist; created files present; logs end `exit=0`.
