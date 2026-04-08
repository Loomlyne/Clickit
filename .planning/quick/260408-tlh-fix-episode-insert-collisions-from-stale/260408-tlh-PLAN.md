---
phase: quick
plan: 260408-tlh
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/admin/shows/[id]/page.tsx
  - src/components/admin/season-tabs.tsx
  - src/components/admin/episodes-table.tsx
  - src/app/admin/actions.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "New episode defaults to max(episode_number) + 1 across ALL episodes in the season (including archived), not visible count + 1"
    - "Creating an episode with a duplicate (season_id, episode_number) returns a clear admin-facing error, not a raw Postgres constraint message"
    - "Editing an episode to an already-used number in the same season returns the same friendly error"
    - "Table UI still hides archived episodes -- no visible behavior change"
  artifacts:
    - path: "src/app/admin/shows/[id]/page.tsx"
      provides: "Separate query for max episode numbers per season"
    - path: "src/components/admin/season-tabs.tsx"
      provides: "Correct nextEpisodeNumber from precomputed max map"
    - path: "src/components/admin/episodes-table.tsx"
      provides: "Correct nextEpisodeNumber from prop instead of episodes.length"
    - path: "src/app/admin/actions.ts"
      provides: "Duplicate detection in createEpisode and updateEpisode with friendly error"
  key_links:
    - from: "src/app/admin/shows/[id]/page.tsx"
      to: "src/components/admin/season-tabs.tsx"
      via: "maxEpisodeNumberBySeason prop"
      pattern: "maxEpisodeNumberBySeason"
    - from: "src/components/admin/season-tabs.tsx"
      to: "src/components/admin/episodes-table.tsx"
      via: "nextEpisodeNumber prop"
      pattern: "nextEpisodeNumber"
---

<objective>
Fix episode insert collisions caused by stale nextEpisodeNumber computation.

Purpose: The admin "Add Episode" form defaults episode_number to `visible_episodes.length + 1`, but the DB uniqueness constraint is `unique(season_id, episode_number)`. Archived episodes or numbering gaps cause the suggested number to collide with an existing row, surfacing a raw Postgres constraint error. Fix the default to `max(episode_number) + 1` across ALL episodes (including archived) and add server-side duplicate detection with a friendly error message.

Output: Correct default episode numbering and hardened server actions with clear validation messages.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/app/admin/shows/[id]/page.tsx
@src/components/admin/season-tabs.tsx
@src/components/admin/episodes-table.tsx
@src/app/admin/actions.ts
@src/lib/database.types.ts

<interfaces>
<!-- Key types and contracts the executor needs -->

From src/components/admin/season-tabs.tsx:
```typescript
interface SeasonTabsProps {
  seasons: Season[]
  episodesBySeason: Record<string, Episode[]>
  showId: string
}
```

From src/components/admin/episodes-table.tsx:
```typescript
interface EpisodesTableProps {
  episodes: Episode[]
  showId: string
  seasonId: string
}
```

