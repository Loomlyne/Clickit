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
| **Quick run command** | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/design-tokens.test.ts tests/unit/clickit-tokens-rule.test.ts` |
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

Filled by the planner per task (`<automated>` in each PLAN). Requirement → check:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| DS-01 | `globals.css` pins #090909 / #ffcc00 / ink / LBC / `--radius 8px`; roles equal the engine formula on `ui.config.json` | unit | `--test tests/unit/design-tokens.test.ts` | ❌ W0 | ⬜ pending |
| DS-01 | DESIGN.md token table equals `globals.css`; no `#0a0a0a` / indigo in DESIGN.md | unit | same | ❌ W0 | ⬜ pending |
| DS-01 | Admin page token list ⊆ `globals.css` and covers every `:root` colour token | unit | same | ❌ W0 | ⬜ pending |
| DS-02 | No raw hex / rgb / bracket radius / bracket shadow / raw palette class in `src/` outside allowlist | lint | `npx eslint "src/**/*.{ts,tsx}"` exit 0 | ❌ W0 | ⬜ pending |
| DS-02 | Rule fixtures pass/fail as listed | unit | `--test tests/unit/clickit-tokens-rule.test.ts` | ❌ W0 | ⬜ pending |
| DS-02 | One brand map: `@theme --color-brand-*` == `BRAND_COLOR_HEX`; no second hex map | unit | design-tokens test | ❌ W0 | ⬜ pending |
| DS-02 | `cn()` merges named radius/shadow utilities | unit | design-tokens test | ❌ W0 | ⬜ pending |
| DS-02 | Bracket → named utility resolves to the same px (codemod table) | unit | design-tokens test | ❌ W0 | ⬜ pending |
| DS-03 | `04-GATE.md` has four dated group signature lines | grep | `grep -c "Signed:" .planning/phases/04-design-system-truth/04-GATE.md` = 4 | ❌ W0 | ⬜ pending |
| DS-04 | Page under `src/app/[locale]/admin/`; no top-level `design-system` route; admin layout redirect intact | unit (static pin) | design-tokens test | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `eslint-rules/clickit-tokens.mjs` + registration in `eslint.config.mjs` (starts `warn`, flips to `error` after the codemod)
- [ ] `tests/unit/design-tokens.test.ts`, `tests/unit/clickit-tokens-rule.test.ts`
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
