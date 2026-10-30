---
phase: 05-accounts-and-email
plan: 07
subsystem: email-foundation
tags: [react-email, email-shell, dark-mode, rtl, worker-bundle, tdd]
requires: ["05-00", "05-01"]
provides: [EmailShell, EmailButton, CodeBlock, QuoteBox, FallbackUrl, Footer, EmailLink, renderEmail, darkSchemeCss, EMAIL_COLORS, logoUrlFor, FOOTER_LINE_1, POSTAL_LINE, email-messages-en-ar, assertSignedScheme, email-logo-white.png]
affects: [05-10, 05-11, 05-19, 05-35]
tech-stack:
  added: ["react-email 6.11.0 (exact)", "@react-email/render 2.1.0 (exact)"]
  patterns: ["createElement (h) instead of JSX so node:test and the Worker load one source", "role map over Phase 4 EMAIL_TOKENS, no hex in src/emails", "light inline plus one dark @media block with !important class overrides", "signed-scheme test helper reused by every template test"]
key-files:
  created:
    - src/emails/brand.ts
    - src/emails/components.ts
    - src/emails/messages/en.ts
    - src/emails/messages/ar.ts
    - tests/unit/email-shell.test.ts
    - tests/unit/helpers/email-scheme.ts
    - scripts/build-email-logo.mjs
    - public/brand/email-logo-white.png
  modified:
    - package.json
    - package-lock.json
key-decisions:
  - "Package versions are react-email 6.11.0 and @react-email/render 2.1.0, not the 6.11.3 / 2.1.1 the plan names: those two were published 2026-10-16 (5 days old) and the session rule requires exact versions at least two weeks old. 6.11.0 is from 2026-09-23, 2.1.0 from 2026-07-10, postinstall empty, same exports. Controller may bump to the planned pair once they are 14 days old (2026-10-30)."
  - "EmailButton is skipped in the plain-text part (data-skip-in-text) and FallbackUrl prints 'label <br> url', so the URL sits alone on its own line exactly once; every button must be followed by a FallbackUrl"
  - "The '--' line before the footer is inserted by renderEmail in the text part (before the last FOOTER_LINE_1), not rendered as visible HTML"
  - "Support link in the footer prints 'Help: clickitstory.ae/support' in text (data-text-only), no duplicated href"
  - "Added class cs-box (quote box background and border without the yellow code colour) to the dark block; the nine classes of the plan are all there"
requirements-completed: []
duration: 14min
completed: 2026-10-21
---

# Phase 5 Plan 07: Email foundation Summary

**One scheme-adaptive email shell (light inline, dark in a single `@media (prefers-color-scheme: dark)` block, logo on its own plate, solid-cell button, footer inside the card) built only on Phase 4's `EMAIL_TOKENS`, EN/AR strings for E1-E10, a reproducible logo PNG, and a Worker spike that says: pre-render, not render in the consumer (cold batch over budget).**

## Tasks

1. Packages, brand role map, strings. Commit `05bc2c5`. 
2. Shell and `renderEmail` (TDD). RED `65c301c`, GREEN `a191b02`. 14 tests.
3. Worker bundle and per-batch CPU spike. No repo files (scratch removed). Numbers below.
4. Email logo on its own plate. Commit `5b2b1b8`. `public/brand/email-logo-white.png` is 272x96 px, no alpha, 3211 bytes (limit 30 KB), committed (not ignored).

## Role -> EMAIL_TOKENS key mapping (all 26 roles, by Phase 4's exact names, none value-matched)

Precondition checked against the signed table (`05-q12-schemes.html`, G12/G22 rows in 05-PLAN-GATE.md): every value in `src/lib/email-tokens.ts` equals the signed value; the test `the role map equals the signed table` pins this. No NEEDS CONTROLLER on colours. (The plan's example key names such as `light.text` / `codeBg` / `footerText` are not Phase 4's names; the real keys are below.)

