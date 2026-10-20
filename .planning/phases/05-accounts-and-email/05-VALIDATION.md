---
phase: 5
slug: accounts-and-email
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-20
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `05-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (`node --experimental-strip-types`), Playwright 1.58 for e2e, SQL assertions in a scratch DB (`scripts/db-proof.sh`, Wave 0) |
| **Config file** | `package.json` `test:unit`; `playwright.config.ts`; `supabase/tests/*.sql` (Wave 0) |
| **Quick run command** | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/<file>.test.ts` |
| **Full suite command** | `npm run gate:local` (+ `bash scripts/db-proof.sh` when SQL changed) |
| **Estimated runtime** | unit file ~2 s; gate:local ~4-6 min; db-proof ~2 min; e2e lane ~6 min |

Heavy steps (stack restart, db-proof, e2e, build) take `/Users/koss/.clickit-heavy.lock`, run detached with an `exit=` line, Playwright `--workers=2` max, one Supabase stack and one build on the Mac at a time.

---

## Sampling Rate

- **After every task commit:** the relevant single `node --test` file
- **After every plan wave:** `npm run gate:local`, plus `bash scripts/db-proof.sh` if SQL changed
- **Before `/gsd-verify-work`:** gate:local, db-proof, e2e lane `tests/e2e/auth-*.spec.ts` + `admin-mfa.spec.ts`, clean-clone check
- **Max feedback latency:** 10 seconds per task (unit file)

---

## Per-Requirement Verification Map

Task-level rows are filled by the planner/executor from each PLAN's `<verify>` blocks; this table is the requirement floor every plan set must cover.

| Requirement | Behaviour | Test Type | Automated Command | File Exists | Status |
|-------------|-----------|-----------|-------------------|-------------|--------|
| AUTH-01 | wall table: every non-public path → `/{locale}/auth?next=`; public list exact | unit + e2e | `--test tests/unit/wall-policy.test.ts`; `playwright test tests/e2e/auth-wall.spec.ts` | ❌ W0 | ⬜ |
| AUTH-02 | code normalisation (٠-٩, ۰-۹, paste), send/verify state machine, new+existing user | unit + e2e (Mailpit) | `--test tests/unit/otp-code.test.ts`; `auth-otp.spec.ts` | ❌ W0 | ⬜ |
| AUTH-03 | password paths, set-password, `password_set_at`, HIBP hit/miss/timeout fail-open | unit + e2e | `--test tests/unit/hibp.test.ts`, `password-set.test.ts` | ❌ W0 | ⬜ |
| AUTH-04 | reset/confirm/email-change from a fresh browser context; GET does not consume token | e2e (3 contexts) + unit | `auth-cross-device.spec.ts`; `--test tests/unit/confirm-link.test.ts` | ❌ W0 | ⬜ |
| AUTH-05 | `admins` seed; `private.is_admin()` truth table; `requireAdmin` decisions | SQL + unit | `bash scripts/db-proof.sh`; `--test tests/unit/admin-access.test.ts` | ❌ W0 | ⬜ |
| AUTH-06 | MFA freshness 11h59/12h01, AAL1 refused, enrol/verify | unit + e2e | `--test tests/unit/admin-mfa.test.ts`, `totp.test.ts`; `admin-mfa.spec.ts` | ❌ W0 | ⬜ |
| AUTH-07 | audit rows carry acting admin; names shown; `admin_auth` events | unit | `--test tests/unit/admin-audit-names.test.ts` | ❌ W0 | ⬜ |
| AUTH-08 | anon cannot read `episodes_view` / call the function; catalog client used; HIBP refusal | SQL + unit | `bash scripts/db-proof.sh`; `--test tests/unit/catalog-client-source.test.ts` | ❌ W0 | ⬜ |
| MAIL-01 | templates: placeholders, AR branch, subjects, plain text; From header on local SMTP | unit + e2e | `--test tests/unit/auth-templates.test.ts`; `auth-mail-brand.spec.ts` | ❌ W0 | ⬜ |
| MAIL-03 | one welcome per user under double verify; backfilled users unmailed | SQL + unit | `db-proof.sh`; `--test tests/unit/welcome.test.ts` | ❌ W0 | ⬜ |
| MAIL-04 | digest selection (`live_at`, ledger, flag, Dubai date); HMAC unsubscribe; headers; one-click POST | SQL + unit | `db-proof.sh`; `--test tests/unit/unsub-link.test.ts`, `digest-headers.test.ts`, `unsubscribe-route.test.ts` | ❌ W0 | ⬜ |
| MAIL-05 | ack + one copy per admin, Reply-To, caps, CR/LF stripped | unit | `--test tests/unit/support-mail.test.ts` | ❌ W0 | ⬜ |
| MAIL-06 | pending → confirmed; link expiry/forgery/replay; legacy rows untouched | unit + SQL | `--test tests/unit/newsletter-confirm.test.ts` | ❌ W0 | ⬜ |
| MAIL-07 | consumer matrix (success, 429, 5xx, 4xx, duplicate, crash-after-send, lease, 23 h guard, sweep) | unit | `--test tests/unit/email-consumer.test.ts`, `outbox-sweep.test.ts` | ❌ W0 | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/db-proof.sh` + `supabase/tests/*.sql` (scratch DB, `set role`, `request.jwt.claims`)
- [ ] `tests/unit/helpers/email-world.ts` (in-memory outbox, fake Resend with 24 h idempotency + 409, fake queue, clock)
- [ ] `scripts/lib/totp.mjs` (RFC 6238) + `tests/unit/totp.test.ts` (RFC vectors)
- [ ] `scripts/seed-local-admin.mjs` (local only; writes `/Users/koss/.clickit-checks/local-admin.env`)
- [ ] Playwright helpers: Mailpit client, three-context fixture, local-admin fixture
- [ ] Spikes: Go template `.Data.locale` with no locale (Mailpit); `custom-worker.ts` bundle with email render (size/CPU); queue under `wrangler dev`/preview; `has_function_privilege('service_role', …)` after revoke

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-inbox render EN + AR, SPF/DKIM/DMARC pass | MAIL-01 | real mail clients | Koss sends himself each email type; Gmail web + iOS, Outlook, Apple Mail; "Show original" |
| Authenticator enrolment by Issam and Nejib (two factors each) | AUTH-05/06 | real phones, real people | owner runbook step |
| Live Auth settings readback | MAIL-01, AUTH-04 | live dashboard | `node scripts/auth-config-check.mjs` from Koss's terminal |
| First real queue message and first digest on Cloudflare | MAIL-07, MAIL-04 | live Worker | test email to Koss's own address, then first 20:00 Dubai run |
| 12 h TOTP freshness | AUTH-06 | wall-clock | unit-tested only |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
