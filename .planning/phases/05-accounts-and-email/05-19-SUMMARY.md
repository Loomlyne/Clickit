---
phase: 05-accounts-and-email
plan: 19
subsystem: email-queue-worker
tags: [cloudflare-queues, worker, wrangler, consumer, cpu, bundle, workers-free]
requires: ["05-08", "05-11", "05-16"]
provides: [custom-worker queue() handler, clickit-email producer/consumer/DLQ config, email vars, worker-email-config test, email-batch-cpu harness]
affects: [05-20, 05-35, 05-36, 05-39]
tech-stack:
  added: []
  patterns: ["queue() awaits processBatch and lets errors propagate (batch redelivered)", "queues block mirrored into env.production (not inherited)", "consumer import allow-list walked from custom-worker.ts"]
key-files:
  created:
    - tests/unit/worker-email-config.test.ts
    - scripts/email-batch-cpu.mjs
  modified:
    - custom-worker.ts
    - wrangler.jsonc
    - .dev.vars.example
    - src/app/[locale]/admin/layout.tsx
    - tests/unit/design-system-page.test.ts
key-decisions:
  - "queues block and the four email vars are repeated in env.production: wrangler does not inherit queues or vars, and main's cutover drift test (03-01) requires every non-inheritable key and every top-level var to be copied"
  - "queue() takes (batch, env) only; the ctx argument is unused, and dropping it avoids a new no-unused-vars warning"
  - "Admin layout calls unstable_rethrow(e) first in its requireAdmin() catch; without it next build prerendered /en/admin/settings and failed"
  - "CPU gate result: set B (set A loadavg 4.01 > 4) cold max 14.44 ms, over 10 ms -> NEEDS CONTROLLER; warm mean max 0.58 ms"
requirements-completed: []
duration: 15min
completed: 2026-10-25
status: code complete; CPU gate open (NEEDS CONTROLLER)
---

# Phase 5 Plan 19: Queue consumer on the Worker Summary

**`custom-worker.ts` now has `queue()` running `processBatch(batch, buildEmailDeps({ ...env, CLICKIT_RUNTIME: 'workers' }))`. `wrangler.jsonc` declares the `clickit-email` producer, the consumer (batch 5, timeout 5, retries 5, delay 60) and the DLQ `clickit-email-dlq`, plus the public email vars, on both targets. The Worker builds at 2,949.63 KiB gzip, under the 3 MiB Free limit. The consumer's import graph is React-free. The per-batch CPU gate fails on the cold batch: 14.44 ms max against 10 ms. About 9 ms of that is Node lazy-loading its `Response` implementation in the harness, not the fill.**

## Tasks

| # | Task | Commit |
|---|------|--------|
| 1 (RED) | Failing test for queue wiring and import allow-list | `22aacc74` |
| 1 (GREEN) | queue() handler, queues, vars, `.dev.vars.example` | `78acf53c` |
| 2 | Build and bundle measure (+ blocking fix in the admin layout) | `56379b92` |
| 3 | CPU harness and measurement | `cef589a1` |

## What was built

- `custom-worker.ts`: structural `MessageLike` / `MessageBatchLike`, `EmailEnv = Parameters<typeof buildEmailDeps>[0]`, and `async queue(batch, env)`. It awaits `processBatch` and has no catch and no waitUntil, so a claim or finish throw fails the invocation and the queue redelivers. It imports `./src/server/email/consumer.ts` and `./src/server/email/deps.ts` through relative paths: no `@/`, no `server-only`.
- `wrangler.jsonc`: `queues.producers [{ binding: EMAIL_QUEUE, queue: clickit-email }]` and one consumer `{ max_batch_size: 5, max_batch_timeout: 5, max_retries: 5, retry_delay: 60, dead_letter_queue: clickit-email-dlq }`, with a comment on each key (F8, F9). The four new vars:
  - `EMAIL_FROM` `Clickit Story <no-reply@clickitstory.ae>`
  - `SUPABASE_URL` `https://lajguozmtissnnfccmej.supabase.co`, the public project URL. It is already in every client bundle and pinned in `scripts/cf/build-target.mjs`.
  - `SITE_ORIGIN` `https://www.clickitstory.ae`
  - `EMAIL_DIGEST_ENABLED` `off`

  The same block and vars are in `env.production`. `RESEND_FROM_EMAIL` stays there unchanged. `triggers.crons` is untouched (top level `[]`; production keeps its three Phase 3 crons).
- `.dev.vars.example`: `RESEND_API_KEY=` and `EMAIL_LINK_SECRET=` (names only), with the comment "local preview only; real values never committed". `SUPABASE_SERVICE_ROLE_KEY=` was already listed.
- `tests/unit/worker-email-config.test.ts` (11 tests):
  - queue() source shape, and that errors propagate
  - both queues blocks equal the expected object
  - vars on both targets, with no var name containing KEY or SECRET and no RESEND_API_KEY / EMAIL_LINK_SECRET / SUPABASE_SERVICE_ROLE_KEY among them
  - crons untouched
  - `.dev.vars.example` holds names only
  - the consumer entries really come from custom-worker.ts
  - the import allow-list
  - a walker self-test that covers multi-line imports, `export from`, side-effect imports, dynamic imports, `with { type: 'json' }` and commented-out react imports
