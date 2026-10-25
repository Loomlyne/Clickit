---
phase: 05-accounts-and-email
plan: 19
subsystem: email-queue-worker
tags: [cloudflare-queues, worker, wrangler, consumer, cpu, bundle, workers-free]
requires: ["05-08", "05-11", "05-16"]
provides: [custom-worker queue() handler, clickit-email producer/consumer/DLQ config, email vars, worker-email-config test, email-batch-cpu harness, takeEmailCpuProbe (test-only, off by default), email-cpu-probe-send, cf:bundle-budget in gate:local, handover 05-19-workersdev-cpu]
affects: [05-20, 05-35, 05-36, 05-39]
tech-stack:
  added: []
  patterns: ["queue() awaits processBatch and lets errors propagate (batch redelivered)", "queues block mirrored into env.production (not inherited)", "consumer import allow-list walked from custom-worker.ts"]
key-files:
  created:
    - tests/unit/worker-email-config.test.ts
    - scripts/email-batch-cpu.mjs
    - src/server/email/cpu-probe.ts
    - scripts/email-cpu-probe-send.mjs
    - scripts/cf/bundle-budget.mjs
    - tests/unit/email-cpu-probe.test.ts
    - tests/unit/email-cpu-probe-send.test.ts
    - tests/unit/bundle-budget.test.ts
    - .planning/handovers/05-19-workersdev-cpu.md
  modified:
    - package.json
    - custom-worker.ts
    - wrangler.jsonc
    - .dev.vars.example
    - src/app/[locale]/admin/layout.tsx
    - tests/unit/design-system-page.test.ts
key-decisions:
  - "queues block and the four email vars are repeated in env.production: wrangler does not inherit queues or vars, and main's cutover drift test (03-01) requires every non-inheritable key and every top-level var to be copied"
  - "queue() takes (batch, env) only; the ctx argument is unused, and dropping it avoids a new no-unused-vars warning"
  - "Admin layout calls unstable_rethrow(e) first in its requireAdmin() catch; without it next build prerendered /en/admin/settings and failed"
  - "First CPU run: set B cold max 14.44 ms (no warm-up) -> NEEDS CONTROLLER; controller chose option A with three conditions (2026-10-25)"
  - "Controller condition 1: the harness warms up only Worker built-ins (Response, Headers, fetch via data: URL) before the timed cold batch and gates on that; no-warm-up figures kept. Set B cold max 5.09 ms, mean max 0.58 ms: PASS"
  - "Controller condition 2: the real gate is a workers.dev queue batch measured by the controller (handover 05-19-workersdev-cpu.md); test-only probe in queue(), off by default (EMAIL_CPU_PROBE=until:<UTC>, max 24 h), in-process fetch, no DB, no network, no email"
  - "Controller condition 3: gate:local fails above 3,000 KiB gzip (cf:bundle-budget, local wrangler dry run, works with network denied); branch 2,952.21 KiB vs main bd86953f 2,932.33 KiB"
requirements-completed: []
duration: 45min
completed: 2026-10-25
status: code complete; Mac CPU gate PASS with built-in warm-up; workers.dev CPU gate pending (controller runbook)
---

# Phase 5 Plan 19: Queue consumer on the Worker Summary

**`custom-worker.ts` now has `queue()` running `processBatch(batch, buildEmailDeps({ ...env, CLICKIT_RUNTIME: 'workers' }))`. `wrangler.jsonc` declares the `clickit-email` producer, the consumer (batch 5, timeout 5, retries 5, delay 60) and the DLQ `clickit-email-dlq`, plus the public email vars, on both targets. The Worker builds at 2,949.63 KiB gzip, under the 3 MiB Free limit. The consumer's import graph is React-free. With only the Worker built-ins warmed up (Response, Headers, fetch), the Mac cold batch is at most 5.09 ms (14.44 to 15.01 ms without warm-up: Node lazy-loads undici). The real gate is a workers.dev batch the controller measures with a test-only probe that is off by default. gate:local now fails when the bundle is above 3,000 KiB gzip.**

## Tasks

| # | Task | Commit |
|---|------|--------|
| 1 (RED) | Failing test for queue wiring and import allow-list | `22aacc74` |
| 1 (GREEN) | queue() handler, queues, vars, `.dev.vars.example` | `78acf53c` |
| 2 | Build and bundle measure (+ blocking fix in the admin layout) | `56379b92` |
| 3 | CPU harness and measurement | `cef589a1` |
| C2 | Test-only CPU probe in queue(), off by default | `d0209476` |
| C1 | Harness warms Worker built-ins, logs both cold figures | `ec1d0e65` |
| C2 | Probe batch sender (refuses without the confirm flag) | `2cf2e6a7` |
| C3 | gate:local bundle budget (3,000 KiB gzip) | `122c141e` |

