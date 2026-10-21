---
phase: 06-youtube-import-and-player
plan: 16
subsystem: admin-settings
tags: [youtube, vault, settings, server-actions, secret-field, tdd]
requires:
  - phase: 06-01
    provides: "Vault functions, readYouTubeKeyMeta, YOUTUBE_KEY_FORMAT, withinRateLimitCore"
  - phase: 06-04
    provides: "nextQuotaReset, formatQuotaReset"
  - phase: 06-05
    provides: "admin.settings key-block strings (keySaveFailed), YouTubeStatusChip"
  - phase: 06-08
    provides: "getServerYouTubeClient"
  - phase: 06-13
    provides: "requireAdminForYouTube, youtubeAdminEnv"
provides:
  - "saveYouTubeApiKeyCore + youtubeKeySchema (src/lib/admin/youtube-key-save.ts)"
  - "testYouTubeKeyCore, readLastKeyTestCore, KeyTestResult (src/lib/admin/youtube-key-status.ts)"
  - "saveYouTubeApiKey and testYouTubeKey server actions"
  - "Editable key block in Admin › Settings (UI-SPEC §6, G6)"
affects: [06-19, 06-21, 06-23]
tech-stack:
  added: []
  patterns:
    - "Key block is its own form; the browser holds only hasKey, last4 and the last test"
    - "Last test stored as an audit row; a newer key-change row resets it to not tested"
key-files:
  created:
    - src/lib/admin/youtube-key-save.ts
    - src/lib/admin/youtube-key-status.ts
    - tests/unit/youtube-key-save.test.ts
    - tests/unit/youtube-key-status.test.ts
    - tests/unit/admin-settings-key-guards.test.ts
  modified:
    - src/app/[locale]/admin/actions.ts
    - src/components/admin/settings/secret-field.tsx
    - src/components/admin/settings/advanced-tab.tsx
    - src/components/admin/settings/settings-tabs.tsx
    - src/app/[locale]/admin/settings/page.tsx
key-decisions:
  - "Save failure copy uses admin.settings.keySaveFailed (06-05), with errors.rateLimit / errors.forbidden / errors.networkError as {reason}; an empty reason is collapsed to one space"
  - "Test key with no saved key answers missing without a YouTube call and without an audit row"
  - "Probe id: first non-archived episode with a video id (oldest first); fallback jNQXAC9IVRw"
  - "TODO(phase-4) sits as a literal // comment above the TEST_OK_ICON constant holding text-brand-green-safe (a // comment cannot sit inside JSX)"
requirements-completed: [YT-04]
duration: 13min (19:12-19:25 CET)
completed: 2026-10-20
---

# Phase 6 Plan 16: Editable YouTube key in Settings Summary

**Admins can now paste, change and test the YouTube key in Admin › Settings. The key is saved to Supabase Vault through a rate-limited admin action and takes effect on the next request. After that the browser only ever sees `•••• last4`. Every save and every test is audited. The old `youtube_api_key` write path is gone.**

## Task Commits

| Task | Name | RED | GREEN |
|------|------|-----|-------|
| 1 | Pure cores for saving and testing the key | b912c0c | e2caf74 |
| 2 | saveYouTubeApiKey / testYouTubeKey actions; remove the old write path | 01c11d6 | e6b14e7 |
| 3 | Editable key field (SecretField, advanced tab, settings page) | 9ef5367 | ab44b5c |

No refactor commits.

## What was built

- **`saveYouTubeApiKeyCore(db, { audit, adminUserId, now }, raw)`** works in this order:
  1. `youtubeKeySchema` (trim + `YOUTUBE_KEY_FORMAT`). A bad value returns `format_invalid` and nothing touches the database.
  2. `withinRateLimitCore` with key `youtube-key-save:<admin>`, max 10 per 3600 s, `failOpen: false`. A refusal returns `limited`.
  3. One `rpc('set_youtube_key', { p_key })`. An error or a throw returns `save_failed` with a fixed message.
  4. One audit row: `config_update` / `app_config` / `'1'` / `{ kind: 'youtube_key_changed', last4 }`.
  5. If that audit write fails, the save still returns success with `auditError` set; the failure is not hidden.
- **`testYouTubeKeyCore(db, deps, client | null)`** makes one `getVideos([probeId])` call (1 unit). It maps `key_rejected`, `api_not_allowed` and `quota` to `rejected`, `apiNotAllowed` and `quota`; anything else becomes `network`. It writes an audit row `{ kind: 'youtube_key_test', ok, reason? }`. A null client returns `missing`.
- **`readLastKeyTestCore(db)`** reads the newest 20 `app_config` / `config_update` audit rows and returns the first key-test row as `{ at, ok, reason }`. If a `youtube_key_changed` row is newer, it returns null, so the line shows "Not tested yet".
- **Actions** (`actions.ts`):
  - `saveYouTubeApiKey(raw)` and `testYouTubeKey()` both use `runAdminAction(youtubeAdminEnv, …)`.
  - `testYouTubeKey` reads the Vault key on the same request through `getServerYouTubeClient()`. It returns `{ ok, reason?, at, resetAt }`; `resetAt` is set only for `quota`.
  - `youtube_api_key` is removed from `integrationsSchema` and `updateIntegrations`.
  - `runAdminAction(youtubeAdminEnv` now appears 4 times.
