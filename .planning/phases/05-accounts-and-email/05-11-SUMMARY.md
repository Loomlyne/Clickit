---
phase: 05-accounts-and-email
plan: 11
subsystem: app-email
tags: [react-email, pre-render, template-fill, escaping, rtl, parity, workers-free, tdd]
requires: ["05-07", "05-04"]
provides: [renderAppEmail, APP_EMAIL_KINDS, SUPPORT_REPLY_HOURS, buildAppEmailModel, stripCrlf, escapeHtml, safeUrl, slotsOf, fillHtml, fillText, fillSubject, renderRows, TrustedBlock, SLOT_SOURCE, AppTemplateFile, buildAppTemplates, SLOT, renderAppEmailDirect, app-email-templates-json]
affects: [05-13, 05-16, 05-19, 05-21, 05-28, 05-29]
tech-stack:
  added: []
  patterns: ["React Email only at build time; the Worker fills checked-in templates", "single-pass slot fill with a fresh RegExp per call", "TrustedBlock as the only unescaped insert", "row templates cut out by prefix/suffix of two sentinel renders", "one shared model feeds both the direct and the fill path"]
key-files:
  created:
    - src/lib/email-constants.ts
    - src/emails/app/model.ts
    - src/emails/app/template-fill.ts
    - src/emails/app/templates.ts
    - src/emails/app/direct.ts
    - src/emails/render-app.ts
    - scripts/build-app-templates.mjs
    - scripts/email-parity-shots.mjs
    - src/generated/app-email-templates.json
    - tests/unit/email-template-fill.test.ts
    - tests/unit/app-email-build.test.ts
    - tests/unit/app-emails.test.ts
    - tests/unit/app-email-parity.test.ts
    - tests/unit/helpers/app-email-fixtures.ts
    - .planning/phases/05-accounts-and-email/mockups/05-11-digest-en-direct.png
    - .planning/phases/05-accounts-and-email/mockups/05-11-digest-en-prerendered.png
    - .planning/phases/05-accounts-and-email/mockups/05-11-digest-ar-direct.png
    - .planning/phases/05-accounts-and-email/mockups/05-11-digest-ar-prerendered.png
    - .planning/phases/05-accounts-and-email/deferred-items.md
  modified: []
key-decisions:
  - "Fill values carry their type ({ type, value }); a value whose type differs from the template slot throws 'slot type mismatch <name>'"
  - "safeUrl also refuses any whitespace or control character (still returns the input unchanged)"
  - "Episode id and message_id are encodeURIComponent'd into their paths (identity for UUIDs, so the planned URLs are unchanged)"
  - "A digest show with no episodes, or a non-string title_ar, is 'bad payload digest'; an empty episode title is allowed"
  - "Digest thumbnail 128x72 (16:9, the show card ratio) in its own cell; padding on the inline end side per locale"
  - "Shared fixtures in tests/unit/helpers/app-email-fixtures.ts feed both the parity test and the screenshot script"
requirements-completed: []
duration: 28min
completed: 2026-10-21
---

# Phase 5 Plan 11: App emails, pre-rendered Summary

**The five app emails (welcome, digest, support auto-reply, support admin copy, newsletter confirm) in EN and AR are rendered once at build time from the signed 05-07 shell into `src/generated/app-email-templates.json`; the Worker's `renderAppEmail` only fills escaped values in one pass, without React, and its HTML is byte-identical to the direct React render for every kind, locale and digest variant.**

## Tasks

| # | Task | RED | GREEN |
|---|------|-----|-------|
| 1 | Shared model and single-pass escaping fill | `e92b6fa` | `d85dfa3` |
| 2 | React builders, direct path, build-time templates | `be35bc1` | `e0a0573` |
| 3 | Worker-safe renderAppEmail and app email tests | `bc2fd33` | `52fc7da` |
| 4 | Parity, plural guard, import allow-list, digest shots | - | `92a1ab1` |

## What exists

