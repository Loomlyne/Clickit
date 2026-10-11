# Admin Actions Hardening: signed by Koss 2026-10-11, now Phase 1.1 in ROADMAP.md

Source: two read-only agent audits of `src/app/[locale]/admin/actions.ts` (all 66 exported actions, 2026-10-11). 50 issues confirmed after skeptic pass (2 high, 19 medium, 29 low), 15 refuted in run 2 (13) and run 1 (2). No action lacks an admin guard; the defects are validation, atomicity, audit logging and destructive-delete guards. Line numbers are from `main` at 5bbe685 and will drift.

## Proposed placement
Phase 1.1 (INSERTED, after Phase 1 Safe Ground). Code reaches production only after the Phase 3 cutover, so this is safe to build first and avoids porting the bugs into the Worker.

## Goal
Every admin server action validates its input with a schema, scopes ids to their parent, leaves an audit row for each destructive or renumbering write, and fails whole or not at all.

## Plans (proposed)
1. **Restore and conflict flows (2 high).** Zod-parse `fixes` (int, positive); `.eq('show_id', showId)` on every renumber; audit rows; validate title/slug; `fillArabic` on rename; `restoreShow` requires `archived=true`; check error returns in `archiveShow`/`restoreShow`.
2. **Input validation everywhere.** Schemas for `updateSeason`, `updateEpisode`; uuid checks on every `id`; runtime enums for `direction` and hero `variant`; take `showId` from the DB row, not the client (`archiveEpisode`, `deleteSeason`); season must belong to show in `createEpisode`; `reorderCategories` array check.
3. **Destructive guards and audit.** `deleteShowPermanently` and `deleteEpisodePermanently` require archived; audit rows for `deleteSeason`, `updateSeason`; write the audit row before the irreversible delete; confirm step for `removeHeroVideo`.
4. **Atomicity and counts.** No half-applied writes in `updateShow` categories sync, `createShow`, reorder swaps, `applyShowSchedule`, `reorderEpisode`; check every ignored update error; season/show counts exclude archived; cache tags invalidated after archive. Needs [OWNER] if solved with a Postgres function (live migration).
5. **Media and content safety.** Replace the regex SVG sanitizer; server-side hero video size and MIME sniff; stop saving untranslated English into `_ar` fields (`updateTopTicker`, shared translate helper); stop `saveHeroVideoUpload` resetting the muted flag.
Each plan ships with unit tests for the failing input first (the repo already has `test:unit`).

## Decisions (made by Claude on Koss's delegation, 2026-10-11; he can overturn at the discuss gate)
1. **Placement: Phase 1.1.** Fixes land before the Worker cutover, so nothing is ported twice.
2. **SVG: stop accepting new SVG uploads; PNG/WebP/AVIF only.** A regex blacklist cannot be made safe, and a DOM-based sanitizer is awkward on Workers. Already-stored SVGs stay as they are. Cost: social icons must be PNG/WebP from now on. Revisit only if he needs SVG.
3. **Permanent delete requires archived first.** Matches the existing archive flow and removes the one-click irreversible path.
4. **Atomicity: app-level ordering and compensation, no migration.** Keeps the phase off the live database. Postgres functions stay an option for Phase 8 if a gap remains.

## Owner-gated
Deploy and Ship (no migration with decision 4). Nothing here touches live data.

## Appendix: confirmed findings (severity, kind, action, line)

- **high** missing-validation `resolveConflictsAndRestore` L798: fixes input is not validated. newEpisodeNumber can be negative, zero, fractional or NaN (episodeSchema requires int().positive()). episodeId is not scoped to showId, so any episode of any show can have its episode_number rewritten.

- **high** missing-validation `resolveRestoreConflictsAndRestore` L879: episodeFixes and data.title/slug are unvalidated. newEpisodeNumber has no int/positive check, and episodeId is not scoped to showId, so episodes of other shows can be renumbered. title has no max length and no schema.

- **medium** data-loss `updateShow` L536: syncShowCategories (delete all rows, then insert) is not atomic. If the insert fails, the show keeps its updated fields but loses all its categories, and the user sees an error. The show update at 527 is already committed and not audited in that case.

- **medium** data-loss `archiveShow` L568: Archiving overwrites the show's slug with archived-<id8> and nothing stores the original. On restore, _restoreShow sees the archive placeholder and regenerates the slug from the title, so a custom or SEO slug (and its public URL) is permanently lost after an archive/restore cycle. The archive audit row does not record the old slug either.

- **medium** bug `archiveShow` L574: The episode-archive result is ignored. If it fails, the show is archived and success is returned while its episodes stay live. The show update is also not checked for a matching row: an unknown or invalid id succeeds silently and still writes an audit entry.