- **UI**:
  - `SecretField` follows UI-SPEC §6: password input with `pe-12`, the eye inside the field (`absolute end-0 top-0 size-11`, `aria-pressed`, focus ring inset), a saved view showing `keySavedMasked` plus Change key (`px-6`), and Esc / Keep current key to go back.
  - `advanced-tab.tsx` has a new `YouTubeKeyBlock`: overline, card, a row with the status chip (Key set / Key missing / Test failed) and `keyHelp`, a row with the field plus Save key / Test key, and an `aria-live` state line.
  - The typed key is cleared from state after a successful save.
  - The quota reason uses `formatQuotaReset`. Test dates are shown as "20 Oct, 15:42" in Dubai time.
  - The settings page passes `{ hasKey, last4, lastTest }` only.

## Verification

Verified:
- `node --test` on youtube-key-save, youtube-key-status and admin-settings-key-guards: 39 pass (27 + 12).
- Task 2 set (key guards, admin-actions-id-coverage, admin-actions-youtube-wrappers): 17 pass, run before the Task 3 additions.
- `npm run test:unit`: 969 pass, 0 fail.
- `npx tsc --noEmit`: clean after Task 3. `npx eslint` on every touched source and test file: clean.
- Acceptance greps:
  - no `@/`, `server-only` or `next/` imports in either core: 0 / 0
  - `console.` in the save core: 0
  - `youtube_api_key` in actions.ts: 0
  - `runAdminAction(youtubeAdminEnv`: 4
  - `getYouTubeApiKey` in the settings page: 0; `readYouTubeKeyMeta`: 2
  - `left-` / `right-` / `text-left` / `text-right` in secret-field: 0
- The key-safety tests use the fake key `'AIza' + 'A'.repeat(31) + 'wxyz'`. Neither the key nor its first 8 characters appear in any result, audit argument, audit row or `logError` argument.
- The non-admin path records no rpc call and no insert.
- RED was shown for each task before its GREEN commit: the module-not-found failure, then 3 of 4 guards failing, then 7 of 12.

Not verified:
- No build, `gate:local` or Playwright run; these heavy steps are left for the PR gate.
- No browser look at the block against the G6 pictures. The PNGs were not opened; the layout follows the `06-mockups.html` source and UI-SPEC §6.
- Actions not executed. They need Next and `server-only`, so their behaviour rests on the core tests and the source scan.
- No live Vault write and no real YouTube call (by rule).

Failed: nothing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `settings-tabs.tsx` was not in files_modified**
- **Issue:** the page passes the key status to `SettingsTabs`, which hands it to `AdvancedTab` as `hasYouTubeKey`. Changing the tab's prop without changing this file would not compile.
- **Fix:** `SettingsTabs` now takes `youtubeKey: YouTubeKeyView` and passes it through.
- **Commit:** ab44b5c

**2. [Project rule] `keySaveFailed` instead of `saveFailed`**
- The plan's behaviour list names `saveFailed`. The project rule (06-05) says the key-save failure message is `admin.settings.keySaveFailed`, so the block uses that and the guard test checks for it. The plain `saveFailed` is still used by the feature-flag save.

**3. [Rule 1 - Test bug] Guard regex for the action parameter**
- My first regex did not allow a line break after `saveYouTubeApiKey(`. Fixed before the Task 2 GREEN commit.

**4. [Rule 2] Key-safety hardening inside the save core**
- An rpc throw is caught inside the core, so a client error that might quote the request never reaches the runner's `logError`.
- The block also runs the same format check before calling the action, as a quick refusal. The server check is still the one that counts.

**5. Planned temporary type error between Task 2 and Task 3**
- e6b14e7 removes `youtube_api_key` from the action while `advanced-tab.tsx` still sends it, so `tsc` reports one error at that commit. The plan expected this; ab44b5c fixes it.

### Additions inside the plan's scope

- `KeyTestReason`, `LastKeyTest` and `SaveKeyResult` / `SaveKeyCode` are exported. `KeyTestData` is the action's result type.
- `SecretField` takes an `actions` slot, so Save key / Test key sit on the same row as the field, as in the G6 pictures.
- In the saved state the buttons are Change key + Test key; while editing they are Save key (+ Keep current key when changing a stored key) + Test key, which is disabled until the key is saved. This follows the G6 pictures.

## TDD Gate Compliance

Each task has a `test(06-16)` commit followed by a `feat(06-16)` commit, so all three RED/GREEN gate pairs are present.

## Known Stubs

None. Message keys `getKey`, `apiKeyLabel`, `apiKeyHint`, `apiKeyPlaceholder`, `youtubeApiDescription` and `replace` are now unused. Deleting them, and removing `getYouTubeApiKey` from `src/lib/config.ts`, is left for 06-19 as planned.

## Threat Flags

None beyond the register:
- T-06-61: the page reads only meta and the last test; the guard bans `get_youtube_key`, `readYouTubeApiKey` and `updatedAt` in the page.
- T-06-63 / T-06-65: there is no `console.` in the core or the action block, and the tests assert the key never appears in results, audit rows or logs.
- T-06-64: `allowedOrigins` is absent (guard) and the actions go through the seam.
- T-06-66: the format check runs first and the rate limit fails closed.
- T-06-68: every save and every test writes an audit row naming the admin.

## TODO(phase-N)

- `src/components/admin/settings/advanced-tab.tsx`: `// TODO(phase-4): use var(--safe-green) once Phase 4 adds it`, above `TEST_OK_ICON`.
- The actions use `youtubeAdminEnv`, which carries the 06-13 `TODO(phase-5)` seam.

## Self-Check: PASSED