- `src/emails/app/template-fill.ts` (no imports): `escapeHtml` (React's map, checked against `react-dom` output), `safeUrl` (https, or http on localhost/127.0.0.1; returns its input), `slotsOf`, `fillHtml` / `fillText` / `fillSubject` (required slots read from the template, checked first, then one `replace` with a fresh regex; output never rescanned), `renderRows` -> `TrustedBlock` (constructor guarded by a module-private symbol plus a WeakSet brand), `PREVIEW_MAX` / `PREVIEW_PAD` copied from react-email 6.11.0 as `\u` escapes, `AppTemplateFile`.
- `src/emails/app/model.ts`: `APP_EMAIL_KINDS`, `stripCrlf`, plain payload guards, `buildAppEmailModel(row, ctx, strings)` (locale fallback, origin trimmed and checked, digest 3 x 3 caps, AR title fallback, `S{season} E{episode} - {title}` line, unusable `image_url` -> `shownoimage`, variant `more` when `total_shows > 3` or more than 3 shows, support_admin Reply-To and 100-character subject, E9 preheader).
- `src/emails/app/templates.ts` (build/test only): E6-E10 builders plus `showRow`, `showRowNoImage`, `episodeRow`, `appEmailElement`, `appSubject`. Values sit in `<bdi>`; the E9 reply hint is split at `{name}`; 48 hours and 7 days are filled from `SUPPORT_REPLY_HOURS` and `NEWSLETTER_CONFIRM_TTL_DAYS`.
- `src/emails/app/direct.ts`: `renderAppEmailDirect` (React path, build/test only).
- `scripts/build-app-templates.mjs`: `buildAppTemplates()` and `SLOT`; preheader collapse, row cuts by prefix/suffix (throws if a render does not keep them), every builder assertion; writes the JSON (12 templates, 3 rows per locale, 2 strings per locale, no timestamp; 98 KB).
- `src/emails/render-app.ts`: `renderAppEmail(row, ctx)`, re-exports `APP_EMAIL_KINDS`, exports `SUPPORT_REPLY_HOURS`; JSON imported `with { type: 'json' }` (tsc 5.9 and esbuild 0.28 accept it, no NEEDS CONTROLLER), one cast to `AppTemplateFile`.

## Render-app bundle

esbuild `--bundle --format=esm --platform=neutral` of `src/emails/render-app.ts`: exactly the 7 allow-listed inputs (`render-app.ts`, `app/model.ts`, `app/template-fill.ts`, `brand.ts`, `lib/email-tokens.ts`, `lib/email-constants.ts`, the JSON). Raw 151,205 bytes (147.7 KB, mostly the JSON); **gzip 9,326 bytes (9.1 KiB)** against 05-07's React bundle at 266.56 KiB. Scratch folder `/Users/koss/.clickit-checks/p5-render-app-bundle` removed.

Indicative CPU (node 26 on the Mac, load about 4, not workerd): module load 1.2 ms; one cold batch of the five kinds 1.04-1.07 ms; warm batch mean 0.10 ms (05-07 React path: cold 29-41 ms, warm 4.3 ms).

## Parity result (direct React path vs pre-rendered fill path)

Fixtures: siteOrigin `https://www.clickitstory.ae`, fixed signed-looking links, hostile name `Zoë "Q" O'Neil & <script>alert(1)</script> نور`, multi-line message with `\r\n`, `<b>` and `&`.

| Kind | Variant | EN html | EN text | AR html | AR text |
|------|---------|---------|---------|---------|---------|
| digest (5 shows, 2nd without thumbnail, 3rd without title_ar, 4 episodes on the 1st) | more | identical (raw bytes) | identical | identical (raw bytes) | identical |
| digest (2 shows, 2nd with `image_url: ''`) | base | identical (raw bytes) | identical | identical (raw bytes) | identical |
| welcome | base | identical (raw bytes) | identical | identical (raw bytes) | identical |
| support_ack | base | identical (raw bytes) | identical | identical (raw bytes) | identical |
| support_admin (hostile name) | base | identical (raw bytes) | equal after normalisation | identical (raw bytes) | equal after normalisation |
| newsletter_confirm | base | identical (raw bytes) | identical | identical (raw bytes) | identical |

Subjects and Reply-To equal in all 12. The tests assert equality after `s.replace(/\s+/g, ' ').trim()`; a separate check showed the HTML is also byte-identical before normalisation.

## Parity differences

None (the text allow-list in the test is empty). Observation only: the support_admin text part keeps the visitor's own line breaks in the fill path, while html-to-text in the direct path folds them into spaces; the two are equal after whitespace normalisation, so no allow-list entry is needed. The fill behaviour is the more readable one for the admin.

## Digest screenshots (for the controller; not opened here)

- `.planning/phases/05-accounts-and-email/mockups/05-11-digest-en-direct.png` and `05-11-digest-en-prerendered.png`: PNG byte-equal = **true** (55,386 bytes each)
- `.planning/phases/05-accounts-and-email/mockups/05-11-digest-ar-direct.png` and `05-11-digest-ar-prerendered.png`: PNG byte-equal = **true** (54,786 bytes each)

One Chromium headless shell, sequential pages, 700 px wide, light scheme; logo and thumbnails served from `public/brand/` (no network). Log `/Users/koss/.clickit-checks/p5-05-11-shots.log` ends `exit=0`. Each picture includes the no-thumbnail row (Pearl Divers).

## Plural guard (condition 2)

| Locale | SUPPORT_REPLY_HOURS = 48 | NEWSLETTER_CONFIRM_TTL_DAYS = 7 |
|--------|--------------------------|---------------------------------|
| en | other | other |
| ar | many ("ساعة", singular noun, right for 11-99) | few ("أيام", right for 3-10) |

## Controller conditions

`node --experimental-strip-types --test --test-name-pattern="condition" tests/unit/email-template-fill.test.ts tests/unit/app-email-parity.test.ts`: 6 pass ("condition 1: hostile support_admin name", "condition 1: sentinel text in values is inert", "condition 1: sentinel text in values is inert end to end", "condition 2: plural guard", "condition 3: digest parity", "condition 3: all kinds parity").

## Verification

- `email-template-fill` (20), `app-email-build` (8), `app-emails` (10), `app-email-parity` (6) all pass; `email-shell` (14) still passes; `npm run test:unit` 2198 pass, 0 fail.
- `tsc --noEmit` clean; eslint (`clickit/no-raw-design-values` at error) clean on `src/emails`, `src/lib/email-constants.ts`, both scripts and the five test files.
- Task 1 greps: no imports in `email-constants.ts` and `template-fill.ts`, no React imports in model/fill; `grep -rn dangerouslySetInnerHTML src/emails` empty; invisible-character count in `template-fill.ts` 0.
- Rebuild after commit leaves `src/generated` clean (drift-free); `#777777` count in the JSON 0.
- esbuild allow-list check prints `ok 7 inputs`.

## Deviations from Plan

**1. [Rule 2 - Security] Stricter guards.** `safeUrl` also refuses whitespace and control characters; fill throws on a slot type mismatch; episode id and message_id are URL-encoded into their paths (no change for UUIDs); a digest show with no episodes or a non-string `title_ar` is `bad payload digest`. Tested in `email-template-fill.test.ts`.

**2. [Minor] Extra file `tests/unit/helpers/app-email-fixtures.ts`.** One fixture set for the parity test and `scripts/email-parity-shots.mjs`, so the pictures show exactly the tested rows.

**3. [Rule 3 - Blocking] Playwright browser missing.** The locked Playwright 1.58.2 needs `chromium_headless_shell-1208`, which was not installed. Per `~/.claude/reference/infra.md` ("Chromium missing: `npx playwright install chromium`") I ran `npx playwright install --only-shell chromium` (disk 25 GB free first). Its extractor hung at 0% CPU after a complete download (`unzip -t` clean), so I stopped the processes I had started (by PID) and unzipped Playwright's own downloaded archive into `~/Library/Caches/ms-playwright/chromium_headless_shell-1208` with the two marker files. Side effect of Playwright's own cleanup during that install: orphaned builds `chromium-1248`, `chromium_headless_shell-1248` and `ffmpeg-1013` (referenced by no existing project link) were removed; Sahti's `chromium_headless_shell-1243` and `ffmpeg-1011` were kept.

**4. [Tooling] The file-write tool turned the `\u` escapes of `PREVIEW_PAD` into raw invisible characters.** Caught by the Task 1 test; rewritten with escapes (acceptance grep prints 0).

**5. [Test-only] Two test fixes during GREEN:** `lang`/`dir` assertions made attribute-order independent (React writes `dir` before `lang` on `<html>`), and the import walker strips whole-line `//` comments before block comments (a `@react-email/*` mention in a comment opened a fake block comment).

## Not verified

- Real mail clients (Gmail web/app, Outlook, Apple Mail; light/dark; images off) and the AR copy review: owner steps.
- CPU in workerd: node timings only; the live check is 05-36.
- The Next.js/Turbopack build of the `with { type: 'json' }` import: not reached until app code imports the consumer (05-16 checks esbuild; 05-21/05-28 reach Turbopack). No `npm run build` or `gate:local` in this plan.
- The four PNGs were not opened (work-thread rule); the controller views them.

## Requirements

MAIL-03, MAIL-04, MAIL-05 and MAIL-06 stay Pending: this plan delivers the rendered emails only. They complete when the outbox RPCs (05-13), enqueue and consumer wiring (05-16, 05-19), producers (05-21, 05-28), unsubscribe and newsletter pages (05-29) and the live sends exist.

## Known Stubs

None. The link builders in `ctx.links` are injected by 05-16/05-19 (signing with `EMAIL_LINK_SECRET`); tests use fixed fake URLs by design.

## Threat Flags

None beyond the plan's register. T-05-11-01..08 are implemented and tested (escaping identical to React, `<bdi>`, CR/LF strip and subject cap, static auto-reply, plain links with no tracking, TrustedBlock-only raw insert, URL allow rule, drift test and parity, single-pass fill, thumbnail drop instead of digest failure).

## Deferred

Logged in `deferred-items.md`: the 05-07 shell's footer lines 1-2 keep #767676 in dark mode (inline colour on the `<p>`, no `cs-footer` class); about 4.2:1 on #101010. Shell fix plus template rebuilds, not done here.

## Next Phase Readiness

05-16's `deps.ts` can call `renderAppEmail(row, { siteOrigin, links })` unchanged; enqueue code imports `APP_EMAIL_KINDS` from `src/emails/app/model.ts`. After any change to `src/emails/**` or the messages, rebuild with `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/build-app-templates.mjs` and commit the JSON (the drift test fails otherwise).

## Self-Check: PASSED

All 19 created files exist; commits e92b6fa, d85dfa3, be35bc1, e0a0573, bc2fd33, 52fc7da, 92a1ab1 found.
