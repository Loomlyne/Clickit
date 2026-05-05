---
phase: 32
slug: watch-route-isolation-fullscreen-shell
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-05
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual smoke test — no automated unit tests for this phase (UI/browser interaction) |
| **Config file** | N/A |
| **Quick run command** | `npm run dev` → load `/en/watch/[episodeId]` in browser |
| **Full suite command** | Visual QA on iOS Safari (dynamic toolbar) + Chrome DevTools mobile emulation |
| **Estimated runtime** | ~5 minutes per QA pass |

---

## Sampling Rate

- **After every task commit:** `grep -r "loadVideoById\|h-dvh\|min-h-svh" src/components/watch/watch-shell.tsx`
- **After every plan wave:** Visual QA in browser — load watch page, verify fullscreen, test episode switch
- **Before `/gsd-verify-work`:** All 6 WATCH requirements pass manual smoke test

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 1 | WATCH-01 | — | N/A | smoke | `grep -r "WatchLayout\|h-dvh" src/app/\[locale\]/\(watch\)/layout.tsx` | ❌ W0 | ⬜ pending |
| 32-01-02 | 01 | 1 | WATCH-02 | — | N/A | smoke | `grep -r "fixed inset-0" src/components/watch/watch-shell.tsx` | ❌ W0 | ⬜ pending |
| 32-01-03 | 01 | 1 | WATCH-03 | — | N/A | static grep | `grep -n "h-dvh.*min-h-svh\|min-h-svh.*h-dvh" src/components/watch/watch-shell.tsx` | ❌ W0 | ⬜ pending |
| 32-01-04 | 01 | 1 | WATCH-04 | — | N/A | static grep | `grep -n "controls" src/components/watch/youtube-player.tsx` | ✅ existing | ⬜ pending |
| 32-02-01 | 02 | 2 | WATCH-05 | — | N/A | smoke | Manual: click episode link, verify no YT iframe network request on switch | ❌ W0 | ⬜ pending |
| 32-02-02 | 02 | 2 | WATCH-05 | — | N/A | static grep | `grep -n "loadVideoById" src/components/watch/watch-shell.tsx` | ❌ W0 | ⬜ pending |
| 32-02-03 | 02 | 2 | WATCH-06 | — | N/A | smoke | Manual: watch 15s, refresh, verify resume within 10s of last position | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/app/[locale]/(watch)/layout.tsx` — create bare layout (h-dvh overflow-hidden bg-black)
- [ ] `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx` — move from (viewer), remove -mt-16 hack
- [ ] `src/components/watch/watch-shell.tsx` — new WatchShell client component
- [ ] Delete `src/app/[locale]/(viewer)/watch/` — remove old route after migration
- [ ] Delete `src/components/watch/watch-page-content.tsx` — after WatchShell confirmed working

*No test framework install required — existing `npm run dev` is sufficient for smoke testing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No Navbar/Footer/Silk/Ticker on watch page | WATCH-01 | DOM inspection required | 1. `npm run dev` 2. Navigate to `/en/watch/[any-episodeId]` 3. Inspect DOM — no `.navbar`, no `.footer`, no `[data-silk]`, no ticker element |
| Video fills 100dvw × 100dvh | WATCH-02 | Requires viewport measurement | 1. Open DevTools → Device emulation (iPhone) 2. Verify iframe occupies full viewport in both portrait and landscape |
| iOS toolbar doesn't clip player | WATCH-03 | Real device or Safari emulation required | 1. Open in iOS Safari (or Safari Responsive Design Mode) 2. Scroll to show/hide toolbar 3. Verify player height tracks dynamic toolbar correctly |
| `controls=1` — native controls visible | WATCH-04 | Visual confirmation | Play video, verify YouTube scrubber/volume/fullscreen controls visible |
| Episode switch via `loadVideoById` (no remount) | WATCH-05 | Network inspector required | 1. Open DevTools → Network tab, filter by `youtube.com/embed` 2. Click a different episode 3. Verify NO new iframe request fires (only XHR/fetch for video data) |
| Progress writes survive episode switch | WATCH-06 | Multi-step interaction | 1. Watch 20s 2. Switch episode 3. Switch back to original episode 4. Refresh page 5. Verify resume position ~20s into original episode |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency documented
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
