---
phase: 3
slug: production-cutover
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-10-20
---

# Phase 3 — Validation Strategy

> Per-phase validation contract. Source: 03-RESEARCH.md "Validation Architecture". The per-task map is filled by the planner from the plans.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` via `node --experimental-strip-types --test` |
| **Config file** | none; `test:unit` in package.json globs `tests/unit/**/*.test.ts` |
| **Quick run command** | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test <one test file>` |
| **Full suite command** | `npm run gate:local` (lint, typecheck, unit, migration guard, build, cf:build) — under the heavy lock `/Users/koss/.clickit-heavy.lock` |
| **Estimated runtime** | quick ~5 s per file; full gate ~6–10 min |

## Sampling Rate

- **After every task commit:** the new/updated unit file.
- **After every plan wave:** `npm run test:unit` and `npm run guard:migrations`.
- **Before `/gsd-verify-work`:** `npm run gate:local` green; then live proofs in runbook order, each a numbered step with Expected output.
- **Max feedback latency:** 30 s for unit files.

## Requirement → Proof Map

| Req | Automated proof | Owner UAT |
|-----|-----------------|-----------|
| DNS-01 | `tests/unit/dns-check.test.ts`; live `node scripts/cutover/dns-check.mjs --phase pre-flip` (4 `.ae` servers + jen/brett) | — |
| MAIL-02 | dns-check (Resend records on both NS); `tests/unit/parse-auth-results.test.ts` | Resend "Verify"; test send headers show spf=pass, dkim=pass, dmarc=pass |
| DNS-02 | `scripts/cutover/proof-check.mjs --site https://www.clickitstory.ae` (server: cloudflare, no x-vercel-id, apex 301); `scripts/cf/check-gates.mjs --base https://www.clickitstory.ae` | sign in with a real account, play an episode, progress remembered |
| DNS-03 | unit: cron key `55 0 * * *`, production guard; live `scripts/cutover/keys-check.mjs` (legacy anon → 401 after close) | Vercel crons off (branch A) or dashboard read-back; admin audit page loads on the secret key |
| DNS-04 | `dns-check.mjs --phase rollback` + `proof-check.mjs --expect vercel`; cert notAfter read | optional flip-day rehearsal toggle (his word) |
| MEDIA-02 | `npm run media:health`; `scripts/media/verify-media-host.mjs --origin https://media.clickitstory.ae` 0 failures | — |
| MEDIA-08 | local rolled-back SQL test (rewrite, scan, reverse); `tests/unit/rewrite-sql.test.ts`; live read-only scan = 0 | his word before the rewrite |
| PLAT-11 | `dns-check.mjs --phase final` (no Vercel target left) | project deleted (branch A) or signed rewording (branch B) |

## Per-Task Verification Map

`NT` = `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test`. Code plans create their tests test-first inside the same task (no separate Wave 0 plan). Ops tasks verify by grepping the plan's log for the recorded command verdicts.

| Plan-Task | Req | Automated verify | Kind |
|-----------|-----|------------------|------|
| 03-01-T1 | DNS-02 | grep "ENTRY: PASS/STOP" in 03-ENTRY.md; merge-base check | record |
| 03-01-T2 | DNS-03 | NT tests/unit/cron-schedule.test.ts tests/unit/scheduled.test.ts tests/unit/publish-scheduled-refresh.test.ts | unit |
| 03-01-T3 | DNS-02, DNS-03 | NT tests/unit/cutover-config.test.ts tests/unit/deploy-guard.test.ts | unit |
| 03-02-T1 | DNS-02, DNS-03, MEDIA-02 | NT tests/unit/production-target.test.ts tests/unit/deploy-guard.test.ts tests/unit/cutover-config.test.ts | unit |
| 03-02-T2 | DNS-02 | npm run test:unit + script presence greps + guard dry run refuses | unit + dry run |
| 03-03-T1 | DNS-01, MAIL-02, PLAT-11 | NT tests/unit/dns-check.test.ts; live read-only dns-check --phase ns | unit + read-only live |
| 03-03-T2 | DNS-04 | NT tests/unit/rollback.test.ts | unit |
| 03-04-T1 | DNS-02 | NT tests/unit/runtime-header.test.ts tests/unit/proof-check.test.ts; npm run typecheck | unit |
| 03-04-T2 | DNS-03, MEDIA-02 | NT tests/unit/keys-check.test.ts tests/unit/media-health-source.test.ts | unit |
| 03-04-T3 | MAIL-02 | NT tests/unit/parse-auth-results.test.ts | unit |
| 03-05-T1 | MEDIA-08 | NT tests/unit/rewrite-sql.test.ts; npm run guard:migrations | unit + guard |
| 03-05-T2 | MEDIA-08 | /Users/koss/.clickit-checks/p3-sql-test.log has "test-local: PASS" and exit=0 | local DB (rolled back) |
| 03-06-T1/T2 | all | runbook Step 1-56 presence greps; no key shapes | doc |
| 03-06-T3 | all | p3-gate.log exit=0 (npm run gate:local); PR open | full gate |
| 03-07 | DNS-01, MAIL-02, MEDIA-08 | log greps: "dns-check ns: ALL PASS", "dns-check resend: ALL PASS", "MAIL-02: PASS", "backup table: OK" | live read + owner |
| 03-08 | MEDIA-02 | log greps: "verify ok ... 0 failures", "x-media-source: r2" | live read + owner |
| 03-09 | DNS-03, DNS-04 | log greps: secret names, "env file counts: 5 1", "token active" or branch B | owner + read-back |
| 03-10 | DNS-02, DNS-03, DNS-04 | log greps: "dns-check post-flip: ALL PASS", "proof-check worker: ALL PASS", "UAT www: pass", "publish-scheduled status 200" | live + owner UAT |
| 03-11 | DNS-04 | 7 GREEN daily lines; "no rollback needed" or rollback ALL PASS; Koss's close word | live daily |
| 03-12 | DNS-03, MEDIA-08 | log greps: "keys-check legacy-off: PASS", "captcha-probe on: PASS", "scan-old-hosts: 0 rows" | live + owner |
| 03-13 | PLAT-11 | log greps: "dns-check final: ALL PASS", deletion or branch B line, evidence table | live + owner |

## Wave 0 Requirements

- [ ] `tests/unit/dns-check.test.ts`
- [ ] `tests/unit/cutover-config.test.ts`
- [ ] `tests/unit/parse-auth-results.test.ts`
- [ ] `tests/unit/rewrite-sql.test.ts` + `scripts/cutover/sql/test-local.sql`
- [ ] updates to `tests/unit/cron-schedule.test.ts`, `tests/unit/scheduled.test.ts`, deploy-guard/build-target tests

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real sign-in + playback on www | DNS-02 | needs a real account (live) | runbook UAT steps, numbered |
| Supabase dashboard toggles (new keys, legacy off, CAPTCHA) | DNS-03 | owner dashboard | runbook steps with read-back |
| Resend Verify + header check | MAIL-02 | owner account | runbook steps |
| Vercel project deletion | PLAT-11 | owner account | runbook step (branch A) |

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (created test-first inside 03-01..03-05)
- [x] No watch-mode flags
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
