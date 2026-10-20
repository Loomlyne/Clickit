# Phase 6 — YouTube Import and Player: questions for Koss

Phase goal (ROADMAP): an admin puts a whole YouTube season on the platform from one playlist link, or adds one episode from one link. Viewers switching episodes resume where they left off, in a player that follows YouTube's embed rules. Requirements YT-01 to YT-07.

How to answer: reply with the question number and a letter, e.g. `1A 2A 3B …`. "All recommended" is fine. Pictures: `mockups/06-q*.png` (source `mockups/06-mockups.html`, product tokens, LBC font).

Already fixed by the roadmap, not asked again: imports land as drafts; private, deleted, non-embeddable and UAE-blocked videos are flagged and left out; importing twice adds no duplicates; the server checks every video ID; the YouTube key lives only in a Cloudflare Worker secret and the database copy is removed; nothing is drawn over the playing video; player and captions follow the site language; reorder never leaves gaps or duplicates.

---

## A. Playlist import (YT-01, YT-02)

### Q1. Where the import lives and how the preview looks — picture `mockups/06-q1.png`
The admin pastes a playlist link and sees every video before anything is saved.
Example: Issam opens "Sample Show", clicks "Import season from YouTube", pastes the link, sees 24 rows (21 ready, 2 can't play, 1 already on Clickit), presses "Import 21 episodes as drafts".
- **A (recommended).** A side sheet on the show's admin page. One table row per video: tick box, thumbnail, title, length, status. Rows that can't play are unticked and greyed with the reason.
- **B.** A separate "Import from YouTube" page in the admin menu, with a card grid; pick the show and season there.

Answer:

### Q2. Which season the videos go into
Example: the playlist "Sample Show — Season 3".
- **A (recommended).** The admin picks: a new season (default, title taken from the playlist name, editable) or an existing season, where the new videos are added after its last episode.
- **B.** Always a new season. To add to an existing season, use the single-link add.

Answer:

### Q3. Episode order and numbers
Example: the playlist order is 1, 2, 3 but the titles say "Ep 3, Ep 1, Ep 2".
- **A (recommended).** Follow the playlist order. Numbers continue after the season's last episode (an empty new season starts at 1). The admin can reorder afterwards.
- **B.** Read the number from the video title ("Episode 7", "الحلقة ٧") and fall back to playlist order when no number is found.

Answer:

### Q4. Titles and descriptions: which language field gets the YouTube text
Most Clickit videos have Arabic titles; the site needs an English and an Arabic title.
Example: the YouTube title is "الحلقة ٢ — عنوان".
- **A (recommended).** Text goes into the field of its own script: Arabic text → Arabic title and description; English text → English. The English title is required, so until someone writes it, it holds the same text and the draft shows a "Needs English title" mark. No machine translation.
- **B.** Copy the YouTube text into both the English and the Arabic fields; the admin fixes whichever is wrong.
- **C.** English fields only; the Arabic fields stay empty.

Answer:

### Q5. Importing the same playlist again later
Example: Season 3 had 10 videos; two weeks later the playlist has 12.
- **A (recommended).** Only the 2 new videos are offered, as drafts. Episodes already on Clickit are not touched (admin edits stay). A video removed from the playlist stays on Clickit.
- **B.** Same as A, and the titles, descriptions and lengths of existing episodes are refreshed from YouTube (this overwrites admin edits).

Answer:

### Q6. YouTube visibility for episodes that are not out yet
A private YouTube video cannot play on any other site. An unlisted one can, and it does not appear on the YouTube channel.
Example: Nejib uploads Episode 8 for next Friday.
- **A (recommended).** Upload as **Unlisted**. Clickit's own scheduler decides when viewers see it. Private videos are refused with "Set it to Unlisted or Public, then import again".
- **B.** Upload as **Public**. Viewers on YouTube may see it before Clickit publishes it.

Answer:

### Q7. Right after an import
Example: 21 drafts were just created.
- **A (recommended).** The success message has a "Schedule these 21 episodes" button that opens the existing bulk scheduler (broadcast days, Dubai time) with them selected.
- **B.** Only a success message; the admin opens the scheduler themselves.

Answer:

---

## B. Player (YT-05, YT-06)

### Q8. Watch page layout — picture `mockups/06-q8.png`
YouTube's rule: no overlays or other elements on top of any part of an embedded player while it is visible. Today the top bar, the prev/next arrows, the episode tray (raised on hover) and the "next episode" card all sit on top of the video (red boxes in the picture).
- **A (recommended).** Stacked: a solid bar above the video, the video (16:9, black bars when the screen is wider), a control bar under it (previous, title, next, "Start from the beginning"), episodes under that. The same order on phones.
- **B.** Desktop: video on the left, episode list on the right (like YouTube's watch page). Phones: same as A.

Answer:

### Q9. "Next episode" when an episode ends — picture `mockups/06-q9.png`
- **A (recommended).** When the video ends, the player is replaced by a Clickit "Up next" card with the 8-second countdown, "Play now" and "Cancel". The video is gone, so nothing covers it, and YouTube's own end screen is never shown.
- **B.** The ended video stays (YouTube's end screen shows) and the countdown sits in the bar under the video.
- **C.** No countdown; only the "Next episode" button.

Answer:

### Q10. Resume when switching episodes
Example: you watch 9 minutes of Episode 3, switch to Episode 4, then come back to Episode 3.
- **A (recommended).** It starts by itself at 9:12. The bar under the video shows "Resumed at 9:12 · Start from the beginning". An episode finished (95% or more) starts at 0:00.
- **B.** Before playing, ask "Resume at 9:12 or start over?" every time.

Answer:

### Q11. When a video can't play — picture `mockups/06-q11.png`
Example: the video was removed from YouTube or is blocked in the UAE.
- **A (recommended).** A branded Clickit card replaces the player: "This episode can't play right now", the reason in plain words, "Play next episode" and "Back to the show". The episode is flagged for the admins (see Q17).
- **B.** Keep today's grey box with one line of text.

Answer:

### Q12. Captions
The player's menus already follow the site language. This is only about whether captions start switched on.
- **A (recommended).** English site: English captions on when the video has them. Arabic site: captions follow the viewer's own YouTube setting.
- **B.** Never switch captions on; always the viewer's YouTube setting.
- **C.** Always on, in the site language when available.

Answer:

---

## C. Admin episode order (YT-07)

### Q13. How admins reorder episodes — picture `mockups/06-q13.png`
- **A (recommended).** Keep the up/down arrows, saved on each click, made safe (see Q14 and Q19).
- **B.** Drag rows into place, then press "Save order" once.

Answer:

### Q14. Gaps in episode numbers
Today, after Episode 3 is archived, moving Episode 4 up fails with "No adjacent episode", because the season has 1, 2, 4.
- **A (recommended).** Moving up or down swaps with the nearest episode, whatever its number. Archiving or deleting does not renumber, so viewers' episode numbers stay stable. A "Renumber 1 to N" button closes gaps on purpose, with a confirm and an audit row.
- **B.** Close gaps automatically every time an episode is archived or deleted (Episode 4 becomes Episode 3).

Answer:

---

## D. YouTube key and checks (YT-04)

### Q15. The YouTube key field in Admin › Settings — picture `mockups/06-q15.png`
The key moves to a Cloudflare Worker secret that only you set, in your terminal.
- **A (recommended).** The field becomes a read-only status: "Key set / Key missing", "Stored in Cloudflare", and a "Test key" button that makes one real call (1 unit of the 10,000 free daily units).
- **B.** Remove the row; a missing key shows up only as an error when someone imports.

Answer:

### Q16. Which Google account owns the new key
The old key was stored in the database and is treated as leaked; you will create a new key restricted to "YouTube Data API v3" and delete the old one.
- **A (recommended).** The Clickit Google account (the one that owns the YouTube channel), in a Google Cloud project named "clickit-story".
- **B.** Your own Google account.
- **C.** Another account — name it.

Answer:

### Q17. Daily check of stored videos
YouTube's developer policies say stored API data (titles, lengths) must be refreshed or deleted within 30 days, and that you must check stored videos still exist. A video can also turn private or blocked after it is published.
Example: Episode 6 was made private on YouTube last night.
- **A (recommended).** A daily Cloudflare cron (one call per 50 episodes, about 6 units a day for ~300 episodes) refreshes each episode's YouTube status and length, and marks broken episodes with a red "Can't play" badge in the admin and a count on the dashboard. Viewer error reports (Q11) feed the same badge. Nothing is unpublished automatically.
- **B.** Same check, and broken episodes are hidden from viewers until fixed.
- **C.** No check in Phase 6 (does not meet the 30-day rule).

Answer:

---

## E. Two technical calls that need your OK

### Q18. Jev in the import preview
Jev (TypeSafe) could read each video's title and pre-untick rows that look like a trailer, teaser or short rather than an episode, showing its confidence; the admin can tick them back.
- **A (recommended).** Not in Phase 6. Statuses come from YouTube itself; Clickit playlists are made by the two admins. Noted as a later idea.
- **B.** Add it to Phase 6 (advisory only, logged with its confidence).

Answer:

### Q19. One database function for reorder and renumber
Phase 1.1 makes admin writes safe with app-side undo and no migration. Swapping two episode numbers takes three writes; a database function does it as one all-or-nothing step. Phase 6 already needs a live migration (dropping the old key column, adding the YouTube status columns), which you approve first.
- **A (recommended).** Yes: one small `reorder_episodes` / `renumber_season` function in the same reviewed migration.
- **B.** No migration for this; use Phase 1.1's app-side undo.

Answer:

---

## Decided by Claude unless you object (no answer needed)

- Thumbnails stay on YouTube's image server (`i.ytimg.com`, not resized by Cloudflare), with a fallback from the largest size down; not copied to R2.
- A video already anywhere on Clickit (any show, any season) counts as "already on Clickit" and is not imported twice.
- The import reads playlists past 50 videos (page by page) and asks YouTube about 50 videos per call: a 50-video season costs about 2 of the 10,000 free daily units. `search` (100 units a call) is never used.
- The playlist itself must be Public or Unlisted (a private playlist cannot be read with a key); the sheet says so when it fails.
- "Blocked in UAE" means YouTube's region rules exclude `AE`. Upcoming premieres and unprocessed uploads are shown as "Not ready" and left out.
- Every import and single add leaves an audit row naming the admin, the playlist and the episode count (uses Phase 5's two-admin audit).
- The single-link add keeps today's episode form. Paste a link and the title, description and length fill in; saving re-checks the video on the server and refuses a fake, private, removed or non-embeddable ID with a plain message.
- Player keeps the `strict-origin-when-cross-origin` referrer (otherwise YouTube shows error 153), one playing YouTube player per page, and the player at least 200×200.
- Built against main as it will be after Phases 2–5: Cloudflare Workers via OpenNext, R2 media, `requireAdmin`.

## Your owner steps later in this phase (no answer now)

1. Create the restricted key in Google Cloud (account from Q16) and set it as the Worker secret in your terminal.
2. Delete the old key in Google Cloud.
3. Approve the migration that removes the database copy of the key.
4. UAT, then Ship.