- **medium** data-loss `restoreShow` L757: Restore un-archives every episode of the show (and archiveShow at 574 archives every episode). Episodes that were individually archived before the show was archived come back as visible after restore. The conflict check at 688-692 only covers archived episodes, so this is deliberate, but there is no record of which episodes were archived by the show archive. The update error is also ignored, so the show can be restored with episodes still archived and success returned. restoreShow also never checks that the show is currently archived.

- **medium** data-loss `resolveConflictsAndRestore` L793: No audit log at all, although the action mutates episode numbers and then restores the show and all its episodes. restoreShow logs a 'restore'; this path does not. The assertAdmin() return value is discarded.

- **medium** bug `resolveRestoreConflictsAndRestore` L869: Title/slug and episode-number edits are written before the restore. If _restoreShow fails, they persist. The audit row is only written on success and only says 'restore', so the title/slug rename and renumbering are not recorded. Failed attempts leave unaudited changes.

- **medium** bug `deleteShowPermanently` L917: Permanent delete does not require the show to be archived, so an active live show with all seasons and episodes can be hard-deleted in one call. id is not validated as a uuid. The show lookup error is ignored, so a nonexistent id still deletes (a no-op) and writes a 'delete' audit row with undefined title and slug.

- **medium** missing-validation `updateSeason` L1216: The `data` argument is never parsed with seasonSchema or any schema. The raw client object goes straight into `.update(data)`. A caller can change any column (show_id, id, season_number, title to an empty string, or other columns). Moving a season to another show would leave both shows' season_count and episode_count stale. The type is only a compile-time annotation and does nothing at runtime. The id is also unchecked.

- **medium** missing-validation `deleteSeason` L1244: `id` and `showId` are not validated (no uuid check). `showId` comes from the client and is not checked against the deleted season's real show_id. The season is deleted without first reading it. If a caller passes a mismatched showId, the season_count and episode_count recomputation and the revalidation hit the wrong show. The real show keeps stale counts. A nonexistent id also returns success.

- **medium** data-loss `deleteSeason` L1248: This is a destructive hard delete that cascades to all episodes, and it writes no audit log. deleteCategory (L1104) and createCategory (L1033) both call logAudit, so this is inconsistent. The delete also keeps no record of which season or episodes were removed.

- **medium** missing-validation `updateEpisode` L1394: Payload is never run through episodeSchema (or a .partial() of it). The client-supplied object goes straight into .update(data), so any column can be written (archived, show_id, season_id, id, counters). Also skips status enum, publish_at datetime, uuid and positive-int checks that createEpisode enforces.

- **medium** data-loss `deleteEpisodePermanently` L1564: The permanent delete does not require the episode to be archived, so any episode, including a published one, can be hard-deleted in one call. A missing episode is not handled: the delete runs anyway and reports success. The delete cascades to watch progress and likes, and the audit log is written only after the delete. The season episode_count is not updated.

- **medium** data-loss `reorderEpisode` L1650: The three-step swap is not atomic and the error from every update is ignored. If step 2 or 3 fails, the episode is left at the temporary episode_number -1 or two episodes end up with inconsistent numbers, and the action still returns success. The -1 value may also violate a positive-number constraint (the schema requires positive).

- **medium** data-loss `applyShowSchedule` L1812: The schedule is applied as one UPDATE per episode in a loop with no transaction and no rollback. If any update fails, the function returns at once. Earlier episodes stay coming-soon with a publish_at, the rest stay unscheduled, and no audit entry is written for the partial change. The admin sees a generic error and the show is left half-scheduled.

- **medium** data-loss `unscheduleShowEpisodes` L1857: This bulk reset hits every coming-soon episode of the show that has a publish_at, not only those the bulk scheduler created. Episodes an admin scheduled by hand via the episode form are also reverted to draft and lose their publish_at. The audit entry stores only a count, not the episode ids or the old publish_at values, so the change cannot be undone or traced.

- **medium** missing-validation `createHeroVideoUpload` L2120: The 50MB limit is checked only against the client-supplied file.size metadata. The signed upload URL does not enforce a size, and saveHeroVideoUpload never checks the size of the downloaded object. A caller can declare a small size and upload a much larger file to the public site-assets bucket. saveHeroVideoUpload then loads it fully into memory with arrayBuffer().

- **medium** other `removeHeroVideo` L2314: Removing the hero video permanently deletes the stored MP4 from Supabase storage and R2 and clears the site config. No logAudit call is made. setHeroVideoUrl (which can also delete the previous uploaded file) and saveHeroVideoUpload (which deletes the previous file) are also unaudited. Other destructive actions in the file call logAudit. The role guard is only assertAdmin, which is the sole role helper in the file, so there is no staff/admin split to check.

