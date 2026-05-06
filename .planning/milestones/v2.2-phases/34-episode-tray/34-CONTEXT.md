# Phase 34: Episode Tray Context

**Gathered:** 2026-05-06
**Status:** Executed
**Mode:** Autonomous continuation from v2.2 roadmap

## Phase Boundary

Add a persistent bottom episode tray to the fullscreen watch route. The tray must expose a 24px peek handle, snap to half and full heights, browse seasons without navigation, and switch episodes through the existing `loadVideoById()` path.

## Decisions

- Use `vaul` for snap-point drawer behavior.
- Keep the tray mounted as a sibling of the player and chrome, never as a parent of the YouTube iframe.
- Keep the peek handle visible at the bottom at all times.
- Squeeze the player by changing its bottom offset to `24px`, `50dvh`, or `95dvh` as the tray snaps.
- Reuse `handleEpisodeSwitch()` so episode rows preserve the iframe node and progress flush behavior.
- Fetch batch episode progress on the server with `getEpisodesProgress()` and pass it into `WatchShell`.

## Integration Points

- `src/components/watch/episode-tray.tsx`
- `src/components/watch/watch-shell.tsx`
- `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx`
- `src/lib/queries.ts` existing `getEpisodesProgress()`

## Verification Targets

- TypeScript passes.
- Lint either passes or is documented if the known Next ESLint stall recurs.
- Static code confirms `Drawer.Root`, snap points, season tabs, progress bars, and row clicks call `handleEpisodeSwitch`.
