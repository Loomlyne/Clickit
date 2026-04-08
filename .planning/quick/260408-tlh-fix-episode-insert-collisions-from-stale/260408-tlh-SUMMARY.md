# Quick Task 260408-tlh: Fix episode insert collisions from stale nextEpisodeNumber

**Completed:** 2026-04-08

## What Changed

### Task 1: Correct nextEpisodeNumber computation (already implemented)
The admin show detail page, SeasonTabs, and EpisodesTable already compute `nextEpisodeNumber` from `max(episode_number)` across ALL episodes (including archived) per season. No changes needed.

### Task 2: Harden server actions with duplicate detection
- **createEpisode**: Added pre-check for visible (non-archived) duplicate `(season_id, episode_number)` before insert. Returns `"Episode number X already exists in this season. Choose a different number."` instead of raw constraint error. Added `23505` unique-violation fallback after insert.
- **updateEpisode**: Added pre-check when `episode_number` changes — fetches current episode's `season_id`, checks for existing episode with same number (excluding self). Returns same friendly error. Added `23505` fallback after update.

## Files Modified
- `src/app/admin/actions.ts` — duplicate detection in createEpisode + updateEpisode

## Verification
- `tsc --noEmit` passes cleanly (no type errors)