| Scheme | Role | EMAIL_TOKENS key | Value |
|---|---|---|---|
| light | page | light.page | #F4F4F4 |
| light | card | light.card | #FFFFFF |
| light | header | light.header | #090909 |
| light | heading | light.heading | #111111 |
| light | body | light.body | #333333 |
| light | hint | light.hint | #555555 |
| light | codeBg | light.codeBox | #F6F6F6 |
| light | codeBorder | light.codeBorder | #E5E5E5 |
| light | codeText | light.code | #111111 |
| light | rule | light.rule | #E5E5E5 |
| light | footer | light.footer | #767676 |
| dark | page | dark.page | #090909 |
| dark | card | dark.card | #101010 |
| dark | cardBorder | dark.cardBorder | #222222 |
| dark | header | dark.header | #101010 |
| dark | headerRule | dark.headerRule | #222222 |
| dark | heading | dark.heading | #F4F4F4 |
| dark | body | dark.body | #CCCCCC |
| dark | hint | dark.hint | #A1A1A1 |
| dark | codeBg | dark.codeBox | #191919 |
| dark | codeBorder | dark.codeBorder | #2A2A2A |
| dark | codeText | dark.code | #ffcc00 |
| dark | rule | dark.rule | #222222 |
| dark | footer | dark.footer | #A1A1A1 |
| both | button.bg | button.bg | #ffcc00 |
| both | button.ink | button.ink | #090909 |

Derived: `link` = heading role (light.heading / dark.heading); `quoteRule` = button.bg. Dark card is the card token, never the page token (asserted).

## Spike results (Task 3)

Bundle: `wrangler@4 deploy --dry-run` of a scratch Worker that imports `src/emails/components.ts` (react-email root import plus `@react-email/render`, workerd/worker export condition), run under `scripts/heavy-run.sh`, log `/Users/koss/.clickit-checks/p5-email-bundle.log` ends `exit=0`. No socket.io, esbuild, tailwindcss or prismjs ended up in the bundle (A3 holds for size: the root import tree-shakes). `prettier` strings appear (11 hits, from the render package) but the total is small.

CPU: node on the Mac, machine load average about 11 (other Clickit sessions running), so the numbers are noisy. One batch = 5 emails (EN and AR; a code block; a button plus quote box), each rendered to HTML and to plain text through `renderEmail` (10 `render` calls). Five runs of 1 cold batch plus 50 warm batches: cold 29.5 to 40.9 ms (two earlier runs under heavier load: 95 and 192 ms); warm mean 4.2 to 4.5 ms (median 3.2 ms, p10 2.6 ms; two outlier runs under load: 8.9 and 36.7 ms).

```
gzip_kib: 266.56
total_kib: 1206.63
batch_render_ms_cold: 29.45
batch_render_ms_mean: 4.28
a4_risk: high (cold batch is about 3x the 10 ms Free CPU limit even though the warm mean is about 4 ms; node on the Mac is not Worker CPU, so the real check is the 05-36 live consumer metrics)
decision: pre-render
```

Decision rule from the plan: gzip at most 1024 KiB (pass), warm mean at most 8 ms (pass on 4 of 5 runs, the other runs were load spikes), cold batch at most 10 ms (FAIL: 29 to 41 ms). So the plan's rule gives `pre-render`. Plausible mitigations for the planner (not decided here): pre-render the HTML/text at build or at enqueue time, or lower `max_batch_size` (a batch of 1 was not measured here), or move to the Paid plan.

## Verification

- `tests/unit/email-shell.test.ts`: 14/14 pass. Covers: role map equals signed table; `darkSchemeCss` is only the dark block; EN and AR renders pass `assertSignedScheme` (both meta tags, `:root{color-scheme:light dark}`, exactly one `<style>`, every dark class value, every light inline value on its element, button cell, no `#777777`, no `<script`, no `rgba(`); header bgcolor, logo `alt`/`width="136"`/only image; button `<td bgcolor>` plus fallback with the same href; footer inside the card after a rule; RTL (`lang`, `dir`, Tahoma, LTR mono code with `letter-spacing:8px`); quote box escapes `<b>` and keeps `pre-wrap`; plain text (no tags, URL alone once, code alone, heading case kept, preheader absent, blank line then `--` then footer line 1, support line); message parity (placeholders match EN/AR, 15 minutes literal, footer and postal lines exact); source guard (no hex under `src/emails`, no `#777777` in `src/emails` or `supabase/templates`).
- `tsc --noEmit` and eslint (`clickit/no-raw-design-values` at error) clean on `src/emails`, the tests and the script.
- Task 4 automated verify passes (272 px wide, 96 px high, no alpha, no hex in the script).
- Acceptance greps: the 'Spacelight ... United Arab Emirates' line appears twice in `brand.ts`; `subject` appears 14 times in `en.ts` and 11 in `ar.ts`; no `@/` imports in `components.ts`.