C1 to C3 are the controller's three conditions on option A (2026-10-25).

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

- `src/server/email/cpu-probe.ts` (C2): `takeEmailCpuProbe(batch, env.EMAIL_CPU_PROBE)` runs first in `queue()`.
  - It takes only messages tagged `{ probe: 'email-cpu-v1' }`. Other messages go on to `processBatch(rest, buildEmailDeps(...))` unchanged, and when a batch has no probe messages the same batch object is returned.
  - Flag off (the default): probe messages are acked and dropped.
  - Flag on (`until:<UTC>`, in the future, at most 24 h ahead): they run through the real `processBatch` and `buildEmailDeps`, on fixed fake env values and an in-process fetch. Claim, finish and Resend are answered there and anything else throws, so a probe makes no subrequest, no DB call and no email.
  - It also holds the shared fixtures, used by the Mac harness too.
- `scripts/email-cpu-probe-send.mjs` (C2): pushes one batch of 5 probe messages through the Queues HTTP push API. It uses the pinned OAuth login, and the token stays in memory. It refuses without `--confirm-workersdev-probe`, without the pinned HOME, or with a token env set.
- `scripts/cf/bundle-budget.mjs` and `npm run cf:bundle-budget` (C3): run in `gate:local` after `cf:build`.

## Import allow-list result

Walked from custom-worker.ts's email imports. Visited, all inside the list: `src/server/email/consumer.ts`, `deps.ts`, `transport.ts`, `links.ts`, `cpu-probe.ts`, `src/emails/render-app.ts`, `src/emails/app/model.ts`, `src/emails/app/template-fill.ts`, `src/emails/brand.ts`, `src/lib/email-tokens.ts`, `src/lib/email-constants.ts`, `src/generated/app-email-templates.json`. There are no bare specifiers (`ALLOWED_BARE` is empty).

The list was extended by one file, with this reason (also in the test): `src/server/email/cpu-probe.ts`, controller condition 2. It is a test-only CPU probe, off by default, and holds only fixtures and an in-process fetch stub, with no imports beyond `consumer.ts` and `deps.ts`.

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

### Bundle budget (controller condition 3)

`gate:local` is now `... && npm run build && npm run cf:build && npm run cf:bundle-budget`.

How `cf:bundle-budget` works:
- It runs the repo's own `node_modules/.bin/wrangler deploy --dry-run --outdir <tmp>`. That is never npx, so there is no registry fetch. It uses the pinned HOME and metrics off.
- It parses the last `Total Upload: <n> <unit> / gzip: <n> <unit>` line.
- It fails when gzip is above `BUDGET_GZIP_KIB = 3000` (the Free limit is 3,072 KiB).
- It refuses when `.open-next/worker.js` is missing.
- Unit tests in `tests/unit/bundle-budget.test.ts` cover the parser (KiB and MiB, last line wins, no line), the inclusive threshold, the gate:local wiring, and the use of the repo binary.

Result:

```
bundle-budget ok gzip=2952.21 KiB total=14441.42 KiB budget=3000 KiB headroom=47.79 KiB
```

It ran under `sandbox-exec` with all outbound network denied, so it works offline. It ran on the current sources: the wrangler step rebundles custom-worker.ts, so the probe is included, over the `.open-next` from the Task 2 build.

**The budget headroom is now 47.79 KiB.** Phase 5's remaining app plans (05-21/05-28 importing `outbox.ts` into the Next server) will eat into it.

### Largest additions vs main (controller condition 3)

Method:
- Main is `origin/main` `bd86953f`, which is an ancestor of this branch. It was built in a clean clone (`git clone --reference`, `npm ci`, `cf:build` with the same placeholder env), then put through a local `wrangler deploy --dry-run --metafile`. Script `/Users/koss/.clickit-checks/p5-main-bundle.sh`, log `/Users/koss/.clickit-checks/p5-main-bundle.log`, which ends `exit=0`. The clone was removed.
- The branch is the `cf:bundle-budget` run above, with `--metafile /Users/koss/.clickit-checks/p5-branch-meta.json`.
- `bytesInOutput` was summed per input for both wrangler metafiles, and also for OpenNext's `handler.mjs.meta.json`.

