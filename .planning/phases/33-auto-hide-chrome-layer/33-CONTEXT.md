# Phase 33: Auto-Hide Chrome Layer - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous mode, decisions pre-determined from ROADMAP + Phase 32 context)

<domain>
## Phase Boundary

Replace the minimal placeholder back link in `WatchShell` with a full auto-hiding chrome layer: top overlay (back, show title, S/E badge, watchlist/like/share) and left/right edge arrows (prev/next episode). Chrome fades in on any user interaction and fades out after 3 seconds of inactivity. When hidden, `pointer-events: none` ensures YouTube's native controls remain fully tappable. Pausing the video forces chrome visible.

</domain>

<decisions>
## Implementation Decisions

### Idle Timer
- Custom `useIdleTimer(delay, options)` hook with no external library. `delay = 3000ms`.
- Initial watch state uses `initialIdle: true` and `startOnMount: false`, so chrome is hidden on entry.
- Resets on: `pointermove`, `pointerdown`, `keydown`, `touchstart` events on the shell.
- Returns `{ isIdle, resetTimer }`, shell consumes both.
- `onStateChange` state=2 (paused) sets `isPaused=true`, disables the idle timeout, and calls `resetTimer()` so chrome stays visible until playback resumes.
- Timer is cleared on unmount via cleanup.

### Top Overlay
- `fixed top-0 left-0 right-0 z-20`, full-width strip, above player (`z-10`).
- Gradient: `bg-gradient-to-b from-black/70 to-transparent`, scrim so text is legible without covering player.
- Padding: `px-4 pt-4 pb-8` (room for gradient fade).
- Left: back button (`← Back` arrow + show.slug link, same as current placeholder).
- Center: show title + `S{N} E{N}` badge (from `currentEpisode`).
- Right: watchlist + like + share icon buttons (reuse existing `useWatchlist` / `useLikes` hooks).
- Fade: `transition-opacity duration-200`, `opacity-100` when chrome visible, `opacity-0` when idle.
- `pointer-events: none` when idle; `pointer-events: auto` when visible.

### Edge Arrows (Prev/Next)
- Two `fixed` buttons: `left-4` (prev) and `right-4` (next), `top-1/2 -translate-y-1/2`.
- Hidden (not rendered, not just opacity-0) when no prev/next episode. `prevEpisode` and `currentNextEpisode` already in scope.
- Same fade/pointer-events behavior as top overlay, share `isIdle` state.
- Arrows call `handleEpisodeSwitch`, already in `WatchShell`.
- Size: `size-10 rounded-full bg-black/40 backdrop-blur-sm` with chevron icon from lucide-react.

### Chrome Trigger Boundary
- Interaction events attach to the `WatchShell` root div (`onPointerMove`, `onPointerDown`, `onTouchStart`, `onKeyDown`), NOT on the YouTube iframe (cross-origin, events won't fire).
- On any event: reset idle timer, set chrome visible.
- YouTube iframe itself triggers nothing, thin edge overlay strips (`h-12` top/bottom of iframe area) can capture swipes if needed, but for Phase 33 pointer events on the shell div are sufficient for desktop/mobile pointer events.

### Component Structure
- No new component file for the overlay, add directly inside `WatchShell` JSX to keep state co-located (idle state needs access to `handleEpisodeSwitch`, `currentEpisode`, `prevEpisode`, `currentNextEpisode`).
- New file: `src/hooks/use-idle-timer.ts`, reusable hook.
- The placeholder `<div className="absolute top-4 left-4 z-10">← Back</div>` is deleted and replaced.

### Paused = Chrome Forced Visible
- `onStateChange` state=2 sets `isPaused=true` and calls `resetTimer()` from `useIdleTimer`.
- While paused, `disabled: isPaused` suppresses the timeout callback, so chrome remains visible.
- state=1 (playing) sets `isPaused=false` and calls `resetTimer()`, restoring the normal idle timeout.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/hooks/use-progress-tracker.ts`, pattern for hooks that clean up on unmount
- `src/hooks/use-watchlist.ts` / `src/hooks/use-likes.ts`, for right-side action buttons
- `lucide-react`, already installed, use `ChevronLeft`, `ChevronRight`, `Heart`, `Bookmark`, `Share2`
- `src/components/watch/watch-shell.tsx`, integration point; `prevEpisode`, `currentNextEpisode`, `handleEpisodeSwitch`, `seasons`, `currentEpisode`, `show` all in scope

### Established Patterns
- `'use client'` hooks export named function, return typed object
- Tailwind `transition-opacity duration-200` for fade transitions (seen in other components)
- `fixed inset-0` / `absolute inset-0` positioning pattern (established in Phase 32)
- `z-10` for overlay content above player

### Integration Points
- `WatchShell` JSX: delete placeholder back link, add `useIdleTimer` call, add overlay JSX
- `onStateChange` handler: state=2 → set `isPaused=true` + call `resetTimer()`; state=1 → set `isPaused=false` + call `resetTimer()`
- `page.tsx` must also fetch `getShowWatchlistState(userId, show.id)` + `getShowLikeState(userId, show.id)` and pass as `initialIsWatchlisted` / `initialIsLiked` props to `WatchShell`
- Existing `prevEpisode` prop (Phase 33 scaffolding from Phase 32) is now actively used

</code_context>

<specifics>
## Specific Ideas

- User requirement verbatim: "when i am watching the video on full screen and i scroll from down to up then the next episodes of the show will appear", the chrome layer (Phase 33) is a prerequisite for the tray (Phase 34). Keep the top overlay minimal/clean.
- The "← Back" placeholder link from Phase 32 must be fully replaced (not just hidden behind the new overlay).
- `pointer-events: none` when hidden is a hard constraint, YouTube controls must never be blocked.

</specifics>

<deferred>
## Deferred Ideas

- Keyboard shortcut (spacebar to pause, arrow keys to seek), could be added later, not Phase 33 scope.
- Volume control in chrome overlay, not in CHROME-01 spec.
- Subtitle/quality picker in overlay, Phase 33 scope is back/title/badge/watchlist/like/share only.

</deferred>
