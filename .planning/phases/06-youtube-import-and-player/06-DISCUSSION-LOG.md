# Phase 6: YouTube Import and Player - Discussion Log
> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.
**Date:** 2026-10-20
**Phase:** 06-youtube-import-and-player
**Mode:** batched questions file relayed by the controller (work session; no question form)
**Answer:** Koss, "signed continue" → recommended option (A) on all 19 questions.

---
## Q1. Where the import lives and how the preview looks — picture `mockups/06-q1.png`

| Option | Description | Selected |
|---|---|---|
| A | A side sheet on the show's admin page. One table row per video: tick box, thumbnail, title, length, status. Rows that can't play are unticked and greyed with the reason. | ✓ |
| B | A separate "Import from YouTube" page in the admin menu, with a card grid; pick the show and season there. |  |

**User's choice:** A (recommended)

---
## Q2. Which season the videos go into

| Option | Description | Selected |
|---|---|---|
| A | The admin picks: a new season (default, title taken from the playlist name, editable) or an existing season, where the new videos are added after its last episode. | ✓ |
| B | Always a new season. To add to an existing season, use the single-link add. |  |

**User's choice:** A (recommended)

---
## Q3. Episode order and numbers

| Option | Description | Selected |
|---|---|---|
| A | Follow the playlist order. Numbers continue after the season's last episode (an empty new season starts at 1). The admin can reorder afterwards. | ✓ |
| B | Read the number from the video title ("Episode 7", "الحلقة ٧") and fall back to playlist order when no number is found. |  |

**User's choice:** A (recommended)

---
## Q4. Titles and descriptions: which language field gets the YouTube text

| Option | Description | Selected |
|---|---|---|
| A | Text goes into the field of its own script: Arabic text → Arabic title and description; English text → English. The English title is required, so until someone writes it, it holds the same text and the draft shows a "Needs English title" mark. No machine translation. | ✓ |
| B | Copy the YouTube text into both the English and the Arabic fields; the admin fixes whichever is wrong. |  |
| C | English fields only; the Arabic fields stay empty. |  |

**User's choice:** A (recommended)

---
## Q5. Importing the same playlist again later

| Option | Description | Selected |
|---|---|---|
| A | Only the 2 new videos are offered, as drafts. Episodes already on Clickit are not touched (admin edits stay). A video removed from the playlist stays on Clickit. | ✓ |
| B | Same as A, and the titles, descriptions and lengths of existing episodes are refreshed from YouTube (this overwrites admin edits). |  |

**User's choice:** A (recommended)

---
## Q6. YouTube visibility for episodes that are not out yet

| Option | Description | Selected |
|---|---|---|
| A | Upload as **Unlisted**. Clickit's own scheduler decides when viewers see it. Private videos are refused with "Set it to Unlisted or Public, then import again". | ✓ |
| B | Upload as **Public**. Viewers on YouTube may see it before Clickit publishes it. |  |

**User's choice:** A (recommended)

---
## Q7. Right after an import

| Option | Description | Selected |
|---|---|---|
| A | The success message has a "Schedule these 21 episodes" button that opens the existing bulk scheduler (broadcast days, Dubai time) with them selected. | ✓ |
| B | Only a success message; the admin opens the scheduler themselves. |  |

**User's choice:** A (recommended)

---
## Q8. Watch page layout — picture `mockups/06-q8.png`

