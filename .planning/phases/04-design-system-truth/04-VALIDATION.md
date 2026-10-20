---
phase: 4
slug: design-system-truth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-20
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `04-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` via `node --experimental-strip-types` (no vitest/jest) |
| **Config file** | none; globs in `package.json` `test:unit` |
| **Quick run command** | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/design-*.test.ts tests/unit/email-tokens.test.ts tests/unit/brand-colors.test.ts tests/unit/clickit-tokens-rule.test.ts` |
| **Full suite command** | `npm run gate:local` (build with placeholder public env, under `/Users/koss/.clickit-heavy.lock`) |
| **Estimated runtime** | quick ~10 s; full ~4-6 min |

---

## Sampling Rate

- **After every task commit:** quick run command + `npx eslint <changed files>`
- **After every plan wave:** `npm run lint && npm run typecheck && npm run test:unit`
- **Before `/gsd-verify-work`:** `npm run gate:local` green
- **Max feedback latency:** 30 seconds (quick)

---

## Per-Task Verification Map

Generated from each plan's `<files>` / `<automated>` (2026-10-20, after checker round 3).

| Requirement | Behavior | Plan | Automated Command | File Exists | Status |
|-------------|----------|------|-------------------|-------------|--------|
| DS-01 | Tokens pinned (#090909, #ffcc00, ink, LBC, --radius 8px, engine radius roles), named utilities, status tones, exact-value tokens, `cn()` merge | 04-01 | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/design-tokens.test.ts` | ❌ W0 | ⬜ pending |
| DS-02 | Email-safe tokens, both schemes, literal hex, footer ≥ 4.5:1 | 04-01 | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/email-tokens.test.ts` | ❌ W0 | ⬜ pending |
| DS-02 | Lint rule fixtures pass/fail | 04-02 | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/clickit-tokens-rule.test.ts` | ❌ W0 | ⬜ pending |
| DS-02 | One brand map; no second hex map; consumers import it | 04-03 | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/brand-colors.test.ts` | ❌ W0 | ⬜ pending |
| DS-01, DS-04 | Admin page under `src/app/[locale]/admin/`; token list ⊆ globals.css; admin guard intact; no top-level route | 04-04 | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/design-system-page.test.ts` | ❌ W0 | ⬜ pending |
| DS-02 | D-03 snaps + D-01 literals (popover keeps /98) | 04-05 | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/design-snaps.test.ts` | ❌ W0 | ⬜ pending |
| DS-01 | DESIGN.md tables equal globals.css / email-tokens.ts (every name in the first cell) | 04-06 | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/design-doc.test.ts` | ❌ W0 | ⬜ pending |
| DS-02 | No banned legacy literals; admin.css has no px radius / hex; every waiver has a reason | 04-13 | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/design-no-legacy.test.ts` | ❌ W0 | ⬜ pending |
| DS-02 | No raw hex / rgb / bracket radius / bracket shadow / palette class in src/ (rule at error) | 04-13 | `npx eslint (via `npm run lint`)` | ❌ W0 | ⬜ pending |
| DS-03 | Four dated group signature lines in 04-GATE.md | 04-14 | `grep -cE '^- (Foundations|Viewer|Admin|Email) — Koss, [0-9]{4}-[0-9]{2}-[0-9]{2}' .planning/phases/04-design-system-truth/04-GATE.md = 4` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `eslint-rules/clickit-tokens.mjs` + registration in `eslint.config.mjs` (starts `warn`, flips to `error` after the codemod)
- [ ] `tests/unit/design-tokens.test.ts`, `email-tokens.test.ts`, `clickit-tokens-rule.test.ts`, `brand-colors.test.ts`, `design-system-page.test.ts`, `design-snaps.test.ts`, `design-doc.test.ts`, `design-no-legacy.test.ts` (each created RED in its plan)
- [ ] `tests/unit/helpers/ui-system-radius.ts` (vendored `buildRadius`, source comment with ui-system commit)
- [ ] `.planning/phases/04-design-system-truth/04-GATE.md` signature lines
- No framework install needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin page renders swatches, EN + AR type, radii, Button/Input/Badge/Select | DS-01 | needs an admin session | 1. Sign in as admin locally. 2. Open `/en/admin/design-system` → five sections, match summary shows 0 differences. 3. Open `/ar/admin/design-system` → page mirrors, Arabic sample in LBC. 4. 375px width → no horizontal scroll. |
| Signed-out and non-admin refused | DS-04 | auth state | 1. Signed out, open `/en/admin/design-system` → sent away (no page content). 2. Signed in as a viewer → redirected to `/watch`. 3. Admin → page loads. |
| Live look unchanged except the ledger | DS-02 | visual | Controller takes before/after screenshots of home, a show, watch, admin dashboard on the local build (one browser lane, `--workers=2` max); only ledger items differ. |
| Canvas boards exist and each group is signed | DS-03 | external tool + owner signature | Koss opens the "Clickit Story" canvas, reviews each group, signs in `04-GATE.md`. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
