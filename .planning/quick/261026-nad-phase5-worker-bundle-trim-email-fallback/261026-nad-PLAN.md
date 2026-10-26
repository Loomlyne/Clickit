---
phase: quick-261026-nad
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/email/queue.ts
  - src/server/email/queue-local.ts
  - src/server/email/queue-select.ts
  - next.config.ts
  - scripts/cf/build-target.mjs
  - tests/unit/email-queue-select.test.ts
  - .planning/quick/261026-nad-phase5-worker-bundle-trim-email-fallback/261026-nad-SUMMARY.md
autonomous: true
requirements: [MAIL-07]

must_haves:
  truths:
    - "In a cf:build (preview, workersdev, production) the Next server has no code path to the in-process email queue: no consumer, no deps, no app-email templates JSON in the Next server output"
    - "Under next dev and next start with no EMAIL_QUEUE binding, getEmailQueue() still returns the in-process queue (loaded with a dynamic import)"
    - "A Worker build with no EMAIL_QUEUE binding throws 'EMAIL_QUEUE binding missing' (fail closed, T-05-16-03 kept)"
    - "custom-worker.ts queue() is untouched and still bundles processBatch + buildEmailDeps directly"
    - "cf:bundle-budget gzip is below the 2,984.77 KiB before-figure, and the wrangler bundle holds ONE copy of the app email templates JSON, not two"
  artifacts:
    - path: "src/server/email/queue-select.ts"
      provides: "Pure selectEmailQueue() decision (no server-only, no @/ imports), unit-testable under node --test"
      exports: ["selectEmailQueue", "LocalQueueLoader"]
    - path: "src/server/email/queue-local.ts"
      provides: "createInProcessQueue() moved out of queue.ts; the only Next-graph importer of consumer.ts and deps.ts"
      exports: ["createInProcessQueue"]
    - path: "src/server/email/queue.ts"
      provides: "getEmailQueue(); dynamic import of queue-local.ts guarded by the build-time constant"
      contains: "process.env.CLICKIT_WORKER_BUILD === '1'"
    - path: "next.config.ts"
      provides: "compiler.defineServer inlining process.env.CLICKIT_WORKER_BUILD into server code"
      contains: "defineServer"
    - path: "scripts/cf/build-target.mjs"
      provides: "nextBuildEnv() adds CLICKIT_WORKER_BUILD=1 to the opennextjs-cloudflare build env for every target"
      exports: ["nextBuildEnv", "WORKER_BUILD_FLAG"]
    - path: "tests/unit/email-queue-select.test.ts"
      provides: "Both paths (Worker build, node fallback) + source invariants"
  key_links:
    - from: "scripts/cf/build-target.mjs"
      to: "next.config.ts"
      via: "CLICKIT_WORKER_BUILD=1 in the spawn env of opennextjs-cloudflare build"
      pattern: "nextBuildEnv\\("
    - from: "next.config.ts"
      to: "src/server/email/queue.ts"
      via: "compiler.defineServer replaces process.env.CLICKIT_WORKER_BUILD with \"1\" (Worker build) or \"\" (other builds)"
      pattern: "'process.env.CLICKIT_WORKER_BUILD'"
    - from: "src/server/email/queue.ts"
      to: "src/server/email/queue-local.ts"
      via: "import('./queue-local.ts') only in the non-Worker branch"
      pattern: "import\\('./queue-local.ts'\\)"
---

<objective>
Remove the second copy of the email consumer and the pre-rendered app email templates from the Worker bundle. The in-process email fallback in `src/server/email/queue.ts` becomes unreachable in the Workers build through a build-time constant that Turbopack folds away. `next dev` and `next start` keep the fallback through a dynamic `import()`.

Controller decision: option A, modified 2026-10-26. Fallback B (moving the fallback out of the Next graph) is NOT in scope. Only the controller decides it.