Totals: main 2,932.33 KiB gzip and branch 2,952.21 KiB gzip, so **+19.88 KiB gzip** (+224,509 bytes raw).

| # | Addition (raw bytes in the uploaded bundle) | Raw | gzip (approx.) |
|---|---|---|---|
| 1 | `src/generated/app-email-templates.json`, the pre-rendered templates. esbuild inlines them for the consumer path; the 98,022-byte file grows to 136,773 bytes once re-serialized. | +136,773 | about 5 to 8 KiB (the file alone gzips to 4,786 B) |
| 2 | The Next server, `.open-next/server-functions/default/handler.mjs`. Inside it: AR messages +23,479 and EN messages +7,249 (Phase 5 auth/account strings), and the Next runtime +18,978 (newly used APIs). Turbopack chunk renames account for the rest. | +44,639 | message catalogs about +5.0 KiB (en +2,319 B, ar +2,726 B) |
| 3 | Consumer-path code: `cpu-probe.ts` 7,926, `app/model.ts` 6,627, `consumer.ts` 5,992, `template-fill.ts` 4,871, `transport.ts` 4,814, `deps.ts` 3,216, `links.ts` 1,773, `brand.ts` 1,547, `render-app.ts` 1,430 | +38,196 | about 8 to 10 KiB (sources with comments gzip to 19,320 B, an upper bound) |

The gzip column is an estimate: wrangler reports gzip for the whole upload only. The per-input raw numbers come from the metafiles. The total gzip delta (+19.88 KiB) is measured.

## CPU measurement (Task 3)

Harness: `scripts/email-batch-cpu.mjs`. Each run is two fresh Node 26 processes.

- **Gating process.** It first warms up only the platform built-ins a Worker already has: `new Headers`, `new Response(...).json()` and `fetch('data:...')`, which never touches the network. None of our own modules, templates or deps are warmed. workerd ships these natively and preloaded, while Node lazy-loads undici on first touch (`warmup_ms` is about 11 ms on the Mac). Then it times the import of `consumer.ts` + `deps.ts` (`module_load_ms`), one cold batch, and the mean of 50 warm batches.
- **Record process.** A `--no-warmup` child does the same without the warm-up (`*_nowarm`).

The batch runs the real `processBatch` and the real `buildEmailDeps`, on the fixtures and in-process fetch of `src/server/email/cpu-probe.ts`, which are the same ones the workers.dev probe uses:
- digest EN: 5 shows, 3 rows x 3 episodes, one show without `image_url`, See all
- digest AR
- support_admin AR with the hostile name
- welcome EN
- newsletter_confirm AR

Every batch made exactly 5 Resend calls, acked 5 messages and retried none. `buildEmailDeps` is inside each timed batch.

Rerun rule: set A ran at loadavg 5.34 (> 4), so set B ran and gates. Set B's own loadavg was 6.01: another executor was working on the machine. Logs: `/Users/koss/.clickit-checks/p5-email-batch-cpu.log` (set A) and `/Users/koss/.clickit-checks/p5-email-batch-cpu-b.log` (set B). Both end `exit=0` with five runs. The first run (no warm-up, 21:55Z) was replaced by these logs; its figures are kept in the comparison lines.

```
cpu_set: B
cpu_warmup: builtins
batch_fill_ms_cold_max: 5.09
batch_fill_ms_mean_max: 0.58
batch_fill_ms_cold: 4.35
batch_fill_ms_mean: 0.58
module_load_ms: 40.21
module_load_ms_max: 41.58
loadavg_median: 6.01
warmup_ms_median: 11.44
nowarm_cold_max: 15.01
nowarm_cold_median: 14.46
nowarm_mean_max: 0.64
nowarm_module_load_ms_median: 40.41
other_set_cold_max: 5.22
other_set_mean_max: 0.62
other_set_nowarm_cold_max: 13.93
other_set_nowarm_mean_max: 0.60
other_set_loadavg_median: 5.34
first_run_nowarm_cold_max: 14.44 (set B, 21:55Z, before condition 1)
compare_05_07: batch_render_ms_cold: 29.45, batch_render_ms_mean: 4.28 (React render path)
gate: PASS (built-in warm-up: cold max 5.09 < 10, mean max 0.58 < 10)
```

| Set | cold max (warm-up) | mean max (warm-up) | cold max (no warm-up) | mean max (no warm-up) | loadavg |
|---|---|---|---|---|---|
| A | 5.22 | 0.62 | 13.93 | 0.60 | 5.34 |
| B (gates) | 5.09 | 0.58 | 15.01 | 0.64 | 6.01 |

