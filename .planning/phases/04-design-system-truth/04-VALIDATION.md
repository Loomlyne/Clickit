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

Generated from each plan's `<files>` / `<automated>` (2026-10-20, after checker round 3; revised 2026-10-20 for Q6 = C: new plan 04-15, canvas 23 boards, waves per 04-GATE.md §2).

Waves (04-GATE.md §2): W1 04-01 · W2 04-02 · W3 04-03 · W4 04-04, 04-05 · W5 04-06 · W6 04-09 · W7 04-10, 04-11 · W8 04-12 · W9 04-15 · W10 04-07, 04-13 · W11 04-08 · W12 04-14. The UI System track (`04-UIS-TRACK.md`, gate §7) is external: 04-15 waits for its release (§7 step 4), 04-07 for §7 step 5.

| Requirement | Behavior | Plan | Automated Command | File Exists | Status |
|-------------|----------|------|-------------------|-------------|--------|
| DS-01 | Tokens pinned (#090909, #ffcc00, ink, LBC, --radius 8px, engine radius roles), named utilities, status tones, exact-value tokens, `cn()` merge | 04-01 | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/design-tokens.test.ts` | ❌ W0 | ⬜ pending |
| DS-02 | Email-safe tokens, both schemes, literal hex, footer ≥ 4.5:1 | 04-01 | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/email-tokens.test.ts` | ❌ W0 | ⬜ pending |
| DS-02 | Lint rule fixtures pass/fail | 04-02 | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/clickit-tokens-rule.test.ts` | ❌ W0 | ⬜ pending |
| DS-02 | One brand map; no second hex map; consumers import it | 04-03 | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/brand-colors.test.ts` | ❌ W0 | ⬜ pending |
| DS-01, DS-04 | Admin page under `src/app/[locale]/admin/`; token list ⊆ globals.css; admin guard intact; no top-level route | 04-04 | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/design-system-page.test.ts` | ❌ W0 | ⬜ pending |
| DS-02 | D-03 snaps + D-01 literals (popover keeps /98) | 04-05 | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/design-snaps.test.ts` | ❌ W0 | ⬜ pending |
| DS-01 | DESIGN.md tables equal globals.css / email-tokens.ts (every name in the first cell) | 04-06 | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/design-doc.test.ts` | ❌ W0 | ⬜ pending |
| DS-01, DS-02 | UI System release adopted: installed version = §7 tag, tarball URLs + sha512 integrity, no `@ui-system/*` from the npm registry, ui.css imported once and scoped (`.uis` / `[data-tone="image"]` only), parts re-exported from `src/components/ui/uis.tsx`, every `--uis-*` the parts read = Clickit token or engine value, ui.config.json fonts + status colours | 04-15 | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/uis-adoption.test.ts` | ❌ W0 | ⬜ pending |
| DS-01, DS-04 | "From the UI System" block on the admin page: `uis*` keys in en/ar, panel imports only `@/components/ui/uis`, no data access or form action | 04-15 | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/design-system-page.test.ts` | ❌ W0 | ⬜ pending |
| DS-01 | DESIGN.md "UI System first" section (rule from 04-06; parts, version, mapping from 04-15) | 04-06, 04-15 | `grep -c "^## UI System first" DESIGN.md = 1` and `grep -c "src/components/ui/uis.tsx" DESIGN.md ≥ 1` | ❌ W0 | ⬜ pending |
| DS-01, DS-02, DS-04 | gate:local green after wave 9 | 04-15 | `tail -1 /Users/koss/.clickit-checks/p04-w9-gate.log \| grep -qx "exit=0"` | ❌ W0 | ⬜ pending |
| DS-02 | No banned legacy literals; admin.css has no px radius / hex; every waiver has a reason | 04-13 | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/design-no-legacy.test.ts` | ❌ W0 | ⬜ pending |
| DS-02 | No raw hex / rgb / bracket radius / bracket shadow / palette class in src/ (rule at error) | 04-13 | `npx eslint (via `npm run lint`)` | ❌ W0 | ⬜ pending |
| DS-03 | Canvas index has all 23 boards (F0-F5, V1-V4, A1-A5, E0-E7); F/V built by 04-07, A/E by 04-08 (A5/E may wait for Phase 5's signed pictures) | 04-07, 04-08 | `grep -cE '^\| (F[0-5]\|V[1-4]\|A[1-5]\|E[0-7]) ' .planning/phases/04-design-system-truth/04-CANVAS.md = 23` | ❌ W0 | ⬜ pending |
| DS-03 | All 23 boards built before any signature; reviewer pass on legends and UI System part use | 04-14 | `grep -cE '^\| (F[0-5]\|V[1-4]\|A[1-5]\|E[0-7]) .*\| built' .planning/phases/04-design-system-truth/04-CANVAS.md = 23` | ❌ W0 | ⬜ pending |
| DS-03 | Four dated group signature lines in 04-GATE.md | 04-14 | `grep -cE '^- (Foundations|Viewer|Admin|Email) — Koss, [0-9]{4}-[0-9]{2}-[0-9]{2}' .planning/phases/04-design-system-truth/04-GATE.md = 4` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `eslint-rules/clickit-tokens.mjs` + registration in `eslint.config.mjs` (starts `warn`, flips to `error` after the codemod)
- [ ] `tests/unit/design-tokens.test.ts`, `email-tokens.test.ts`, `clickit-tokens-rule.test.ts`, `brand-colors.test.ts`, `design-system-page.test.ts`, `design-snaps.test.ts`, `design-doc.test.ts`, `design-no-legacy.test.ts`, `uis-adoption.test.ts` (each created RED in its plan; 04-15 extends `design-system-page.test.ts`)
- [ ] `tests/unit/helpers/ui-system-radius.ts` (vendored `buildRadius`, source comment with ui-system commit)
- [ ] `.planning/phases/04-design-system-truth/04-GATE.md` signature lines
- No framework install needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin page renders swatches, EN + AR type, radii, Button/Input/Badge/Select | DS-01 | needs an admin session | 1. Sign in as admin locally. 2. Open `/en/admin/design-system` → five sections, match summary shows 0 differences. 3. Open `/ar/admin/design-system` → page mirrors, Arabic sample in LBC. 4. 375px width → no horizontal scroll. |
| "From the UI System" block (04-15) | DS-01 | needs an admin session | 1. Admin opens `/en/admin/design-system` → last Components panel reads "From the UI System · 0.2.0" with CodeInput, SecretInput, CountdownBar, SelectableTable, ReorderList, Skeleton, TotpSetup (+ Inbox if Q10 A) in yellow-on-black. 2. Click inside each part → nothing is sent or saved. 3. `/ar/...` mirrors. 4. Home, a show, watch and the admin dashboard look unchanged. |
| Signed-out and non-admin refused | DS-04 | auth state | 1. Signed out, open `/en/admin/design-system` → sent away (no page content). 2. Signed in as a viewer → redirected to `/watch`. 3. Admin → page loads. |
| Live look unchanged except the ledger | DS-02 | visual | Controller takes before/after screenshots of home, a show, watch, admin dashboard on the local build (one browser lane, `--workers=2` max); only ledger items differ. |
| Canvas boards exist and each group is signed | DS-03 | external tool + owner signature | Koss opens the "Clickit Story" canvas (UI System v0.2.0), reviews each group (23 boards; parts match `mockups/04-q10.png` right column and his Phase 5/6 pictures), signs in `04-GATE.md`. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