- **medium** bug `updateTopTicker` L3302: The Arabic auto-fill never fails: translateBatchToArabic returns the original English strings when GOOGLE_TRANSLATE_API_KEY is missing, the HTTP call is not ok, or fetch throws. The result is written into the _ar slot because `tr?.trim()` is truthy, so English text is saved in tag_ar/text_ar/tag2_ar. Once saved, the field is no longer blank, so later saves will not translate it. Arabic visitors see English in the ticker, and the admin gets no signal.

- **medium** bug `uploadSiteImage / uploadSocialIcon` L3340: sanitizeSvgUpload is a regex blacklist and is easy to bypass. The file lands in the public site-assets bucket and is served as image/svg+xml, so a bypass is stored XSS on the public media origin. The event-handler regexes require whitespace before 'on' (\son\w+), so '<svg/onload=...>' passes. No other active content is stripped: <iframe>, <embed>, <animate>/<set> targeting href, data: URLs, and entity-encoded 'javascript:'. Only href values that start with 'javascript:' are removed. Only admins can upload, so exposure is limited to a compromised or careless admin session. Nothing sanitizes the stored file beyond this function.

- **low** bug `createShow` L439: sort_order is computed by reading the current max and adding 1, then inserted in a separate statement. Two concurrent creates (double click, or two admins) read the same max and get the same sort_order. Equal values make reorderShow's swap a no-op for that pair.

- **low** bug `createShow` L450: Partial failure: the show row is inserted before categories are synced. If syncShowCategories throws (for example an invalid category id), the catch returns failure but the show already exists with no audit row. A retry then fails the active title/slug conflict check.

- **low** bug `updateShow` L527: id is not validated and the show is not checked for being archived. Editing an archived show can set a real slug and status on it, bypassing the archive state. A nonexistent id surfaces only as a PostgREST 'no rows' error message.

- **low** bug `updateShow` L536: If syncShowCategories throws after the show row was already updated, the catch returns an error without calling bumpCatalogCache or revalidatePath. The public catalog and cache tags stay stale, even though the show fields were committed. createShow has the same gap at line 450, where the new show exists but the cache is not invalidated.

- **low** missing-validation `reorderShow` L598: direction is only typed, not checked at runtime. Server actions accept arbitrary client input, and swapByDirection treats any value other than 'up' as 'down', so an invalid or missing direction silently moves the show down and writes an audit row recording that bogus direction.

- **low** bug `reorderShow` L616: The swap is two non-atomic updates. A failure on one leaves two shows with the same sort_order, after which the swap does nothing. restoreShow does not reassign sort_order, so a restored show can share a value with an active one and then cannot be moved. id is not validated.

- **low** data-loss `resolveConflictsAndRestore` L816: Partial failure: episode numbers are committed first. If _restoreShow then fails (title/slug conflict, new episode conflicts), the renumbering stays applied and no audit row records it. Promise.all also leaves a mix of applied and failed fixes when one update errors.

- **low** bug `resolveRestoreConflictsAndRestore` L869: When the admin renames the show during restore, only the English title and slug are written. fillArabic is not run, unlike createShow and updateShow, so title_ar keeps the old title's translation and the Arabic site shows the stale name. If the title is blank the check only fires after the slug was already derived from it.

- **low** bug `updateCategory` L1058: categorySchema gives sort_order `.default(0)`. If the caller omits sort_order on an edit, parsed.sort_order becomes 0 and is written, which silently resets the category's position. The `id` is also not validated as a uuid.

- **low** bug `deleteCategory` L1094: The pre-delete lookup ignores its error and the delete result is not checked for a matching row. Deleting a nonexistent or already-deleted id returns success, writes a delete audit entry with undefined name and slug, and bumps the caches. The delete also cascades silently to the show_categories join rows if the FK cascades, with no record of which shows lost the category. This second part depends on the schema, which was not read.

- **low** bug `reorderCategories` L1130: The input array is not validated (no uuid or array check, no dedupe). The updates run as parallel independent statements with no transaction. If one fails, the others have already committed and the order is left partially applied. The action returns an error without rolling back. The audit log is only written on full success.

- **low** bug `createSeason` L1186: After the insert, the season_count update error is ignored, so the action reports success even when the show count is stale. No audit log is written for the create, unlike createCategory.

- **low** other `updateSeason` L1208: No audit log is written for the season update. The destructive actions in this range (deleteCategory) are audited, and the other category actions are audited, but the season actions are not.

- **low** bug `updateSeason` L1212: The Arabic auto-fill triggers whenever `data.title` is set and `data.title_ar` is missing or blank. A partial update that sends only a new English title (the type is Partial) never sends title_ar, so the existing Arabic title is overwritten with a machine translation. A deliberate clear of the Arabic field is also overwritten. The code also mutates the caller's `data` object.