| Option | Description | Selected |
|---|---|---|
| A | Stacked: a solid bar above the video, the video (16:9, black bars when the screen is wider), a control bar under it (previous, title, next, "Start from the beginning"), episodes under that. The same order on phones. | ✓ |
| B | Desktop: video on the left, episode list on the right (like YouTube's watch page). Phones: same as A. |  |

**User's choice:** A (recommended)

---
## Q9. "Next episode" when an episode ends — picture `mockups/06-q9.png`

| Option | Description | Selected |
|---|---|---|
| A | When the video ends, the player is replaced by a Clickit "Up next" card with the 8-second countdown, "Play now" and "Cancel". The video is gone, so nothing covers it, and YouTube's own end screen is never shown. | ✓ |
| B | The ended video stays (YouTube's end screen shows) and the countdown sits in the bar under the video. |  |
| C | No countdown; only the "Next episode" button. |  |

**User's choice:** A (recommended)

---
## Q10. Resume when switching episodes

| Option | Description | Selected |
|---|---|---|
| A | It starts by itself at 9:12. The bar under the video shows "Resumed at 9:12 · Start from the beginning". An episode finished (95% or more) starts at 0:00. | ✓ |
| B | Before playing, ask "Resume at 9:12 or start over?" every time. |  |

**User's choice:** A (recommended)

---
## Q11. When a video can't play — picture `mockups/06-q11.png`

| Option | Description | Selected |
|---|---|---|
| A | A branded Clickit card replaces the player: "This episode can't play right now", the reason in plain words, "Play next episode" and "Back to the show". The episode is flagged for the admins (see Q17). | ✓ |
| B | Keep today's grey box with one line of text. |  |

**User's choice:** A (recommended)

---
## Q12. Captions

| Option | Description | Selected |
|---|---|---|
| A | English site: English captions on when the video has them. Arabic site: captions follow the viewer's own YouTube setting. | ✓ |
| B | Never switch captions on; always the viewer's YouTube setting. |  |
| C | Always on, in the site language when available. |  |

**User's choice:** A (recommended)

---
## Q13. How admins reorder episodes — picture `mockups/06-q13.png`

| Option | Description | Selected |
|---|---|---|
| A | Keep the up/down arrows, saved on each click, made safe (see Q14 and Q19). | ✓ |
| B | Drag rows into place, then press "Save order" once. |  |

**User's choice:** A (recommended)

---
## Q14. Gaps in episode numbers

| Option | Description | Selected |
|---|---|---|
| A | Moving up or down swaps with the nearest episode, whatever its number. Archiving or deleting does not renumber, so viewers' episode numbers stay stable. A "Renumber 1 to N" button closes gaps on purpose, with a confirm and an audit row. | ✓ |
| B | Close gaps automatically every time an episode is archived or deleted (Episode 4 becomes Episode 3). |  |

**User's choice:** A (recommended)

---
## Q15. The YouTube key field in Admin › Settings — picture `mockups/06-q15.png`

| Option | Description | Selected |
|---|---|---|
| A | The field becomes a read-only status: "Key set / Key missing", "Stored in Cloudflare", and a "Test key" button that makes one real call (1 unit of the 10,000 free daily units). | ✓ |
| B | Remove the row; a missing key shows up only as an error when someone imports. |  |

**User's choice:** A (recommended)

---
## Q16. Which Google account owns the new key

| Option | Description | Selected |
|---|---|---|
| A | The Clickit Google account (the one that owns the YouTube channel), in a Google Cloud project named "clickit-story". | ✓ |
| B | Your own Google account. |  |
| C | Another account — name it. |  |

**User's choice:** A (recommended)

---
## Q17. Daily check of stored videos

| Option | Description | Selected |
|---|---|---|
| A | A daily Cloudflare cron (one call per 50 episodes, about 6 units a day for ~300 episodes) refreshes each episode's YouTube status and length, and marks broken episodes with a red "Can't play" badge in the admin and a count on the dashboard. Viewer error reports (Q11) feed the same badge. Nothing is unpublished automatically. | ✓ |
| B | Same check, and broken episodes are hidden from viewers until fixed. |  |
| C | No check in Phase 6 (does not meet the 30-day rule). |  |

**User's choice:** A (recommended)

---
## Q18. Jev in the import preview

| Option | Description | Selected |
|---|---|---|
| A | Not in Phase 6. Statuses come from YouTube itself; Clickit playlists are made by the two admins. Noted as a later idea. | ✓ |
| B | Add it to Phase 6 (advisory only, logged with its confidence). |  |

**User's choice:** A (recommended)

---
## Q19. One database function for reorder and renumber

| Option | Description | Selected |
|---|---|---|
| A | Yes: one small `reorder_episodes` / `renumber_season` function in the same reviewed migration. | ✓ |
| B | No migration for this; use Phase 1.1's app-side undo. |  |

**User's choice:** A (recommended)

---

## Claude's Discretion

See "Decided by Claude unless you object" in 06-DISCUSS-QUESTIONS.md; no objection raised.

## Deferred Ideas

- Jev trailer/teaser detection in import preview (Q18 B).