- `scripts/email-batch-cpu.mjs`: the CPU harness (Task 3, below).

## Import allow-list result

Walked from custom-worker.ts's two email imports. Visited, all inside the plan's list: `src/server/email/consumer.ts`, `deps.ts`, `transport.ts`, `links.ts`, `src/emails/render-app.ts`, `src/emails/app/model.ts`, `src/emails/app/template-fill.ts`, `src/emails/brand.ts`, `src/lib/email-tokens.ts`, `src/lib/email-constants.ts`, `src/generated/app-email-templates.json`. There are no bare specifiers (`ALLOWED_BARE` is empty) and the list was not extended.

## Bundle (Task 2)

`npm run cf:build`, then `wrangler@4 deploy --dry-run --outdir /Users/koss/.clickit-checks/p5-cf-dryrun`, run under heavy-run. The placeholder `NEXT_PUBLIC_*` env from CLAUDE.local.md was used because a worktree has no `.env.preview.local`. Log `/Users/koss/.clickit-checks/p5-cf-build.log` ends `exit=0`.

```
total_kib: 14433.11
gzip_kib: 2949.63
free_limit_gzip_kib: 3072 (3 MiB)
headroom_kib: 122.37
```

- **Last main deploy** (workers.dev 787ca3a, 2026-10-21): 14,220.67 / 2,933.31 KiB. This build is +16.32 KiB gzip, and that covers all of Phase 5 so far, not only the consumer.
- **05-07 React render spike** (scratch Worker): 266.56 KiB gzip. That path is not in the bundle.
- **05-11 render-app bundle**: 9.1 KiB gzip (151 KB raw, mostly the JSON).

Wrangler lists `env.EMAIL_QUEUE (clickit-email) Queue` and the four new vars among the bindings. The `import ... with { type: 'json' }` in `render-app.ts` was accepted by Next/Turbopack, OpenNext and wrangler (esbuild), so the JSON-attribute NEEDS CONTROLLER did not fire. `/Users/koss/.clickit-checks/p5-cf-dryrun` (34 MB) was removed. `.open-next` is gitignored (`git check-ignore` confirms) and was left in place. `git status --porcelain` shows no build output.

The headroom is 122 KiB. Phase 02-01 once measured 3,079 KiB (over the limit), so later plans that add app code to the Worker should watch this number.

## CPU measurement (Task 3)

Harness: `scripts/email-batch-cpu.mjs`, run in a fresh Node 26 process for each run.

- It uses the real `processBatch` and the real `buildEmailDeps`, so the claim and finish RPC requests, the Resend request, `renderAppEmail` on the pre-rendered templates with signed links, and the HMAC unsubscribe URL all run. Only `log` is replaced, with a no-op.
- `fetchStub` answers the three known URLs and throws `unexpected fetch <url>` on any other.
- Each batch has 5 rows:
  - digest EN: 5 shows, 3 rows x 3 episodes, one show without `image_url`, See all
  - digest AR
  - support_admin AR with the hostile name
  - welcome EN
  - newsletter_confirm AR
- Each run is 1 cold batch plus the mean of 50 warm batches. `buildEmailDeps` is inside each timed batch, as in queue().
- Every batch made exactly 5 Resend calls, acked 5 messages and retried none.

Rerun rule: every set-A run printed loadavg 4.01 (> 4), so set B ran and is the gating set. Logs: `/Users/koss/.clickit-checks/p5-email-batch-cpu.log` (set A) and `/Users/koss/.clickit-checks/p5-email-batch-cpu-b.log` (set B). Both end `exit=0` with five runs.

```
cpu_set: B
batch_fill_ms_cold_max: 14.44
batch_fill_ms_mean_max: 0.58
batch_fill_ms_cold: 13.48
batch_fill_ms_mean: 0.56
module_load_ms: 40.99
module_load_ms_max: 42.71
loadavg_median: 3.50
other_set_cold_max: 14.01
other_set_mean_max: 0.58
other_set_loadavg_median: 4.01
compare_05_07: batch_render_ms_cold: 29.45, batch_render_ms_mean: 4.28 (React render path)
gate: FAIL (cold max 14.44 >= 10; mean max 0.58 < 10)
```

Gate: `batch_fill_ms_cold_max` 14.44 ms is not under 10, so the plan ends with NEEDS CONTROLLER (below). The warm mean, 0.58 ms, is far under the limit. Compared with 05-07's React path, cold is 2.0x lower and warm is 7.4x lower.

Diagnostic (not part of the gate; uncommitted copy of the harness in the session scratchpad, run without the lock, 3 runs each). It pre-warms one thing before the cold batch:

| Pre-warm before the cold batch | Pre-warm cost | Cold batch |
|---|---|---|
| none | - | 12.85-13.35 ms |
| one WebCrypto HMAC importKey + sign | 1.6 ms | 11.96-12.42 ms |
| one `new Response(JSON.stringify(..)).json()` | 8.4-9.3 ms | 4.21-4.28 ms |
| both | - | 3.60-3.66 ms |