- **low** bug `deleteSeason` L1258: The delete succeeds, but the follow-up season_count and episode_count updates ignore their errors. If either fails, the action still returns success with stale counts on shows. The delete and the count recompute are not atomic.

- **low** missing-validation `createEpisode` L1296: show_id and season_id are validated only as UUIDs. There is no check that the season belongs to the given show, so an episode can be inserted with a mismatched show_id and season_id, and the wrong show's episode_count is updated. youtube_video_id is also unvalidated (any string).

- **low** bug `createEpisode` L1322: Result of the archived-episode bump update is ignored, and the bump happens before the later conflict check and insert. If the bump fails, the insert fails on the unique constraint with no cleanup. If the insert fails afterward for any other reason, the archived episode stays renumbered.

- **low** bug `createEpisode` L1361: Season and show episode_count are computed from all episodes, including archived ones. archiveEpisode, restoreEpisode and deleteEpisodePermanently compute the show count with archived=false, so the show's count is inconsistent depending on which action ran last. Errors from the count/update calls are also ignored.

- **low** bug `updateEpisode` L1411: Episode-number collision pre-check always uses the episode's current season_id, ignoring data.season_id. If season_id is changed in the same call, the check runs against the wrong season. Season/show episode_count are also not recomputed after an update that moves an episode.

- **low** bug `updateEpisode` L1419: The episode-number pre-check has no archived filter, so it also matches archived episodes. createEpisode bumps an archived episode out of the way in the same situation (lines 1303-1326), but updateEpisode does not. Changing an episode to a number held by an archived episode is rejected with 'already exists in this season', although the admin cannot see that episode. The two actions are inconsistent.

- **low** bug `archiveEpisode` L1468: showId is taken from the client instead of read from the episode row. A wrong showId recomputes and writes the wrong show's episode_count, and the real show is left stale. id and showId are not validated as UUIDs. The season episode_count is not updated. There is no 'not found' handling or audit log for the archive.

- **low** bug `archiveEpisode` L1495: archiveEpisode rewrites shows.episode_count but never invalidates the 'shows' cache tag or /watch. restoreEpisode and deleteEpisodePermanently call bumpCatalogCache() for this reason. createEpisode (lines 1382-1383) has the same gap. The public catalog can show a stale episode count after an archive or create.

- **low** bug `restoreEpisode` L1507: The season's episode_count is not recomputed after restore, although createEpisode maintains it. id is not validated as a UUID. Otherwise this action is fine: it has a guard, a not-found check, a count update and an audit log.

- **low** bug `deleteEpisodePermanently` L1593: The audit log write happens after the irreversible delete and sits inside the same try block. If logAudit throws, the action returns success: false with an error even though the row is already deleted. The cache is not revalidated, so the UI is left stale and the admin is told the delete failed.

- **low** bug `reorderEpisode` L1639: The adjacent-episode lookup does not filter archived rows. An archived neighbor can be swapped with a visible episode, so the visible order does not change as expected. Archived episodes keep their numbers because of the unique constraint. direction and episodeId are not validated at runtime (any value other than 'up' is treated as 'down').

- **low** bug `applyShowSchedule` L1816: The plan is computed from a read, then each episode is updated by id only. The update has no guard on current status, show_id or archived. If an episode is published or archived between planning and the update (cron publish-scheduled, or an admin editing in another tab), it is overwritten back to coming-soon with a new publish_at. A live episode can then be taken off air or re-queued. The window is small, but the update is not conditional.

- **low** missing-validation `uploadArtwork` L1975: The MIME check trusts the client-declared file.type. When the declared type already equals the target type (image/webp for non-logo slots, image/png for logo), the bytes are uploaded to the public show-artwork bucket as-is with no content sniffing or sharp decode. A non-image file declared as image/webp is stored and served publicly. The 10MB size check also runs only after the whole FormData is parsed.

- **low** missing-validation `createHeroVideoUpload` L2109: variant is typed only in TypeScript and is not checked at runtime in any of the four hero actions. An invalid value gives HERO_VIDEO_PREFIX[variant] === undefined. createHeroVideoUpload then issues a signed upload URL for the path 'undefined-<ts>.mp4'. In getHeroVideoConfig any non-'desktop' value is read as the mobile variant. removeHeroVideo and setHeroVideoUrl stage deletion of the mobile file before updateHeroVideoConfig fails on the undefined column and rolls back.

- **low** bug `saveHeroVideoUpload` L2196: Saving either the desktop or the mobile video unconditionally sets the shared hero_video_muted flag to false. Uploading a mobile video therefore silently changes the muted setting for the desktop hero.
