---
phase: 05-accounts-and-email
plan: 10
subsystem: auth-email
tags: [react-email, supabase-auth, go-templates, rtl, config-toml, tdd]
requires: ["05-07", "05-02"]
provides: [buildAuthTemplates, SENTINELS, authTemplateElement, supabase-templates-production, supabase-templates-local, subjects-json, local-auth-config]
affects: [05-17, 05-35, 05-38]
tech-stack:
  added: []
  patterns: ["sentinel strings swapped for Go actions after React render", "locale branch wraps the whole document so each branch has its own head", "production and local template sets differ only in the logo URL"]
key-files:
  created:
    - src/emails/auth/templates.ts
    - scripts/build-auth-templates.mjs
    - supabase/templates/confirmation.html
    - supabase/templates/magic_link.html
    - supabase/templates/recovery.html
    - supabase/templates/email_change.html
    - supabase/templates/reauthentication.html
    - supabase/templates/subjects.json
    - supabase/templates/local/confirmation.html
    - supabase/templates/local/magic_link.html
    - supabase/templates/local/recovery.html
    - supabase/templates/local/email_change.html
    - supabase/templates/local/reauthentication.html
    - tests/unit/auth-templates.test.ts
  modified:
    - supabase/config.toml
    - package.json
key-decisions:
  - "buildAuthTemplates() is async (React render is async); the CLI writes 5 production files, subjects.json and 5 local files"
  - "Go values are sentinels (__TOKEN__ etc.) replaced after render; the sentinel link's &amp; is unescaped to & for the whole run (href and visible fallback line)"
  - "Branch is {{ if eq .Data.locale \"ar\" }}<AR document>{{ else }}<EN document>{{ end }}; each document keeps its own head, meta tags and single dark @media block"
  - "[inbucket] admin_email and sender_name are accepted by CLI 2.119.0 (A9 answered): set to no-reply@clickitstory.ae / Clickit Story"
requirements-completed: []
duration: 25min
completed: 2026-10-21
---

# Phase 5 Plan 10: Branded auth emails Summary

**Five scheme-adaptive EN/AR Supabase auth templates (confirm signup, sign-in code, reset, email change, reauthentication) generated from the 05-07 shell as Go-template HTML with a locale branch, plus subject lines and the local Phase 5 auth settings in `supabase/config.toml`.**

## Tasks

1. Auth template source and builder (TDD). RED `47081d1`, GREEN `851c48e`. 13 tests.
2. Local `config.toml` Phase 5 auth values. Commit `eb16845`.

## What exists

- `src/emails/auth/templates.ts`: one element per template and locale on `EmailShell`. E1 and E5 are a code block only (no button); E2 has button, fallback URL line, then the code; E3 and E4 have button plus fallback URL. E4 puts both addresses in `<span dir="ltr">`.
- `scripts/build-auth-templates.mjs` (`npm run emails:build:auth`): exports `buildAuthTemplates({ logoUrl })` and `SENTINELS`; when run directly writes `supabase/templates/*.html` (logo on `media.clickitstory.ae`), `subjects.json`, and `supabase/templates/local/*.html` (logo `http://localhost:3000/brand/email-logo-white.png`). The two sets differ only in the logo URL (tested).
- Links are `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=<signup|recovery|email_change>`; reauthentication has neither. No `.SiteURL` anywhere. Subjects: neutral for E1/E2 (no code), `{{ .Token }}` only in reauthentication; every subject has the locale branch.
- `supabase/config.toml`: `site_url` localhost:3000, redirect allow-list `localhost` and `127.0.0.1` `/**`, min password 8, `email_sent = 1000` (local only), confirmations on, `otp_expiry = 900`, `max_frequency = "60s"`, TOTP enrol and verify on, inbucket sender, five `[auth.email.template.*]` blocks pointing at the local set, and a comment forbidding `supabase config push`. Captcha stays disabled.

## Verification

- `npm run emails:build:auth` runs; `tests/unit/auth-templates.test.ts` 13/13 pass: branch layout and `{{ if }}`/`{{ end }}` balance, only allowed Go actions, link text with plain `&`, codes and links per template, no sentinel/script/SiteURL/oversize, 15 minutes equals `AUTH_LINK_MINUTES`, RTL attributes and LTR codes, `assertSignedScheme` on the AR part and the EN part of every file separately (card #101010, border #222222, header rule #222222), per-branch meta tags and one dark block, no `#777777` under `supabase/templates`, no hex in the source or the builder, subjects, logo URL option, committed files equal a fresh build.
- `tests/unit/email-shell.test.ts` (14) and `tests/unit/migration-neutralisation.test.ts` (14) still pass.
- eslint (`clickit/no-raw-design-values` at error) and `tsc --noEmit` clean on the new files.
- Task 2 automated greps pass; `supabase/config.toml` parses with Python `tomllib`; `supabase status` loads it (only the pre-existing `[inbucket]` deprecation warning, use `[local_smtp]` later).

## Deviations from Plan

**1. [Plan text vs signed copy] "every EN body says 15 minutes" applies to four of five.** E4 (email change) has no validity time in the signed contract (UI-SPEC 7.3), so the test checks "15 minutes" and "15 دقيقة" on E1, E2, E3, E5 only.

**2. [Minor] `buildAuthTemplates` is async.** React's `render` is async, so callers (and the test) `await` it.

**3. [Minor] Task 1 verify's `git diff --exit-code supabase/templates` is trivially true on first commit** (files untracked); the drift test in the unit test is the real check.

## Not verified

- The Go locale branch and the templates on the running GoTrue (missing `locale` falling back to English, `eq` with a nil value, Mailpit rendering): that is plan 05-38, because it restarts the shared local stack. The stack was not restarted or touched here.
- Real mail clients, light/dark, images off (owner render check, Pitfall 11). AR copy is still an unreviewed draft.
- `media.clickitstory.ae/brand/email-logo-white.png` returns nothing until the controller copies the PNG (05-35).
- Live Supabase was not read or written; the production template set is pasted by Koss in 05-35.

## Requirements

MAIL-01, AUTH-02 and AUTH-04 stay Pending: this plan delivers the template files and the local config only. They need Resend SMTP and the pasted templates live (05-35), the confirm page (05-23) and the sign-in flows.

## Known Stubs

None.

## Threat Flags

None. T-05-10-01 (links open the button page, never verify on GET), T-05-10-02 (no code in sign-in/confirm subjects, no names or addresses in subjects), T-05-10-03 (config.toml comment forbids `supabase config push`) are implemented. T-05-10-04 (RedirectTo) is enforced server-side in 05-21, not in these files.

## Self-Check: PASSED

Files exist: templates.ts, build-auth-templates.mjs, the 5 production and 5 local HTML files, subjects.json, auth-templates.test.ts. Commits found: 47081d1, 851c48e, eb16845.