Purpose: the 05-21 build left 15.23 KiB of headroom under the 3,000 KiB gate:local budget, and 05-22 to 05-28 still add code.
Output: the code change, a unit test for both paths, measured before/after KiB and template-copy counts in the SUMMARY.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@src/server/email/queue.ts
@scripts/cf/build-target.mjs
@next.config.ts
@custom-worker.ts
@.planning/phases/05-accounts-and-email/05-21-SUMMARY.md

<shared_branch_rules>
- Branch `claude/phase-05-accounts-and-email-61ece8`. Another executor (05-27, admin list files) commits on this branch in this same worktree at the same time.
- Stage ONLY this plan's files, by explicit path (`git add <path> ...`). Never `git add -A` or `git add .`. Never stage their files (for example `src/server/admin-directory.ts`).
- Do not push. Do not edit `.planning/STATE.md` or `.planning/ROADMAP.md`: the orchestrator does that.
- Never run `git stash`.
- Do NOT touch the wrangler minify setting (`wrangler.jsonc`). Do NOT touch `custom-worker.ts`.
- Never `supabase db reset`. This plan needs no database.
</shared_branch_rules>

<research_findings>
The planner checked Next 16.4.2 in node_modules. Use these findings; do not repeat the research.
- Plain `process.env.X` in server code is NOT inlined. Next reads it at runtime. Only `NEXT_PUBLIC_*` values (client), the `env` key in next.config, and `compiler.define`/`compiler.defineServer` values are replaced at build time.
- `next.config` `env` is unsafe for this. `node_modules/next/dist/build/define-env.js` (around lines 236-246) leaves `nextConfigEnv` keys as `process.env.X` (not inlined) when `omitNonDeterministic` is set.
- `compiler.defineServer` is used. It is documented in `node_modules/next/dist/docs/03-architecture/nextjs-compiler.md` (line 268): it defines variables for server and edge code only. `define-env.js` lines 221-230 add it only for `isNodeServer || isEdgeServer`, and `serializeDefineEnv` JSON-stringifies each value. Turbopack gets it through `build/swc/index.js` `getDefineEnv` (lines 399-421). With a value of `'1'`, `process.env.CLICKIT_WORKER_BUILD` becomes the literal `"1"`. Turbopack constant-folds `"1" === "1"` and does not follow `import()` in the dead branch. This is the same mechanism as the `process.env.NODE_ENV === 'development'` dead-import pattern.
- Defining a key that is already in defineEnv throws at build time. `process.env.CLICKIT_WORKER_BUILD` is not a Next built-in, so there is no clash.
- OpenNext runs `next build` with the env that `build-target.mjs` passes to `spawnSync('npx', ['opennextjs-cloudflare', 'build'], { env })`, so a flag in that env reaches next.config.ts.
- Before state, measured by the planner on the current `.open-next` (stamp gitSha 40bba4d, the 05-21 build): the marker string `plan 05-11). Generated file: do not edit` (from the JSON `generatedBy` field) appears once in `.open-next/server-functions/default/handler.mjs`. It is inlined in the server-action chunk `_next-internal_server_app_[locale]_(viewer)_auth_page_actions_*.js`. The consumer copy comes from `custom-worker.ts` when wrangler bundles. So the final wrangler bundle holds 2 copies before the change.
- Current importers of `consumer.ts`/`deps.ts` in `src/`: only `queue.ts` (the fallback) and `cpu-probe.ts`. `cpu-probe.ts` is imported only by `custom-worker.ts`, so after this change the Next graph has no path to them.
- Unit tests run with `node --experimental-strip-types --test`. Files that import `server-only` or `@/` aliases cannot run there, so the repo keeps a pure core module plus source-level invariant tests (see `tests/unit/admin-access.test.ts` lines 169-170).
</research_findings>

<interfaces>
From src/server/cloudflare.ts:
  export type QueueLike = { send(body: unknown): Promise<void>; sendBatch(messages: { body: unknown }[]): Promise<void> }
  getWorkerEnv() resolves the Worker env; `.EMAIL_QUEUE` is QueueLike | undefined.

From src/server/email/consumer.ts:
  export function processBatch(batch, deps)
  export type MessageLike

