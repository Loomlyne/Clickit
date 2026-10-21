---
phase: 2
slug: worker-and-r2-media-on-workers-dev
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-10-20
---

# Phase 2 — Validation Strategy

> Per-phase validation contract. Source: 02-RESEARCH.md "Validation Architecture".

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test runner (`node --test --experimental-strip-types`), tests in `tests/unit/` |
| **Config file** | none (flags in `package.json` `test:unit`) |
| **Quick run command** | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/<file>.test.ts` |
| **Full suite command** | `npm run gate:local` (lint + unit + build + `cf:build` once added) |
| **Estimated runtime** | ~30 s unit, ~4 min gate |

## Sampling Rate

- **After every task commit:** quick command for the touched test file + `npm run lint`
- **After every plan wave:** `npm run test:unit` and `npm run cf:build`
- **Before `/gsd-verify-work`:** `npm run gate:local` green, preview checks, workers.dev curl checks, CPU report present
- **Max feedback latency:** 60 s for unit runs

## Per-Requirement Verification Map

| Requirement | Secure behavior | Test type | Automated command | File exists |
|-------------|-----------------|-----------|-------------------|-------------|
| PLAT-01 | OpenNext build at the version floor | build | `npm run cf:build` | ❌ W0 |
| PLAT-02 | Signed-out redirect, non-admin refused, coming-soon, locale | unit (gate matrix) + preview script | `npm run test:unit`; `node scripts/cf/check-gates.mjs` | ❌ W0 |
| PLAT-03 | Admin edit visible ≤10 s | preview script on local Supabase | `node scripts/cf/check-revalidate.mjs` | ❌ W0 |
| PLAT-04 | Cron path map, constant-time auth, routes run on trigger | unit + `wrangler dev --test-scheduled` | unit file | ❌ W0 |
| PLAT-05 | Missing/invalid Turnstile token refused (contact, newsletter); token passed on auth | unit (fake fetch, test keys) | unit file | ❌ W0 |
| PLAT-06 | Beacon only with token; no Vercel analytics | unit | unit file | ❌ W0 |
| PLAT-07 | IP from `cf-connecting-ip`, fail closed | unit | unit file | ❌ W0 |
| PLAT-08 | Deploy guard refuses wrong account and loopback/local-env builds | unit + guard dry run | unit file | ❌ W0 |
| PLAT-09 | Per-route CPU table (p50/p95/max/cold/subrequests) | script + Workers Logs | `node scripts/cf/measure-routes.mjs` | ❌ W0 |
| PLAT-10 (code) | No Vercel/BotID artefact in src, config, package.json | unit grep test | `tests/unit/no-vercel.test.ts` | ❌ W0 |
| MEDIA-01 | Presign shape; finalize refuses wrong prefix/size/magic bytes and deletes | unit (fake MEDIA) + one owner-approved R2 round trip | unit file | ❌ W0 |
| MEDIA-03 (copy) | Dry-run report, idempotent re-run, sha256 report, variants | unit (fake S3, sharp fixtures) | extend `r2-media-migration.test.ts` | partly |
| MEDIA-04 | Loader nearest width; media Worker variant/original/304/206/HEAD/404/allowlist | unit | unit files | ❌ W0 |
| MEDIA-05 | Faststart check; 206 + Content-Range | unit + `curl -r 0-1023 -I` | unit + curl | ❌ W0 |
| MEDIA-06 | SVG refused by magic bytes; media Worker sends CSP + nosniff on SVG | unit | unit file | ❌ W0 |

## Task-Level Map (planner, 2026-10-20)

| Plan-Task | Requirement | Automated check |
|-----------|-------------|-----------------|
| 02-01 T3 | PLAT-08 | tests/unit/wrangler-guard.test.ts |
| 02-01 T4 | PLAT-01, PLAT-02 | npm run cf:build; preview curl table in 02-SPIKE.md |
| 02-02 T1 | MEDIA-01 | tests/unit/r2-cors.test.ts |
| 02-03 T1 | MEDIA-04, MEDIA-05, MEDIA-06 | tests/unit/media-worker.test.ts |
| 02-04 T1 | PLAT-04, PLAT-07 | tests/unit/cron-auth.test.ts, cron-schedule.test.ts |
| 02-04 T2 | PLAT-05, PLAT-07 | tests/unit/rate-limit.test.ts, turnstile.test.ts |
| 02-06 T1 | PLAT-08 | tests/unit/deploy-guard.test.ts |
| 02-07 T1 | PLAT-04 | tests/unit/scheduled.test.ts |
| 02-07 T2 | PLAT-10 (code), PLAT-02, PLAT-03 | tests/unit/site-url.test.ts; scripts/cf/check-gates.mjs; scripts/cf/check-revalidate.mjs |
| 02-08 T1-T3 | MEDIA-04, MEDIA-05, MEDIA-03 (copy) | variant-plan, faststart, r2-media-migration, verify-media-host tests |
| 02-09 T1 | MEDIA-04 | tests/unit/image-loader.test.ts, supabase-media.test.ts |
| 02-10 T4 | PLAT-09 | 02-SPIKE.md Remote spike grep |
| 02-11 T1 | PLAT-05, PLAT-07 | tests/unit/form-guard.test.ts |
| 02-12 T1-T2 | MEDIA-01, MEDIA-06 | upload-kinds, magic-bytes, presign, upload-finalize, dev-upload-shim tests |
| 02-13 T1 | PLAT-05 | tests/unit/turnstile-widget.test.ts |
| 02-14 T1-T2 | PLAT-05, PLAT-06, PLAT-10 (code) | tests/unit/csp.test.ts, web-analytics.test.ts, no-vercel.test.ts |
| 02-15 T1 | MEDIA-01, MEDIA-06 | tests/unit/admin-image-upload.test.ts |
| 02-16 T1 | MEDIA-01, MEDIA-05 | mp4-boxes, admin-hero-video, admin-video-upload tests |
| 02-17 T1 | MEDIA-04 | tests/unit/browser-variants.test.ts |
| 02-19 T1-T2 | MEDIA-01, PLAT-01 | tests/unit/worker-request-paths.test.ts; npm run gate:local |
| 02-20 T4 | MEDIA-04, MEDIA-05 | verify-media-host 0 failures; curl post-checks |
| 02-21 T1, T3 | PLAT-09 | tests/unit/measure-routes.test.ts; 02-CPU-REPORT.md |
| 02-22 T1 | all | npm run gate:local; coverage table in 02-UAT.md |

## Wave 0 Requirements

- [ ] Test files: `media-worker`, `image-loader`, `faststart`, `variant-plan`, `presign`, `upload-finalize`, `cron-auth`, `rate-limit`, `turnstile`, `deploy-guard`, `no-vercel`
- [ ] Rewrite or delete `r2-media.test.ts` and `storage-range-proxy.test.ts` with their code
- [ ] `cf:build`, `cf:preview`, `cf:deploy`, `cf-typegen` scripts

## Manual-Only Verifications

| Behavior | Requirement | Why manual | Instructions |
|----------|-------------|------------|--------------|
| Real presigned PUT to R2 | MEDIA-01 | Needs the real bucket and token | Owner-approved upload on a scratch prefix on workers.dev |
| Web Analytics records views | PLAT-06 | Dashboard only | Koss opens the Web Analytics site after visits |
| Hero video plays on Safari/Chrome/mobile | MEDIA-05 | Real browsers | Koss UAT |
| Supabase CAPTCHA enforcement on auth | PLAT-05 | Supabase CAPTCHA stays off until cutover | Local stack with `[auth.captcha]` + Turnstile test keys |

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] No 3 consecutive tasks without automated verify
- [ ] No watch-mode flags
- [ ] `nyquist_compliant: true` set after plan check

**Approval:** pending