Plan gate, updated for condition 1 (the gating lines are the warm-up figures; the `nowarm_` and `other_set_` lines never repeat the `batch_fill_ms_` prefix):

```
awk '/^cpu_warmup:/{w=$2} /^batch_fill_ms_cold_max:/{c=$2} /^batch_fill_ms_mean_max:/{m=$2} /^module_load_ms:/{l=$2} END{exit !(w=="builtins" && c!="" && m!="" && l!="" && c<10 && m<10)}' .planning/phases/05-accounts-and-email/05-19-SUMMARY.md
```

Node on the Mac is not Worker CPU. `module_load_ms` includes Node's TypeScript stripping and JSON parse; in the Worker that is bundled JS run at isolate startup, not per-invocation CPU. **The real gate is the workers.dev cold batch below (condition 2). After cutover, 05-36's consumer metrics watch it.**

## Workers.dev CPU gate (controller condition 2, pending)

The runbook is in `.planning/handovers/05-19-workersdev-cpu.md`. In short:

1. Queues `clickit-email` and `clickit-email-dlq` must exist (05-35). No separate test queue is needed: probe messages are tagged and handled in-process.
2. The controller deploys `122c141e` (or any later commit with `d0209476`; it must be on GitHub) to workers.dev through `deploy-workersdev.sh` with the sha edited.
3. `wrangler tail clickit --format json > /Users/koss/.clickit-checks/p5-probe-tail.jsonl`
4. `printf 'until:%s' "$(date -u -v+2H +%Y-%m-%dT%H:%M:%SZ)" | HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 secret put EMAIL_CPU_PROBE --name clickit` (a new version, so the next batch is cold).
5. `node --experimental-strip-types ... scripts/email-cpu-probe-send.mjs --confirm-workersdev-probe --run cold-1`
6. Filter: `jq -c 'select(.event.queue == "clickit-email") | {at: (.eventTimestamp/1000 | todate), outcome, cpuTime, wallTime, batchSize: .event.batchSize, logs: [.logs[]?.message[]?]}'`
7. Take three cold samples. Then `wrangler secret delete EMAIL_CPU_PROBE --name clickit`.

Gate: `outcome` `ok`, `batchSize` 5, `sends=5`, and the largest `cpuTime` < 10 ms.

Results go here once the controller has run it (none yet):

```
workersdev_commit:
workersdev_cold_cpu_ms:
workersdev_cold_cpu_ms_max:
workersdev_warm_cpu_ms:
workersdev_gate:
```

Not verified:
- That wrangler 4.151.2's tail JSON prints `cpuTime`. It is a `TraceItem` field in `@cloudflare/workers-types`; the fallback is the dashboard invocation CPU time.
- That the pinned OAuth login can push messages. Its scope list includes `queues:write`; the fallback is the dashboard Send message.

## Verification

Verified:
- Task 1 verify: `worker-email-config.test.ts` passes (13 tests, now including the probe flag check), and the no-secret grep on `wrangler.jsonc` prints nothing.
- New tests pass: `email-cpu-probe` (7) for the flag window, the tag, refusal with the flag off, 5 inert sends with no network when on, malformed bodies, and the stub URLs. `email-cpu-probe-send` (4) and `bundle-budget` (4) pass too.
- `npm run test:unit` at the end: 2585 pass, 0 fail.
- `npx tsc --noEmit` is clean.
- eslint on every touched file: 0 errors. One warning remains, `import/no-anonymous-default-export` on custom-worker.ts's default export, which was already there before this plan.
- The sender refuses as designed: run without the flag and with the wrong HOME, it printed both reasons and exited 1.
- Task 2 verify passes. `cf:bundle-budget` passes at 2,952.21 KiB gzip with network denied.
- Task 3 verify, gating on the warm-up lines, passes: the set-A log ends `exit=0` with five `runA[1-5] batch_fill_ms_cold:` lines, and the updated awk gate above exits 0. No react / react-email / @react-email import in the harness or probe. `unexpected fetch` now sits in `src/server/email/cpu-probe.ts` (one line), because the harness imports the shared stub.

Not verified:
- The workers.dev CPU gate (controller runbook, pending)
- A real queue in `wrangler dev` (05-39)
- Live queues: they do not exist yet (05-35)
- That the tail JSON has `cpuTime`
- That the OAuth token can push messages

Failed: none.

## Deviations from Plan