From src/server/email/deps.ts:
  export function buildEmailDeps(env)

Callers of getEmailQueue() (public API unchanged: `getEmailQueue(): Promise<QueueLike>`):
  src/server/auth/after-sign-in.ts (imports '@/server/email/queue')
  src/server/email/outbox.ts (imports './queue.ts')

From scripts/cf/build-target.mjs main():
  const minimal = { HOME: CLICKIT_HOME, WRANGLER_SEND_METRICS: 'false' } (+ PATH, TMPDIR, LANG, TERM)
  spawnSync('npx', ['opennextjs-cloudflare', 'build'], { env: { ...minimal, ...buildEnv }, stdio: 'inherit' })
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Build-time constant, split fallback module, unit tests for both paths</name>
  <files>src/server/email/queue-select.ts, src/server/email/queue-local.ts, src/server/email/queue.ts, next.config.ts, scripts/cf/build-target.mjs, tests/unit/email-queue-select.test.ts</files>
  <behavior>
    Write tests/unit/email-queue-select.test.ts first (RED, the module is not found), using node:test and node:assert/strict like tests/unit/outbox-enqueue.test.ts:
    - Test 1: a bound queue is returned as-is. The loader is not called, whether loadLocal is null or a function.
    - Test 2 (Worker build path): bound undefined, loadLocal null → rejects with /EMAIL_QUEUE binding missing/.
    - Test 3: bound undefined, runtime 'workers', loadLocal is a spy → rejects with /EMAIL_QUEUE binding missing/ and the spy is never called.
    - Test 4 (node fallback path): bound undefined, runtime undefined (and runtime 'node'), loadLocal is a spy returning a fake QueueLike → resolves to that fake and the spy is called exactly once.
    - Test 5 (source invariants, readFileSync on src/server/email/queue.ts with comment lines stripped before matching): no line matches /^import\s+(?!type\b).*from\s+'\.\/(consumer|deps)(\.ts)?'/m; the text contains `process.env.CLICKIT_WORKER_BUILD === '1'` and exactly one `import('./queue-local.ts')`, and the import appears after the constant check.
    - Test 6 (source invariants): src/server/email/queue-local.ts exports createInProcessQueue and imports processBatch from './consumer.ts' and buildEmailDeps from './deps.ts'. next.config.ts contains `defineServer` and `'process.env.CLICKIT_WORKER_BUILD'`. custom-worker.ts still imports processBatch from './src/server/email/consumer.ts' (the queue() consumer path is untouched).
    - Test 7: import { nextBuildEnv, WORKER_BUILD_FLAG } from '../../scripts/cf/build-target.mjs'. WORKER_BUILD_FLAG === 'CLICKIT_WORKER_BUILD'. nextBuildEnv({ HOME: 'h', PATH: 'p' }, { NEXT_PUBLIC_SITE_URL: 's' }) deep-equals { HOME: 'h', PATH: 'p', NEXT_PUBLIC_SITE_URL: 's', CLICKIT_WORKER_BUILD: '1' }. A buildEnv that tries CLICKIT_WORKER_BUILD: '' still ends as '1' (the flag is applied last). The build-target.mjs source contains `nextBuildEnv(minimal, buildEnv)` inside the opennextjs-cloudflare spawn.
  </behavior>
  <action>
    1. Create `src/server/email/queue-select.ts`. It is pure, with no 'server-only' and no '@/' imports; it uses `import type { QueueLike } from '../cloudflare.ts'`. Export `type LocalQueueLoader = (() => Promise<QueueLike>) | null` and `async function selectEmailQueue(input: { bound: QueueLike | undefined; runtime: string | undefined; loadLocal: LocalQueueLoader }): Promise<QueueLike>`. Order: if bound, return bound. If loadLocal is null, throw `new Error('EMAIL_QUEUE binding missing')`: a Worker build has no in-process fallback. If runtime === 'workers', throw the same message (T-05-16-03 kept). Otherwise return `await loadLocal()`.
    2. Create `src/server/email/queue-local.ts` with `import 'server-only'`. Move `createInProcessQueue()` and the LOG_PREFIX `[email/queue-local]` out of queue.ts verbatim and export createInProcessQueue. The static imports of processBatch, type MessageLike, buildEmailDeps and type QueueLike live here now. The header comment says this module is reached only through the dynamic import in queue.ts and never in a cf:build.
    3. Rewrite `src/server/email/queue.ts`. Keep `import 'server-only'`, getWorkerEnv, `import type { QueueLike }` and workerQueue() unchanged. Remove every import of consumer.ts and deps.ts, the type import included. Add a module-level `const loadLocal: LocalQueueLoader = process.env.CLICKIT_WORKER_BUILD === '1' ? null : async () => (await import('./queue-local.ts')).createInProcessQueue()`. This must be the literal `import('./queue-local.ts')` expression: no variable path, and not wrapped in a helper defined elsewhere. Otherwise Turbopack cannot drop the chunk. getEmailQueue() becomes `return selectEmailQueue({ bound: await workerQueue(), runtime: process.env.CLICKIT_RUNTIME, loadLocal })`. Rewrite the header comment: the constant is replaced at build time by next.config.ts compiler.defineServer. The cf:build scripts set it to "1", so Turbopack folds the branch and emits no chunk for the fallback (the Worker uploads every chunk). Under next dev and next start it is "", and the fallback loads lazily. Keep its public signature `getEmailQueue(): Promise<QueueLike>`.
    4. In `next.config.ts`, add `compiler: { defineServer: { 'process.env.CLICKIT_WORKER_BUILD': process.env.CLICKIT_WORKER_BUILD === '1' ? '1' : '' } }` to nextConfig. Add a short comment: defineServer is used because next.config `env` is not inlined into server code in every build mode, and plain process.env is read at runtime. Only scripts/cf/build-target.mjs sets the flag. Do not change any other key.
    5. In `scripts/cf/build-target.mjs`, export `const WORKER_BUILD_FLAG = 'CLICKIT_WORKER_BUILD'` and `function nextBuildEnv(minimal, buildEnv)`, which returns `{ ...minimal, ...buildEnv, [WORKER_BUILD_FLAG]: '1' }`, with a JSDoc line explaining why. In main(), the opennextjs-cloudflare spawn uses `env: nextBuildEnv(minimal, buildEnv)`. Do not add the flag to buildEnvFor() or makeStamp(): the stamp and the deploy guard stay byte-for-byte the same in behaviour. Every target (preview, workersdev, production) goes through this one spawn, so all three get the flag.
    6. Run the new test GREEN, then the full unit suite, typecheck and lint on the touched files.
    7. Commit by explicit path only: `git add src/server/email/queue-select.ts src/server/email/queue-local.ts src/server/email/queue.ts next.config.ts scripts/cf/build-target.mjs tests/unit/email-queue-select.test.ts`. Use the TDD commit pair `test(quick-261026-nad): ...` (RED) then `feat(quick-261026-nad): ...` (GREEN). Each message ends with the Co-Authored-By line from the session attribution. Read the SHA from the commit output, not from a parallel call.
  </action>
  <verify>
    <automated>cd /Users/koss/Developer/Clickit/.claude/worktrees/phase-05-accounts-and-email-61ece8 && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/email-queue-select.test.ts && npm run test:unit && npm run typecheck && npx eslint src/server/email/queue.ts src/server/email/queue-local.ts src/server/email/queue-select.ts next.config.ts scripts/cf/build-target.mjs tests/unit/email-queue-select.test.ts && test "$(grep -v '^\s*//' src/server/email/queue.ts | grep -cE "^import .*from '\./(consumer|deps)")" = 0</automated>
  </verify>
  <done>The new test passes all 7 cases. test:unit, typecheck and eslint are clean. queue.ts has no import of consumer.ts or deps.ts. Two commits on the branch contain only these six paths.</done>
