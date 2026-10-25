---
phase: 05-accounts-and-email
plan: 17
subsystem: owner-tooling
tags: [supabase-local, totp, mfa, rls, aal2, management-api, owner-scripts]
requires: ["05-01", "05-10", "05-13", "05-14", "05-38"]
provides: [scripts/lib/local-only.mjs, scripts/seed-local-admin.mjs, npm run seed:local-admin, scripts/admin-remove-factor.mjs, scripts/auth-config-check.mjs, tests/unit/owner-scripts.test.ts]
affects: [05-32, 05-35, 05-36, 05-37, 05-41, phase-06-uat]
tech-stack:
  added: []
  patterns: ["local-only guard (http + 127.0.0.1/localhost) before any call; DB writes only through docker exec into supabase_db_Clickit", "credentials only in a mode-600 env file outside the repo; stdout prints paths only", "read-only Management API diff, templates by SHA-256, secrets as (set)/(missing)"]
key-files:
  created:
    - scripts/lib/local-only.mjs
    - scripts/seed-local-admin.mjs
    - scripts/admin-remove-factor.mjs
    - scripts/auth-config-check.mjs
    - tests/unit/owner-scripts.test.ts
  modified:
    - package.json
key-decisions:
  - "seed:local-admin applies M2 locally (resolveM2Source: landed supabase/migrations/*_phase5_m2_admin_aal2.sql first, else supabase/pending/m2_admin_aal2.sql) instead of pointing app_config.admin_user_id at the seed user; psql --single-transaction via docker exec; a landed migration is also recorded in schema_migrations so migration up does not re-run it"
  - "auth-config-check also checks smtp_user = resend, smtp_pass and security_captcha_secret present, security_captcha_provider = turnstile (D-37); smtp_port compares as text (the API returns a string)"
  - "Controller go (2026-10-25, option A): seed run on the shared stack; M2 applied from supabase/pending in one transaction and left UNRECORDED in schema_migrations until 05-41 lands it as a migration (a version with no file would break migration up --local for every worktree)"
requirements-completed: []
duration: 25min (two sittings, 2026-10-21 and 2026-10-25)
completed: 2026-10-25
status: complete (seed run 2026-10-25 21:49Z on the shared stack; UI check of the admin page after a code waits for 05-25 /auth/mfa)
---

# Phase 5 Plan 17: Owner and test scripts Summary

**Three owner/test scripts and one shared local-only helper: `npm run seed:local-admin` (local TOTP admin, local M2, archived UAT show, aal1/aal2 RLS self-check, credentials only in `/Users/koss/.clickit-checks/local-admin.env`), `admin-remove-factor.mjs` (lost-phone procedure with retype confirmation and an audit row) and the read-only `auth-config-check.mjs`. 19 unit tests pass. The seed has not been run on the shared stack yet: it needs the controller's go for M2 there.**

## Tasks

| # | Task | Commits | Status |
|---|------|---------|--------|
| 1 | Local-only helper and seed:local-admin | `6a0d06fe` (RED), `1ba769ef` (GREEN) | done; acceptance run passed 2026-10-25 21:49Z |
| 2 | admin-remove-factor and auth-config-check | `94e62447` (RED), `b8784670` (GREEN) | done |

## What was built

- `scripts/lib/local-only.mjs`
  - `assertLocalSupabaseUrl`: allows only `http:` on `127.0.0.1`, `localhost` or `[::1]` and no credentials in the URL. Refuses live, any https URL and look-alike hosts.
  - `writePrivateEnvFile`: absolute path outside the repo, `KEY=value` lines, writes a temp file and renames it, mode 600 also when the file already exists, refuses values with newlines.
  - `resolveM2Source`: picks the newest landed `_phase5_m2_admin_aal2.sql` migration, else the pending file, else throws the documented message.
  - `localDbExecArgs`: argv for `docker exec -i supabase_db_Clickit psql -q -X -v ON_ERROR_STOP=1 --single-transaction -U postgres -d postgres`. SQL goes in on stdin. No host flag, no shell string.
  - `migrationVersionOf`: extra helper.
- `scripts/seed-local-admin.mjs`, in order:
  1. Reads the local stack keys from `supabase status -o env` and asserts the URL is local.
  2. Resolves and applies M2 through docker exec, then prints `local M2 source: <repo-relative path>` and `local M2 applied`.
  3. Finds or creates `uat-admin@clickit.local` with email confirmed and a new 20-character random password.
  4. Deletes the user's old factors, then enrols and verifies a TOTP factor with `totp()` from `lib/totp.mjs`. `--second-factor` adds a second one.
  5. Upserts `admins` ('UAT Admin') and completes the profile (`display_name`, `onboarded_at`).
  6. Upserts the archived show `uat-archived-show` (status draft, genre UAT).
  7. Self-checks through RLS: an aal1 session must read 0 rows, an aal2 session 1 row. Otherwise it exits 1 with `local admin RLS check failed (aal1 N rows, aal2 N rows)`.
  8. Writes the env file and prints `local admin ready: /Users/koss/.clickit-checks/local-admin.env`.

  The header states the reasons for these choices: local M2 instead of app_config, local seed only and never the live test account (D-16), the only local writer of admins rows, local admin pages need TOTP as live does after 05-37, and Phase 6 uses this seed.
