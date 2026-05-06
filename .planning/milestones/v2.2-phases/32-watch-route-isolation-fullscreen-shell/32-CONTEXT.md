# Phase 32: Watch Route Isolation & Fullscreen Shell - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Move the watch route from `[locale]/(viewer)/watch/[episodeId]` into a new `[locale]/(watch)/watch/[episodeId]` route group so it escapes the viewer layout entirely — no Navbar, Footer, Silk WebGL background, MarqueeTicker, or Lenis smooth-scroll. The new route gets a bare layout.tsx (black bg, overflow-hidden, h-dvh). The YouTube player fills 100dvw × 100dvh using `fixed inset-0 h-dvh min-h-svh overflow-hidden bg-black`. Episode switching uses `loadVideoById()` — iframe is never remounted; continue-watching progress tracking survives switches.

</domain>

<decisions>
## Implementation Decisions

### Component Architecture
- Replace `WatchPageContent` entirely with a new `WatchShell` component; old `WatchPageContent` deleted
- Current-episode state (`currentEpisode` + `currentVideoId`) lives inside `WatchShell` via `useState`
- `page.tsx` strips the `-mt-16` hack and renders `<WatchShell>` directly with all data (episode, show, season, seasons, episodesBySeason, prev, next, initialProgressSeconds, userId)
- `YouTubePlayer` renders at the top of the fullscreen div; iframe fills the entire shell; player ref bubbled up via `onReady` callback

### Interim Phase 32 UX
- A single minimal back `<Link>` anchored top-left — small, low-opacity — so Phase 32 is testable without being stuck; Phase 33 will style and animate it into the full chrome layer
- Keep existing `YouTubePlayer` poster/spinner loading state — no changes to the loading UX
- Missing `youtube_video_id` fallback: redirect to `router.back()` or the series page — do not render a broken player
- Mobile safe area: `padding-bottom: env(safe-area-inset-bottom)` on the shell wrapper to avoid home indicator overlap

### Episode Switching Mechanics
- URL sync: `window.history.replaceState(null, '', localePath)` — no Next.js re-render, URL stays accurate
- Progress flush: call `forceFlush()` first, then immediately call `loadVideoById(newVideoId)` — saves last position before new video starts
- Resume position on switch: always start at 0 — switching is intentional navigation (resume only applies on page load/refresh)
- Player state during switch: let `loadVideoById()` auto-play; no manual pause before switch

### Claude's Discretion
- Layout.tsx for `(watch)` route group: minimal — just `<html>` structure compatible with `[locale]/layout.tsx`, black bg, no providers
- Lenis exclusion is automatic via route group escape (no `SmoothScroll` provider in `(watch)` layout)
- `data-lenis-prevent` belt-and-suspenders on the watch shell div as defensive measure
- `useProgressTracker` hook reused as-is; `forceFlush` called on episode switch before `loadVideoById`

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `YouTubePlayer` (`src/components/watch/youtube-player.tsx`) — singleton API loader, handles `onReady`/`onStateChange`/`onError`; keep as-is
- `useProgressTracker` (`src/hooks/use-progress-tracker.ts`) — writes every 10s, exposes `forceFlush`; keep as-is
- `AutoplayOverlay` (`src/components/watch/autoplay-overlay.tsx`) — countdown to next episode; keep, may need minor integration adjustment
- `getEpisodeById`, `getEpisodeProgress`, `mapShow`, `mapEpisode`, `mapSeason` from `@/lib/queries` — all reusable in new page.tsx
- `@/i18n/navigation` `Link`/`useRouter` — for locale-aware back navigation

### Established Patterns
- Route groups: `(viewer)/` has Navbar+Footer+Silk; `admin/` has its own layout — `(watch)/` follows the same escape pattern
- CSS fullscreen: `fixed inset-0 h-dvh min-h-svh overflow-hidden bg-black` per STATE.md architecture decisions
- Player stability: `loadVideoById()` not iframe remount — already established as the pattern in STATE.md
- Progress tracking: `useProgressTracker(playerInstance, episode.id, userId)` returns `{ forceFlush }`

### Integration Points
- `src/app/[locale]/(watch)/` — new route group directory to create
- `src/app/[locale]/(watch)/layout.tsx` — bare layout, black bg, no chrome providers
- `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx` — moved from `(viewer)/watch/[episodeId]/page.tsx`
- `src/components/watch/watch-shell.tsx` — new component replacing `WatchPageContent`
- `src/components/watch/watch-page-content.tsx` — DELETE after WatchShell is confirmed working
- `src/app/[locale]/(viewer)/watch/` — DELETE this directory after migration

</code_context>

<specifics>
## Specific Ideas

- STATE.md v2.2 architecture decisions are the authoritative spec for this phase — fullscreen shell CSS, loadVideoById pattern, Lenis exclusion, YouTube ToS (controls=1 always)
- The back link added in Phase 32 is intentionally minimal/unobtrusive — it's a placeholder for Phase 33's full auto-hide chrome layer
- `window.history.replaceState` for URL sync preserves the locale prefix (must construct the full `/en/watch/[id]` or `/ar/watch/[id]` path using current locale)

</specifics>

<deferred>
## Deferred Ideas

- Chrome auto-hide (opacity transitions, idle timer) → Phase 33
- Edge prev/next arrows → Phase 33
- Episode tray (Vaul bottom sheet) → Phase 34
- Ambient glow, PiP, Theater Mode → v2.3
- Swipe-left/right for episode navigation — explicitly excluded (iOS swipe-back collision)

</deferred>
