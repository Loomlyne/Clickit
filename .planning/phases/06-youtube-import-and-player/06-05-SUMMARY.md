---
phase: 06-youtube-import-and-player
plan: 05
subsystem: ui
tags: [i18n, next-intl, messages, arabic, status-chip, tdd]
requires:
  - phase: 06-00
    provides: "Wave 0 gate (G8: Phases 2-5 absent, TODO(phase-N) markers in force)"
provides:
  - "157 new EN and AR message keys for Phase 6 (import sheet, status chips, errors, episode form, episodes table, dashboard, settings key block, player, watch)"
  - "YouTubeStatusChip and toneForYouTubeStatus (shared four-tone chip)"
  - "EN/AR parity, placeholder, digit-rule test for every new key"
affects: [06-06, 06-07, 06-08, 06-09, 06-10, 06-11, 06-12, 06-13, 06-14, 06-15, 06-16, 06-17, 06-18, 06-19]
tech-stack:
  added: []
  patterns:
    - "Messages added in one early plan so UI plans never edit the message files in parallel"
    - "Chip text is always passed as children (words, not colour alone)"
key-files:
  created:
    - src/components/admin/youtube-status-chip.tsx
    - tests/unit/youtube-messages.test.ts
  modified:
    - src/messages/en.json
    - src/messages/ar.json
key-decisions:
  - "Key-save failure message is admin.settings.keySaveFailed, not saveFailed: the existing generic admin.settings.saveFailed ('Failed to save') has about ten callers that pass no {reason}"
  - "Nothing removed in this plan; unused-key deletion stays in 06-19"
patterns-established:
  - "ICU parity test: small brace-aware parser checks argument names, <bdi> counts, number formatting and literal digits per key"
requirements-completed: [YT-01, YT-02, YT-03, YT-04, YT-06, YT-07]
duration: ~25min
completed: 2026-10-20
---

# Phase 6 Plan 05: Messages and status chip Summary

All Phase 6 UI strings (EN and AR) from the UI-SPEC copywriting contract are in place, guarded by a parity test, plus one shared `YouTubeStatusChip`.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | Add every new EN and AR key | 8cf13e1 |
| 2 (RED) | Failing parity and chip test | fa31a02 |
| 2 (GREEN) | YouTubeStatusChip and tone mapping | 6cb7bba |

- **Task 1:** 157 keys added across `admin.youtubeImport` (with nested `reason.*`), `admin.youtubeStatus`, `admin.youtubeErrors`, and additions to `admin.episodeForm`, `admin.episodesTable`, `admin.dashboard`, `admin.settings` (with nested `testReason.*`), `player` and `watch`. One existing key replaced: `admin.episodeForm.toastNoYoutubeKeyDescription`. Copy taken verbatim from the revised UI-SPEC, including:
  - both quota strings carry `{time}` ("Try again tomorrow" is gone),
  - `admin.youtubeImport.capNote` (200-item cap),
  - `player.upNextBarTitle` (G1 = B up-next bar copy),
  - the G6 editable key field copy (`keyHelp`, `keyLabel`, `keyPlaceholder`, `keySavedMasked` with last4, `changeKey`, `cancelChange`, `saveKey`, `savingKey`, `keySavedJust`, `formatInvalid`, `testKey` ...). `storedInCloudflare` was not added.
  - `<bdi>` tags kept as specified. No existing key deleted; the JSON diff shows only trailing-comma changes plus the one replacement.
- **Task 2:** `youtube-status-chip.tsx` exports `YouTubeStatusChip({ tone, icon?, children, className? })` and `toneForYouTubeStatus` (ok to ok; private/removed/not_embeddable/blocked_ae to bad; not_ready/needs_english to warn; already to neutral). Exact base and tone classes from the UI-SPEC, 11px text, logical properties only. The literal `// TODO(phase-4): ...` comment sits above the tone map (G8 stand-in for Phase 4 tokens).

## Verification

- `node --test tests/unit/youtube-messages.test.ts`: 6 pass, 0 fail (re-run after the interruption).
- `npx eslint` on `youtube-status-chip.tsx` and `youtube-messages.test.ts`: clean.
- `npx tsc --noEmit`: clean.
- Acceptance greps: `{time}` count is 4 in both files; "Try again tomorrow" count 0; `left-`/`right-` in the chip 0; `text-[11px]` present, no smaller size.
- TDD gates: RED commit (fa31a02, only the chip test failed, the five message tests already passed because Task 1 landed first) then GREEN commit (6cb7bba).

## Decisions Made

- `keySaveFailed` instead of `saveFailed` (see Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Key-save message could not reuse the key name `saveFailed`**
- **Found during:** Task 1
- **Issue:** The plan and UI-SPEC list `admin.settings.saveFailed` ("The key wasn't saved. {reason} Try again."). That key already exists ("Failed to save") and is called without arguments from about ten components (hero-video-manager, advanced-tab, live-stream-url-editor, genre-color-editor, top-ticker-editor, auth-page-editor ...). Replacing it would break them with a missing-argument error.
- **Fix:** Kept the existing key, added the new text as `admin.settings.keySaveFailed` (EN and AR). The key-field plan (settings UI) must call `keySaveFailed`.
- **Files modified:** src/messages/en.json, src/messages/ar.json
- **Commit:** 8cf13e1

**2. [Rule 3 - Blocking] Chip logic cannot be imported by `node --test`**
- **Found during:** Task 2
- **Issue:** The chip imports `@/lib/utils` (alias) and is a `.tsx` file, so the node test runner cannot load it.
- **Fix:** The test checks the chip source text (tone classes, TODO marker, 11px, no `left-`/`right-`, all eight statuses present). `toneForYouTubeStatus` behaviour is covered by type checking and code review only, not by an executed test.
- **Commit:** fa31a02

**3. [Test scope] `successBody` `{season}`**
- `admin.youtubeImport.successBody` uses `{season}` as a season title (inside `<bdi>`), not a number, so the digit rule exempts it through a `NAME_ARGS` entry in the test.

## Known Stubs

None.

## Threat Flags

None. Static copy only. T-06-20 mitigated: every name placeholder sits in `<bdi>` and the test compares `<bdi>` counts between EN and AR.

## Not verified

- `toneForYouTubeStatus` is not executed by a test (see deviation 2).
- The chip is not rendered anywhere yet; no visual check. Tailwind resolution of `bg-brand-*-safe/8` was not checked in a build (no build run, per project rules).
- Arabic copy was transcribed from the UI-SPEC; no native-speaker review in this plan.
- Full `gate:local` was not run.

## Self-Check: PASSED

- FOUND: src/components/admin/youtube-status-chip.tsx
- FOUND: tests/unit/youtube-messages.test.ts
- FOUND commits: 8cf13e1, fa31a02, 6cb7bba