- `package.json`: `"seed:local-admin": "node scripts/seed-local-admin.mjs"`.
- `scripts/auth-config-check.mjs`
  - Refuses unless `SUPABASE_ACCESS_TOKEN` is set. The project ref is fixed.
  - Sends one `GET /v1/projects/lajguozmtissnnfccmej/config/auth` and never writes.
  - `EXPECTED_AUTH`:

    | Group | Expected |
    |---|---|
    | OTP expiry (G5) | 900 |
    | Confirm email | autoconfirm false |
    | Secure email change | true |
    | SMTP | smtp.resend.com, port '465', user resend, password set, no-reply@clickitstory.ae, 'Clickit Story' |
    | Minimum password length | 8 |
    | TOTP | enrol true, verify true |
    | Rate limits (G18 A) | email 200, otp 150, verify 150 |
    | CAPTCHA | on, turnstile, secret set |
    | Site URL | https://www.clickitstory.ae |

  - Compares the five subjects and templates with `supabase/templates` (production set) by SHA-256 and prints 12-character hashes only.
  - `password_hibp_enabled` is an info row unless `--expect-hibp on|off` is given.
  - Exit codes: 0 match, 1 mismatch, 2 usage, token or network error.
  - Exports `compareAuthConfig`, `EXPECTED_AUTH`, `TEMPLATE_NAMES`, `loadRepoTemplates` and `sha256`. `main()` runs only when the file is invoked directly.
- `scripts/admin-remove-factor.mjs <email>`
  - Refuses unless `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set (exit 2).
  - Finds the user with paginated `listUsers` and an exact lowercase match.
  - Lists the factors (name, type, status, created date).
  - Asks "Type the email again to delete these factors" and deletes each factor with `auth.admin.mfa.deleteFactor`.
  - Writes one `admin_audit_log` row: `admin_user_id` = `entity_id` = the affected user, `action_type 'mfa_unenrol'`, `entity_type 'admin_auth'`, `diff { count, by: 'owner script' }`.
  - If the audit insert fails it exits 1 after the deletes and says the row is missing.
  - The header covers F4: signed out everywhere, and the next sign-in shows the enrol page.

## Field names checked

The Management API OpenAPI spec (`https://api.supabase.com/api/v1-json`, `AuthConfigResponse_Output`, fetched 2026-10-25) has every field the plan names, including `password_hibp_enabled`, `security_captcha_provider`, `security_captcha_secret`, `smtp_user`, `mailer_subjects_<name>` and `mailer_templates_<name>_content` for all five templates. `smtp_port` is a string.

## Verification

- Task 1 verify: `node --test tests/unit/owner-scripts.test.ts` passes, and `grep -q '"seed:local-admin"' package.json` passes.
- Task 2 verify, run with the three env variables unset: 19 pass, 0 fail. `auth-config-check` names `SUPABASE_ACCESS_TOKEN` and `admin-remove-factor` names `SUPABASE_SERVICE_ROLE_KEY`, both before any network call. Result: `VERIFY_OK`.
- Acceptance greps:
  - No `method: 'PATCH|PUT|POST'` in auth-config-check.
  - `action_type: 'mfa_unenrol'`, `entity_type: 'admin_auth'` and `admin_user_id` are present.
  - No `action: `, `entity: ` or `actor: ` keys.
- `eslint` on the five files is clean. `tsc --noEmit` returns rc=0.
- Shared stack (read-only checks, 2026-10-25 22:29 CET): migrations end `20261021151843, 20261021143410, 20261021142458, 20261021120000`. `private.is_admin()` still reads `app_config`, so M2 is not applied locally. The heavy lock was free.

## Seed run (2026-10-25, after the controller go)

Controller answer: A. Run `seed:local-admin` now under the heavy lock, no reset, M2 in one idempotent transaction, left unrecorded until 05-41, TOTP secret only in the mode-600 env file.

- Log `/Users/koss/.clickit-checks/p5-seed.log` (21:49:11Z to 21:49:30Z) ends `exit=0`. It contains `local M2 source: supabase/pending/m2_admin_aal2.sql`, `local M2 applied` and `local admin ready: /Users/koss/.clickit-checks/local-admin.env`. No `RLS check failed`, so the aal1 session read 0 rows and the aal2 session read 1.
- `stat -f %Lp` on the env file prints 600. It has 3 `KEY=value` lines (email, password, TOTP secret); no values were printed.
- Read back: `private.is_admin()` now checks aal2; `public.admins` has 1 row; `schema_migrations` still ends at 20261021151843.
- **The shared stack carries an unrecorded M2 until 05-41.** When 05-41 lands `<ts>_phase5_m2_admin_aal2.sql`, the next seed run records that version (`on conflict do nothing`). Every other branch on the shared stack now needs an admins row and aal2 for local admin reads.
- The UI check (sign in, enter a code, the admin page opens) waits for 05-25, which builds `/auth/mfa`. Until then the admin layout sends the seeded admin to a page that does not exist yet.
- Deviation: `npm run seed:local-admin` failed first (`supabase status failed`), because macOS kills the npm-installed CLI binary `node_modules/@supabase/cli-darwin-arm64/bin/supabase` (SIGKILL, rc 137). The run used `node scripts/seed-local-admin.mjs` under heavy-run, which resolves the Homebrew CLI 2.121.0 from PATH. No code change.