</task>

<task type="auto">
  <name>Task 2: Measure in the built Worker (before/after KiB, template copies), write SUMMARY</name>
  <files>.planning/quick/261026-nad-phase5-worker-bundle-trim-email-fallback/261026-nad-SUMMARY.md</files>
  <action>
    All heavy steps run detached under the shared lock, one at a time, never in a harness background shell. Launch each one as `caffeinate -i -s -m perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' bash scripts/heavy-run.sh <cmd> > <log> 2>&1 &` from the worktree root. Wait for the `exit=` line (poll the log with short checks, no foreground sleep longer than the tool allows). If the lock is held by another process, wait and relaunch; never remove the lock.

    Use the same placeholder public env as 05-21 for both builds. Export it in the launching shell before the caffeinate line: `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key NEXT_PUBLIC_SITE_URL=https://www.clickitstory.ae`.

    Step A (before copies, no rebuild). The existing `.open-next` still holds the 05-21 build. Confirm with `grep gitSha .open-next/clickit-build-stamp.json`: it is 40bba4d…; if not, note the sha. Run `env -i PATH="$PATH" HOME=/Users/koss/.clickit-cloudflare WRANGLER_SEND_METRICS=false node_modules/.bin/wrangler deploy --dry-run --outdir /Users/koss/.clickit-checks/nad-wrangler-before` through heavy-run (log `/Users/koss/.clickit-checks/nad-before.log`). Then count template copies with `grep -rhoF 'plan 05-11). Generated file: do not edit' /Users/koss/.clickit-checks/nad-wrangler-before | wc -l` (expected 2) and with `grep -rhoF '[email/queue-local]' …` (expected 1 or more). Also record the Total Upload line from that log. This step runs before Step B overwrites `.open-next`.

    Step B (after build). Through heavy-run, run `sh -c 'npm run build && (grep -rlF "[email/queue-local]" .next/server | head -3; echo node-build-fallback-files=$(grep -rlF "[email/queue-local]" .next/server | wc -l)) && npm run cf:build && npm run cf:bundle-budget'` with log `/Users/koss/.clickit-checks/nad-after-build.log`. The plain `npm run build` (no flag, as next start uses) must still contain the fallback (node-build-fallback-files ≥ 1). The cf:build must not.

    Step C (after copies). Run the same wrangler dry run as Step A with outdir `/Users/koss/.clickit-checks/nad-wrangler-after` (log `nad-after-dryrun.log`), then record:
    - the template marker count in nad-wrangler-after, which must be exactly 1;
    - the same marker count in `.open-next/server-functions/default/handler.mjs` and in `.open-next/server-functions/default/.next/server`, which must be 0;
    - `grep -rcF '[email/queue-local]'` over the same .open-next paths, which must be 0;
    - `grep -cF 'CLICKIT_WORKER_BUILD' .open-next/server-functions/default/handler.mjs`, which should be 0 (the define was inlined, not left as a runtime read);
    - the `bundle-budget ok gzip=… headroom=…` line from nad-after-build.log.
    Record `git rev-parse --short HEAD` and `git status --short` at build time: the 05-27 executor may have uncommitted files in the tree, and they are in this build.

    Stop condition, set by the controller: the gzip must be below 2,984.77 KiB AND the wrangler bundle must hold 1 template copy. If either fails, STOP. Do not try fallback B, do not change wrangler minify, do not try other code shapes. Write the SUMMARY with every number above, which chunk in `.open-next/server-functions/default/.next/server` still carries the marker (`grep -rlF`), and whether `CLICKIT_WORKER_BUILD` survives in handler.mjs. End it with `NEEDS CONTROLLER: option A did not move the bundle; fallback B decision`. The Task 1 commits stay.

    Write `261026-nad-SUMMARY.md` from the summary template with three lists: verified, not verified, failed. Use clock times. Include a "Worker bundle" table with these rows:
    - before gzip 2,984.77 KiB and total 14,702.21 KiB (from `/Users/koss/.clickit-checks/p5-21-build.log`);
    - the before dry-run Total Upload line;
    - after gzip, total and headroom;
    - delta KiB;
    - template copies in the wrangler bundle, before → after;
    - handler.mjs copies, before 1 → after;
    - node-build fallback present (yes/no).
    Also state:
    - the mechanism and why: compiler.defineServer, with the Next 16 findings in short;
    - that custom-worker.ts and wrangler.jsonc were not touched.
    Remove `/Users/koss/.clickit-checks/nad-wrangler-before` and `nad-wrangler-after` after their counts are in the SUMMARY; keep the logs. Commit the SUMMARY alone by explicit path: `docs(quick-261026-nad): bundle trim summary`, ending with the Co-Authored-By line. Do not push. Do not touch STATE.md or ROADMAP.md.
  </action>
  <verify>
    <automated>cd /Users/koss/Developer/Clickit/.claude/worktrees/phase-05-accounts-and-email-61ece8 && tail -1 /Users/koss/.clickit-checks/nad-after-build.log | grep -qx 'exit=0' && grep -q 'bundle-budget ok' /Users/koss/.clickit-checks/nad-after-build.log && test "$(grep -hoF 'plan 05-11). Generated file: do not edit' .open-next/server-functions/default/handler.mjs | wc -l | tr -d ' ')" = 0 && test -f .planning/quick/261026-nad-phase5-worker-bundle-trim-email-fallback/261026-nad-SUMMARY.md</automated>
  </verify>
  <done>The SUMMARY has before and after gzip KiB with the after figure below 2,984.77, wrangler-bundle template copies 2 → 1, handler.mjs copies 1 → 0, the node-build fallback still present, and logs ending `exit=0`. If the stop condition fired instead, the SUMMARY carries the numbers and the NEEDS CONTROLLER line. The SUMMARY is committed by explicit path, with no push.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| build env → bundle | Values in the opennextjs-cloudflare build env can be inlined into shipped server code |