About 9 ms of the cold batch is Node lazy-loading its fetch/`Response` implementation (undici) the first time the stub builds a `Response`. The fill itself costs about 3.6 ms cold. In workerd, `Response`, `fetch` and WebCrypto are native and already loaded. My reading, which is not measured in workerd: the real cold batch is closer to 4 ms than to 14 ms.

`module_load_ms` (about 40 ms) includes Node's TypeScript stripping and the JSON parse. In the Worker this is bundled JS that runs at isolate startup, which has its own startup limit and is not part of per-invocation CPU.

Node on the Mac is not Worker CPU. The live check stays 05-36's consumer metrics.

NEEDS CONTROLLER: pre-rendered consumer batch over the Free 10 ms CPU limit (cold max 14.44 ms, mean max 0.58 ms, loadavg 3.50, set B); options: lower max_batch_size, profile the fill, or Workers Paid (Koss's pricing call)

Data for the decision, from the diagnostic above:
- The fill measures about 3.6 ms cold once Node's `Response` load is pre-warmed.
- Two more possible moves:
  - define the harness gate with a one-time `Response` pre-warm (Worker parity), then re-run sets A and B
  - accept 05-36's live consumer CPU metrics as the gate
- The design was not changed.

## Verification

Verified:
- Task 1 verify: `worker-email-config.test.ts` passes 11/11, and the no-secret grep on `wrangler.jsonc` prints nothing.
- Neighbouring tests: `cutover-config`, `scheduled`, `runtime-header` and `worker-request-paths` all pass (51 in total with the new file). `design-system-page` passes 17/17.
- `npm run test:unit`: 2548 pass, 0 fail. This run was after GREEN and before the layout fix. The layout fix touched one test file, which passes on its own.
- `npx tsc --noEmit` is clean.
- eslint on `custom-worker.ts`, the new test, the harness and the admin layout: 0 errors. One warning remains, `import/no-anonymous-default-export` on custom-worker.ts's default export, which was already there before this plan.
- Task 2 verify passes (`exit=0`, gzip line present).
- Task 3 acceptance greps: no react / react-email / @react-email import in the harness, and `unexpected fetch` appears on one line.

Not verified:
- A real queue in `wrangler dev` (05-39)
- Live queues: they do not exist yet; Koss creates them in 05-35
- workerd CPU

Failed:
- Task 3 automated verify: the awk gate exits 1 because `batch_fill_ms_cold_max` is 14.44.

## Deviations from Plan

**1. [Rule 3 - Blocking] Queues and vars mirrored into `env.production`.** Main's 03-01 drift test (`tests/unit/cutover-config.test.ts`) requires every non-inheritable key (it lists `queues`) to be copied unchanged into `env.production`. It also requires production vars to equal the top-level vars plus exactly `RESEND_FROM_EMAIL`. Without the mirror, the production deploy would have no queue binding and that test would fail. The new test asserts both targets. Commit `78acf53c`.

**2. [Rule 1 - Bug] Admin layout swallowed Next's dynamic bailout.** Since 05-15, `src/app/[locale]/admin/layout.tsx` wraps `requireAdmin()` in a bare `catch`. That catch also caught the `cookies()` dynamic-rendering signal, so `next build` tried to prerender `/en/admin/settings`. The page then threw at `createAdminClient()` (no service key at build time) and `cf:build` failed with `Export encountered an error on /[locale]/admin/settings/page`. The fix is `unstable_rethrow(e)` from `next/navigation` (Next 16.4.2) as the first line of the catch. Redirect behaviour is unchanged, and `design-system-page.test.ts` pins it. Commit `56379b92`.

**3. [Minor] `queue(batch, env)` without the `ctx` parameter.** The plan's sketch has a third `ctx` argument. It is unused and would add an eslint warning. Workers still pass it, and it is ignored.

**4. [Minor] `.dev.vars.example`.** `SUPABASE_SERVICE_ROLE_KEY=` was already listed, so only `RESEND_API_KEY=` and `EMAIL_LINK_SECRET=` were added.

**5. [Environment] Concurrent commits on the branch.** During this plan another session committed `ad2e7fdf` and `84c248f8` (05-17) on the same branch. Only 05-19 paths were staged here.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register.
- T-05-19-01: vars are public only, and the test refuses secret names.
- T-05-19-02: the batch is 5, the bundle is measured, and the CPU is measured. The cold result is escalated, not hidden.
- T-05-19-03: the DLQ is declared.
- T-05-19-04: the allow-list test is in place.
- T-05-19-05: the harness uses fake strings, the stub throws on unknown URLs, and nothing reads `.dev.vars`.

## Self-Check: PASSED

The files exist: custom-worker.ts, wrangler.jsonc, .dev.vars.example, tests/unit/worker-email-config.test.ts and scripts/email-batch-cpu.mjs. Commits 22aacc74, 78acf53c, 56379b92 and cef589a1 are in `git log`. The plan-level CPU gate fails by design; see NEEDS CONTROLLER above.