## NEEDS CONTROLLER (answered)

`NEEDS CONTROLLER: seed:local-admin will apply supabase/pending/m2_admin_aal2.sql to the shared local stack (local admin pages then require TOTP; Phase 6 must use npm run seed:local-admin). Reply go.`

Why I stopped here: the plan says to run the seed on the shared stack only when 05-13-SUMMARY records a controller go that covers "seed:local-admin applies M2 locally". It records only the general go to apply this phase's migrations. After M2, admin RLS reads on the shared stack need an admins row and aal2, for every branch that uses the stack. Main and the phase-02 and phase-03 worktrees still sign in their local admin through `app_config`.

After the go, the next executor runs:

```
caffeinate -i -s -m perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' bash scripts/heavy-run.sh npm run seed:local-admin > /Users/koss/.clickit-checks/p5-seed.log 2>&1 &
```

Then it checks:

1. The log ends `exit=0`.
2. The log contains `local M2 source:`, `local M2 applied` and `local admin ready: /Users/koss/.clickit-checks/local-admin.env`, and no `RLS check failed`.
3. `stat -f %Lp /Users/koss/.clickit-checks/local-admin.env` prints 600.
4. `grep -c "=" …local-admin.env` is at least 3.

It records the results here without the values.

## Deviations from Plan

**1. [Rule 2 - Correctness] M2 runs in one transaction, and a landed migration is recorded.** `localDbExecArgs` adds `--single-transaction` and `-X`, so a partial M2 cannot be left on the stack. When the source is a landed migration (after 05-41), the seed also inserts its version into `supabase_migrations.schema_migrations` (`on conflict do nothing`, psql variables, no string building), the same way the 05-38 psql fallback did. Added the `migrationVersionOf` helper and a test. Commit `1ba769ef`.

**2. [Rule 2 - Safety] Stricter guards.** The URL guard also refuses credentials in the URL and look-alike hosts. The env-file writer refuses relative paths, bad keys and newlines, and keeps mode 600 when it overwrites. The seed applies M2 before it creates any user, so a missing M2 source exits 1 before anything is written. Tested. Commit `1ba769ef`.

**3. [Rule 1 - Robustness] TOTP replay.** The aal2 self-check reuses factor 1. The seed waits for a new 30 s step when that factor was already verified in the current step, so a replay refusal from GoTrue cannot cause a false failure. Not exercised yet, because the seed has not run. Commit `1ba769ef`.

**4. [Rule 2 - Completeness] Extra expected auth fields.**

| Field | Expected | Source |
|---|---|---|
| `smtp_user` | resend | Resend SMTP username |
| `smtp_pass` | present | — |
| `security_captcha_provider` | turnstile | D-37 |
| `security_captcha_secret` | present | — |

If Koss's live settings differ on purpose, these rows show DIFF. Commit `b8784670`.

**5. Exit codes.** Missing env, usage and network errors exit 2, not 1, so a mismatch (exit 1) can be told apart from a run that could not check.

## Requirements

AUTH-05, AUTH-06 and MAIL-01 stay Pending. This plan delivers local tooling only. The live admin TOTP flow (05-36, 05-37) and the live Resend SMTP and templates (05-35) are what deliver them.

## Not verified

- The `--second-factor` path and the TOTP replay wait (the first run did not need either).
- The admin page opening after a code in the browser: waits for 05-25.
- `admin-remove-factor.mjs` against a real user. It is meant for Koss's terminal; it was only run here with no env variables, to check that it refuses.
- `auth-config-check.mjs` against live. That needs Koss's token, in 05-35.

## Known Stubs

None.

## Threat Flags

None beyond the register:

| Threat | How it is handled |
|---|---|
| T-05-17-01 | Local URL guard; M2 only through docker exec |
| T-05-17-02 | Credentials in a mode-600 file outside the repo; stdout shows paths only |
| T-05-17-03 | GET only, checked with grep |
| T-05-17-04 | Key from env only, exact email match, retype confirmation |
| T-05-17-05 | Secrets shown as (set)/(missing), templates as hashes |
| T-05-17-06 | Self-check coded; it runs with the seed |

## Self-Check: PASSED

- FOUND: scripts/lib/local-only.mjs, scripts/seed-local-admin.mjs, scripts/admin-remove-factor.mjs, scripts/auth-config-check.mjs, tests/unit/owner-scripts.test.ts, package.json script
- FOUND: 6a0d06fe, 1ba769ef, 94e62447, b8784670
