---
phase: 06-youtube-import-and-player
plan: 02
subsystem: api
tags: [youtube, parsing, classifier, i18n-keys, node-test]

requires:
  - phase: 06-youtube-import-and-player
    provides: "06-00 gate (branch has Phase 1/1.1; Phase 2-5 absent, G8)"
provides:
  - "parsePlaylistId / parseVideoIdStrict: strict link parsers with typed error codes"
  - "parseIsoDuration (days included) and secondsToMinutes"
  - "classifyVideo / videoReason: one status precedence for every YouTube entry point"
  - "dominantScript / routeYouTubeText / needsEnglishTitle: one script rule"
  - "YouTubeErrorCode table mapped to admin.youtubeErrors keys, statusToVideoError"
affects: [06-03, 06-04, 06-05, 06-08]

tech-stack:
  added: []
  patterns:
    - "Pure modules under src/server/youtube: no next/*, no server-only, no @/ alias; type-only imports extensionless"
    - "Result type { ok: true; id } | { ok: false; code } for parsers"

key-files:
  created:
    - src/lib/youtube-errors.ts
    - src/server/youtube/urls.ts
    - src/server/youtube/duration.ts
    - src/server/youtube/status.ts
    - src/server/youtube/script.ts
    - tests/unit/youtube-urls.test.ts
    - tests/unit/youtube-duration.test.ts
    - tests/unit/youtube-status.test.ts
    - tests/unit/youtube-script.test.ts
  modified: []

key-decisions:
  - "dominantScript returns 'ar' | 'other' (no separate 'latin' value); empty text is 'other'"
  - "routeYouTubeText caps by code points, not UTF-16 units, so surrogate pairs are never split"
  - "api_not_allowed shares the keyRejected message key (same fix place in Settings > Advanced)"

requirements-completed: [YT-01, YT-02, YT-03]

duration: 14min
completed: 2026-10-20
---

# Phase 6 Plan 02: Pure YouTube classifiers Summary

**Strict playlist/video link parsers, day-aware ISO duration, a single removed>private>not_ready>not_embeddable>blocked_ae>ok status classifier, one majority-script routing rule shared with "Needs English title", and a typed error-code table, all pure and covered by 35 node tests.**

## Task Commits

1. **Task 1: Error codes, URL/id parsing and ISO duration**
   - RED `abad49e` (test), GREEN `77b82a8` (feat)
2. **Task 2: Status classifier, script routing and needs-English rule**
   - RED `8e9c0bb` (test), GREEN `fa8323b` (feat)

No refactor commits were needed.

## Files Created

- `src/lib/youtube-errors.ts` - `YouTubeErrorCode`, `YOUTUBE_ERROR_CODES`, `YOUTUBE_ERROR_MESSAGE_KEYS`, `statusToVideoError` (type-only import of `YouTubeStatus`, safe for client code)
- `src/server/youtube/urls.ts` - host allow-list, http/https only, 2048-char cap, strict id regexes; `video_link_in_import` and `playlist_link_in_form` told apart from `not_a_*_link`
- `src/server/youtube/duration.ts` - `parseIsoDuration`, `secondsToMinutes`
- `src/server/youtube/status.ts` - `YOUTUBE_STATUSES`, `VideoItem`, `classifyVideo`, `videoReason` (RESEARCH Pattern 3 semantics, including the `allowed: []` = blocked everywhere rule)
- `src/server/youtube/script.ts` - `containsArabicScript`, `dominantScript`, `routeYouTubeText`, `needsEnglishTitle`
- Four test files under `tests/unit/youtube-{urls,duration,status,script}.test.ts`

## Verification

- `node --experimental-strip-types ... --test tests/unit/youtube-urls.test.ts youtube-duration youtube-status youtube-script`: 35 tests, 35 pass.
- `npx eslint` on all new source and test files: clean. `npx tsc --noEmit`: clean.
- `grep -cE "from '@/|server-only|next/"` on every new source file: 0.
- Acceptance greps: status order string matches; `export function needsEnglishTitle` count is 1.
- Not verified: no build or `gate:local` run (not required by the plan; no consumers yet).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Spec inconsistency] Test example for the "minority Arabic" case**
- **Found during:** Task 2 (writing the needs-English test)
- **Issue:** The plan's behavior bullet says `needsEnglishTitle({ title: 'Ep 1 حلقة', title_ar: null }) = false (minority Arabic)`. By letter count that title is 4 Arabic letters out of 6, so Arabic is the majority and the stated rule (`dominantScript === 'ar'`) returns true. The example contradicts the rule.
- **Fix:** Kept the rule exactly as the plan states it and used a genuinely minority example in the test: `'Episode 1 حلقة'` (7 Latin vs 4 Arabic letters) = false. The other four behavior bullets are asserted verbatim.
- **Files modified:** tests/unit/youtube-script.test.ts
- **Commit:** 8e9c0bb

None other. No generated DB types were needed (these modules do not touch the new columns); `src/lib/database.types.ts` is untouched.

## Known Stubs

None.

## Threat Flags

None. T-06-12 (SSRF/tampering) is mitigated in `urls.ts` (allow-list, scheme, length cap, strict regexes; a host like `www.youtube.com.evil.com` and `evil.com/youtube.com/...` are tested as refused). T-06-13 (stored XSS) is mitigated by `routeYouTubeText` returning plain trimmed, length-capped text.

## Self-Check: PASSED

- All nine files exist; commits abad49e, 77b82a8, 8e9c0bb, fa8323b present in `git log`.
- STATE.md and ROADMAP.md untouched.
