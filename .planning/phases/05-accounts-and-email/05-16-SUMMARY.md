---
phase: 05-accounts-and-email
plan: 16
subsystem: email
tags: [email, outbox, queue, producer, cloudflare-queues, in-process-queue, esbuild, server-only]
requires: ["05-08", "05-11", "05-13"]
provides: [enqueueEmailCore (pure), enqueueEmail (server-only), getEmailQueue, buildEmailDeps, unsubscribeUrlFor, newsletterConfirmUrlFor, WorkerEnv.EMAIL_QUEUE and email vars, QueueLike]
affects: [05-19, 05-20, 05-21, 05-28, 05-35, 05-37, 05-39]
tech-stack:
  added: []
  patterns: ["outbox row first, queue doorbell second; queue failure never fails the caller", "pure core over ports plus thin server-only wrapper", "in-process dev queue behind the same QueueLike interface, refused on workers"]
key-files:
  created:
    - src/server/email/enqueue-core.ts
    - src/server/email/deps.ts
    - src/server/email/outbox.ts
    - src/server/email/queue.ts
    - tests/unit/outbox-enqueue.test.ts
    - tests/unit/email-deps.test.ts
  modified:
    - src/server/cloudflare.ts
key-decisions:
  - "enqueueEmail target shape: { userId } | { adminAll: true } | { email }, each with optional locale (en|ar, default en); exactly one target; invalid locale throws"
  - "Result outcome for adminAll: queued if any row queued, else duplicate, else capped; zero rows = queued with ids [] and one '[email/outbox] no_recipients kind=.. key=..' warn"
  - "Queue-failure log carries the kind only (no error object); no-recipients log carries kind and key, never an address"
  - "buildEmailDeps env type EmailDepsEnv is local to deps.ts (pure); queue.ts maps NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SITE_URL onto SUPABASE_URL / SITE_ORIGIN for the in-process path"
  - "newsletterConfirmUrlFor takes now in milliseconds; the confirm link locale comes from the claimed row's locale"
  - "RPC errors from deps carry the rpc name and HTTP status only, never the response body"
requirements-completed: []
duration: 25min
completed: 2026-10-21
---

# Phase 5 Plan 16: Producer side of the email pipeline Summary

**`enqueueEmail` writes the outbox row through `enqueue_email` first and rings the queue second (a send failure never fails the caller); `buildEmailDeps` gives the consumer its PostgREST claim/finish, signed links and Resend or Mailpit mailer; the Worker uses the `EMAIL_QUEUE` binding and dev uses an in-process queue that is refused on workers.**

## Tasks

| # | Task | Commit |
|---|------|--------|
| 1 (RED) | Failing tests for enqueue core and deps | `47d57ec` |
| 1 (GREEN) | `enqueue-core.ts` and `deps.ts` | `1373444` |
| 2 | `outbox.ts`, `queue.ts`, `WorkerEnv` bindings | `6f477f5` |

## What was built

- `src/server/email/enqueue-core.ts` (pure): validates (key 1-200 chars, kind from `APP_EMAIL_KINDS`, exactly one target, object payload, locale, CR/LF stripped and simple-email regex on `to.email` and `replyTo`), calls the RPC, sends `{ outboxId }` for queued rows only, swallows queue errors with `[email/outbox] queue send failed, sweep will retry kind=..`, lets RPC errors throw. Imports `APP_EMAIL_KINDS` from `../../emails/app/model.ts` only.
- `src/server/email/deps.ts` (pure, relative imports): `buildEmailDeps(env, fetch)` with claim/finish as `POST {SUPABASE_URL}/rest/v1/rpc/claim_outbox|finish_outbox` (apikey and Bearer service key), `render` through `renderAppEmail` with signed links, Resend mailer when `CLICKIT_RUNTIME === 'workers'` else the Mailpit mailer, `unsubscribeUrl` port. Missing `EMAIL_LINK_SECRET` throws `link secret missing`, so the consumer records a retry.
- `src/server/email/queue.ts` (`server-only`): `getEmailQueue()` returns the `EMAIL_QUEUE` binding, throws `EMAIL_QUEUE binding missing` when `CLICKIT_RUNTIME === 'workers'` and the binding is absent, otherwise an in-process queue that runs `processBatch` un-awaited with no-op `ack`/`retry` and `[email/queue-local]` error logging.
- `src/server/email/outbox.ts` (`server-only`): `enqueueEmail(input)` over `createAdminClient().rpc('enqueue_email', ...)` (throws on RPC error).
- `src/server/cloudflare.ts`: `QueueLike` and optional `EMAIL_QUEUE`, `RESEND_API_KEY`, `EMAIL_LINK_SECRET`, `EMAIL_FROM`, `EMAIL_DIGEST_ENABLED`, `SITE_ORIGIN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## Pre-render decision check (plan amendment, 2026-10-21)

Task 2 verify bundled `src/server/email/queue.ts` with esbuild (`--bundle --platform=node --format=esm --packages=external`, 163 kB, 13 ms, exit 0). esbuild accepted the `import ... with { type: 'json' }` in `render-app.ts`, inlined `src/generated/app-email-templates.json` and resolved `@/` through tsconfig paths. So the `NEEDS CONTROLLER` stop for a rejected JSON import did not trigger. The check folder `/Users/koss/.clickit-checks/p5-queue-bundle/` was removed afterwards. Note: the bundle reaches the templates through `deps.ts` (consumer path); `enqueue-core.ts` itself stays off them.

## Verification

Verified:
- `node --test tests/unit/outbox-enqueue.test.ts tests/unit/email-deps.test.ts`: 22 pass, 0 fail (RED run failed first, commit `47d57ec`).
- Full `npm run test:unit`: 2236 pass, 0 fail.
- `npx tsc --noEmit`: clean. `npx eslint` on the touched files: clean; `npm run lint`: 0 errors (25 existing warnings, none from this plan).
- Acceptance greps: `from '(@/|server-only|next)` count 0 in `enqueue-core.ts` and `deps.ts`; no `render-app` in `enqueue-core.ts`; exactly one `emails/app/model.ts` line; `CLICKIT_RUNTIME === 'workers'` present in `queue.ts`; `import 'server-only'` in `outbox.ts` and `queue.ts`; `EMAIL_QUEUE` in `cloudflare.ts`.
- Plan Task 2 verify chain (tsc, greps, esbuild bundle, `__clk_` marker in the bundle): exit 0.

Not verified (stack-dependent or out of scope here):
- `enqueueEmail` against the real `enqueue_email` RPC and `getEmailQueue` in a running Worker or `next dev`: the shared local Supabase stack is on hold and M1a/M1b are not applied there yet; the queue binding itself is added to wrangler in 05-19. Covered by 05-19/05-21/05-39.
- `npm run build` / `cf:build`: not run (plan says Turbopack does not reach `outbox.ts` until 05-21/05-28 import it).

Failed: none.

## Deviations from Plan

None. The plan executed as written (no `NEEDS CONTROLLER` stop needed). Prettier is not enforced on this directory (sibling files such as `consumer.ts` also fail `prettier --check`), so new pure files follow the sibling style instead.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model (T-05-16-01..05 mitigated: queue messages carry `{ outboxId }` only; CR/LF stripped and email regex tested; in-process queue refused on workers; queue failure leaves the pending row for the sweep; service key only in request headers and never in errors or logs).

## Self-Check: PASSED

Files exist (`enqueue-core.ts`, `deps.ts`, `outbox.ts`, `queue.ts`, both tests) and commits `47d57ec`, `1373444`, `6f477f5` are in `git log`.
