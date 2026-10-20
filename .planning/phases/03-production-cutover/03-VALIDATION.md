---
phase: 3
slug: production-cutover
status: draft
nyquist_compliant: false
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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