## Deviations from Plan

**1. [Session rule over plan] Package versions 6.11.0 / 2.1.0 instead of 6.11.3 / 2.1.1.** The plan and its verify command pin 6.11.3 and 2.1.1; both were published 2026-10-16 and the run rule says exact versions at least two weeks old. Installed the newest pair that qualifies (6.11.0 from 2026-09-23; `@react-email/render` 2.1.0 from 2026-07-10; react-email 6.11.0 requires render `>=2.1.0`). `postinstall` empty on both. No `resend`, no `@react-email/ui`. The plan's automated version check in Task 1 therefore does not match literally; I ran it with the installed versions. Controller: bump later if you want the planned pair (`npm install --save-exact react-email@6.11.3 @react-email/render@2.1.1`, allowed from 2026-10-30).

**2. [Rule 1 - Bug] React hoisted an extra `<title>` and left comment placeholders.** `Preview` adds a `<title>` by default and React's document render leaves `<!--$-->`, `<!--html-->` etc. Fixed with `useTitleTag: false` and by stripping those five exact comments in `renderEmail`. Tests assert one `<title>` and no `<!--`.

**3. [Rule 1 - Bug] Plain text had the button label and a duplicated href.** html-to-text printed `Go <url>` and `Help: text url` and upper-cased the heading. Fixed in the shell (button skipped in text, `br` in the fallback line, `data-text-only` on the support link) and in `renderEmail` (`h1` not upper-cased). Consequence: every `EmailButton` needs a `FallbackUrl` after it (documented in the code; 05-10/05-11 do this per UI-SPEC).

**4. [Minor] Extras beyond the plan's list.** `EmailLink` (body link: heading colour, underlined), `cs-box` dark rule for the quote box, `siteOrigin` prop on `EmailShell`/`Footer` for the support link, `EmailHeading`/`EmailText` exported. `E9` has both `body` and `replyHint` (same text) so 05-11 can place the hint under the quote.

**5. [Minor] `{hours, number}` / `{days, number}` ICU form from UI-SPEC became `{hours}` / `{days}`.** Emails use the tiny `fill()` helper, not next-intl, so the plain token is enough; callers pass numbers.

## Requirements

MAIL-01 and MAIL-03 stay Pending: this plan delivers the shell, strings and logo only. They complete when the auth templates (05-10) and the welcome email (05-11) render on it.

## Not verified

- Real mail clients (Gmail web and app, Outlook, Apple Mail, light/dark, images off): the owner render check (research Pitfall 11) is not done; only the HTML structure is asserted.
- The logo's look (not opened, by rule); only its geometry, no-alpha and corner pixels are checked. `LOGO_URL` on `media.clickitstory.ae` returns nothing until the controller copies the PNG there (05-35).
- Worker CPU in workerd: node timings only, machine under load; the real check is 05-36.
- AR copy is an unreviewed draft (UI-SPEC says so).

## Known Stubs

None.

## Threat Flags

None. T-05-SC (exact versions, postinstall empty, age rule), T-05-07-01 (values as React children, no `dangerouslySetInnerHTML`, test for `<script`), T-05-07-02 (only the logo image, no tracking), T-05-07-04 (logo built by a committed script from the brand mark) are implemented; T-05-07-03 fired as designed (over budget, see decision).

## NEEDS CONTROLLER

Email render is over budget per consumer batch (cold 29 to 41 ms against 10 ms; warm mean about 4.3 ms; gzip 266.56 KiB). Planner revision of 05-11/05-19 to pre-render HTML at build or enqueue time, or a lower `max_batch_size` (F19, A4).

## Self-Check: PASSED

Files exist: brand.ts, components.ts, messages/en.ts, messages/ar.ts, email-shell.test.ts, helpers/email-scheme.ts, build-email-logo.mjs, email-logo-white.png. Commits found: 05bc2c5, 65c301c, a191b02, 5b2b1b8.