| Worker runtime → email queue | Server actions enqueue welcome/notification emails; a missing binding must not silently send via another path |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-nad-01 | Tampering / Repudiation | queue-select.ts selectEmailQueue | mitigate | When loadLocal is null (Worker build) or runtime is 'workers' and there is no binding, it throws 'EMAIL_QUEUE binding missing'. It never falls back in production (T-05-16-03 kept). Unit tests 2 and 3 cover this. |
| T-nad-02 | Information disclosure | next.config.ts defineServer | accept | The only inlined value is the constant "1" or "". It is never an env value or a secret. defineServer is server-only, so nothing reaches client bundles. |
| T-nad-03 | Denial of service | Worker bundle size (Workers Free 3 MiB) | mitigate | The bundle drops the duplicate templates/consumer copy. The cf:bundle-budget gate measures it. The stop condition hands it to the controller if the bundle does not shrink. |
| T-nad-04 | Tampering | custom-worker.ts queue() consumer | mitigate | The file is not touched. Test 6 asserts it still imports processBatch directly. |
</threat_model>

<verification>
- Unit: tests/unit/email-queue-select.test.ts (both paths + invariants), the full test:unit, typecheck and eslint.
- Build: a plain `next build` keeps the fallback chunk. cf:build drops it: there is no `[email/queue-local]` and no template marker in the .open-next Next server, and `CLICKIT_WORKER_BUILD` is inlined.
- Bundle: the cf:bundle-budget gzip is below 2,984.77 KiB, and the wrangler bundle template copies go from 2 to 1.
</verification>

<success_criteria>
1. The gate:local bundle-budget gzip number drops below 2,984.77 KiB (before log `/Users/koss/.clickit-checks/p5-21-build.log`).
2. The built Worker (wrangler dry-run bundle of custom-worker.ts + .open-next) holds ONE copy of `src/generated/app-email-templates.json`, not two.
3. The SUMMARY holds the before and after KiB, the copy counts and the build sha. Or it holds the stop report with NEEDS CONTROLLER if 1 or 2 fails.
</success_criteria>

<output>
Create `.planning/quick/261026-nad-phase5-worker-bundle-trim-email-fallback/261026-nad-SUMMARY.md` when done.
</output>