From src/components/admin/episode-form-drawer.tsx:
```typescript
interface EpisodeFormDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  episode?: Database['public']['Tables']['episodes']['Row'] | null
  showId: string
  seasonId: string
  nextEpisodeNumber: number
  onSave: (data: EpisodeFormData) => Promise<{ success: boolean; error?: string }>
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Compute correct nextEpisodeNumber from max(episode_number) per season</name>
  <files>src/app/admin/shows/[id]/page.tsx, src/components/admin/season-tabs.tsx, src/components/admin/episodes-table.tsx</files>
  <action>
**In `src/app/admin/shows/[id]/page.tsx`:**
1. Add a SECOND query that fetches ALL episodes for this show (without the `archived = false` filter), selecting only `season_id` and `episode_number` columns. This is lightweight -- just two small columns for numbering purposes.
2. Compute a `maxEpisodeNumberBySeason: Record<string, number>` by iterating all episodes and tracking the max `episode_number` per `season_id`.
3. Pass `maxEpisodeNumberBySeason` as a new prop to `<SeasonTabs>`.
4. Keep the existing `episodes` query with `archived = false` unchanged -- the table still shows only visible episodes.

**In `src/components/admin/season-tabs.tsx`:**
1. Add `maxEpisodeNumberBySeason: Record<string, number>` to the `SeasonTabsProps` interface.
2. On line 189, change `nextEpisodeNumber` from:
   `(episodesBySeason[activeSeasonIdForEpisode]?.length ?? 0) + 1`
   to:
   `(maxEpisodeNumberBySeason[activeSeasonIdForEpisode] ?? 0) + 1`
3. Pass `nextEpisodeNumber={(maxEpisodeNumberBySeason[season.id] ?? 0) + 1}` to the `<EpisodesTable>` component on line 152-157.

**In `src/components/admin/episodes-table.tsx`:**
1. Add `nextEpisodeNumber: number` to the `EpisodesTableProps` interface.
2. On line 193, change the `EpisodeFormDrawer`'s `nextEpisodeNumber` from `episodes.length + 1` to the new `nextEpisodeNumber` prop.
  </action>
  <verify>
    <automated>cd /Users/koss/Desktop/Develop/Clickit && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
- New episode defaults to max(episode_number) + 1 from ALL episodes (including archived) in the season
- Season with episodes 1,2,4 defaults to 5 (not 3 or 4)
- Season with visible 1,2,3 and archived 4 defaults to 5
- Empty season defaults to 1
- Table still only shows non-archived episodes (no UI change)
  </done>
</task>

<task type="auto">
  <name>Task 2: Harden createEpisode and updateEpisode with duplicate detection</name>
  <files>src/app/admin/actions.ts</files>
  <action>
**In `createEpisode` (around line 331):**
1. After Zod parsing and before the `.insert()` call, add a pre-check query:
   ```
   const { data: existing } = await admin
     .from('episodes')
     .select('id')
     .eq('season_id', parsed.season_id)
     .eq('episode_number', parsed.episode_number)
     .maybeSingle()
   ```
2. If `existing` is not null, return early with:
   `{ success: false, error: 'Episode number ${parsed.episode_number} already exists in this season. Choose a different number.' }`
3. Additionally, in the existing `if (error)` check after the insert (line 345), add a fallback check for Postgres unique violation code `23505`:
   ```
   if (error) {
     if (error.code === '23505') {
       return { success: false, error: `Episode number ${parsed.episode_number} already exists in this season. Choose a different number.` }
     }
     return { success: false, error: error.message }
   }
   ```

**In `updateEpisode` (around line 376):**
1. Before the `.update()` call, check if `data.episode_number` is defined. If so, fetch the current episode to get its `season_id`:
   ```
   if (data.episode_number !== undefined) {
     const { data: current } = await admin
       .from('episodes')
       .select('season_id')
       .eq('id', id)
       .single()
     if (current) {
       const { data: existing } = await admin
         .from('episodes')
         .select('id')
         .eq('season_id', current.season_id)
         .eq('episode_number', data.episode_number)
         .neq('id', id)
         .maybeSingle()
       if (existing) {
         return { success: false, error: `Episode number ${data.episode_number} already exists in this season. Choose a different number.` }
       }
     }
   }
   ```
2. In the existing `if (error)` check after the update (line 389), add the same `23505` fallback:
   ```
   if (error) {
     if (error.code === '23505') {
       return { success: false, error: 'This episode number already exists in this season. Choose a different number.' }
     }
     return { success: false, error: error.message }
   }
   ```
  </action>
  <verify>
    <automated>cd /Users/koss/Desktop/Develop/Clickit && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
- createEpisode detects duplicate (season_id, episode_number) before insert and returns a clear error string
- updateEpisode detects duplicate when changing episode_number and returns a clear error string
- Any remaining 23505 unique violation from Postgres is caught and mapped to the same friendly message
- Cross-season duplicates (same episode_number in different seasons) still succeed
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors
2. The admin show detail page loads correctly with seasons and episodes
3. "Add Episode" drawer defaults to max(episode_number)+1, not visible count+1
4. Attempting to create an episode with a duplicate number shows a clear toast error
5. Editing an episode number to a collision shows a clear toast error
</verification>

<success_criteria>
- TypeScript compiles cleanly
- Episode numbering defaults are safe against archived episodes and gaps
- Duplicate episode numbers produce readable admin-facing errors, not raw constraint messages
- No visible UI change to the episodes table (archived episodes remain hidden)
</success_criteria>

<output>
After completion, create `.planning/quick/260408-tlh-fix-episode-insert-collisions-from-stale/260408-tlh-SUMMARY.md`
</output>