**1. [Rule 3 - Blocking] Queues and vars mirrored into `env.production`.** Main's 03-01 drift test (`tests/unit/cutover-config.test.ts`) requires every non-inheritable key (it lists `queues`) to be copied unchanged into `env.production`. It also requires production vars to equal the top-level vars plus exactly `RESEND_FROM_EMAIL`. Without the mirror, the production deploy would have no queue binding and that test would fail. The new test asserts both targets. Commit `78acf53c`.

**2. [Rule 1 - Bug] Admin layout swallowed Next's dynamic bailout.** Since 05-15, `src/app/[locale]/admin/layout.tsx` wraps `requireAdmin()` in a bare `catch`. That catch also caught the `cookies()` dynamic-rendering signal, so `next build` tried to prerender `/en/admin/settings`. The page then threw at `createAdminClient()` (no service key at build time) and `cf:build` failed with `Export encountered an error on /[locale]/admin/settings/page`. The fix is `unstable_rethrow(e)` from `next/navigation` (Next 16.4.2) as the first line of the catch. Redirect behaviour is unchanged, and `design-system-page.test.ts` pins it. Commit `56379b92`.

**3. [Minor] `queue(batch, env)` without the `ctx` parameter.** The plan's sketch has a third `ctx` argument. It is unused and would add an eslint warning. Workers still pass it, and it is ignored.

**4. [Minor] `.dev.vars.example`.** `SUPABASE_SERVICE_ROLE_KEY=` was already listed, so only `RESEND_API_KEY=` and `EMAIL_LINK_SECRET=` were added.

**5. [Environment] Concurrent commits on the branch.** During this plan another session committed `ad2e7fdf` and `84c248f8` (05-17) on the same branch, and 05-25 ran alongside the controller conditions. Only 05-19 paths were staged here. STATE.md and ROADMAP.md were left to the coordinator for the condition round.

**6. [Controller condition 1] The harness gates on a built-in warm-up.** The plan's cold batch had no warm-up. The controller (option A) set the gate to cold-with-built-ins-warmed (Response, Headers, fetch), with the no-warm-up figures kept. The harness now imports fixtures and the stub from `cpu-probe.ts`, so the plan's acceptance grep for `unexpected fetch` matches that file instead of the script.

**7. [Controller condition 2] Test-only probe in the production consumer path.** `queue()` now runs `takeEmailCpuProbe` before `processBatch`, so the plan's key-link pattern `processBatch(batch, buildEmailDeps(env` became `processBatch(rest, buildEmailDeps({ ...env, ... }))`. The consumer allow-list gained `cpu-probe.ts`, with its reason in the test and above. The probe is off unless `EMAIL_CPU_PROBE` holds a future window of 24 h or less. With the flag off it acks probe messages without touching anything; with the flag on it never leaves the Worker. It never touches untagged messages.

**8. [Controller condition 3] `gate:local` gained `cf:bundle-budget`.** It changes `package.json`, which was not in the plan's file list.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register.
- T-05-19-01: vars are public only, and the test refuses secret names.
- T-05-19-02: the batch is 5, the bundle is measured, and the CPU is measured. The cold result is escalated, not hidden.
- T-05-19-03: the DLQ is declared.
- T-05-19-04: the allow-list test is in place.
- T-05-19-05: the harness uses fake strings, the stub throws on unknown URLs, and nothing reads `.dev.vars`.

| Flag | File | Description |
|------|------|-------------|
| threat_flag: test-path | src/server/email/cpu-probe.ts | Queue messages tagged `email-cpu-v1` are acked without the outbox. Mitigation: they are acked only, never sent and never written. The flag is off by default and is a self-expiring window of 24 h or less. Untagged messages are untouched. Unit tests cover it. |
| threat_flag: cloudflare-api | scripts/email-cpu-probe-send.mjs | Pushes to a queue with the pinned OAuth token. Mitigation: it needs an explicit confirm flag and the pinned HOME, refuses token envs, keeps the token in memory only, never echoes output, and pushes one batch of 5 probe messages. |

## Self-Check: PASSED

The files exist: custom-worker.ts, wrangler.jsonc, .dev.vars.example, tests/unit/worker-email-config.test.ts, scripts/email-batch-cpu.mjs, src/server/email/cpu-probe.ts, scripts/email-cpu-probe-send.mjs, scripts/cf/bundle-budget.mjs, the three new tests and .planning/handovers/05-19-workersdev-cpu.md. Commits 22aacc74, 78acf53c, 56379b92, cef589a1, d0209476, ec1d0e65, 2cf2e6a7 and 122c141e are in `git log`. The Mac CPU gate (warm-up lines) passes. The workers.dev CPU gate is pending with the controller.
