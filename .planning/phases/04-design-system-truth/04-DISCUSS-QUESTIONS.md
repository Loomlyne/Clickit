# Phase 4 — Design System Truth: questions for Koss

Phase goal (ROADMAP): one signed design truth (LBC, #ffcc00, dark surfaces, 8px base radius) exists in the tokens, DESIGN.md and a Claude Design canvas before any new viewer, admin or email screen is coded. Requirements DS-01 to DS-04.

How to answer: reply with the question number and a letter, e.g. `1A 2A 3A …`. "All recommended" is fine. Pictures: `mockups/04-q1.png` … `04-q7.png` (source `mockups/04-mockups.html`, product tokens from `src/styles/globals.css`, LBC font).

What I checked first (2026-10-20, read only):
- The live CSS on www.clickitstory.ae and `src/styles/globals.css` on main carry the same tokens: background #090909, primary #ffcc00 with #090909 ink, LBC for English and Arabic, `--radius` 8px, pill buttons, cards 12px. They come from the UI System engine (`Loomlyne/ui-system`, `ui.config.json`: roundness 50, pill on, field 8). DESIGN.md on main already describes them; no indigo values are left in it.
- What is left to fix in code: 38 hard-coded hex colours in 13 `src/` files, 59 bracket radii (`rounded-[12px]` …), 13 bracket shadows, two copies of the brand-colour map, and three blue-era leftovers that still show on the live site (Q3).
- `/design-system` does not exist today (you removed the demo pages in #18); the live URL answers 404.
- Phase 6's signed spec already uses these live values (pill buttons, 8/12/11/16 radii, #090909, LBC 400/700, 11px minimum). Recommended answers keep it compatible.

Already fixed by the roadmap, not asked again: dark mode only; LBC for titles, body and UI in EN and AR; #ffcc00 primary; the canvas blocks UI build in Phases 5-7 until you sign it; the live site must look unchanged after the token clean-up; `/design-system` (wherever it lives) refuses signed-out visitors and non-admin viewers.

---

### Q1. Page background number — picture `mockups/04-q1.png`
The live site uses #090909; the roadmap text says #0a0a0a. They look identical (one step apart). This picks the number written as the truth everywhere.
Example: the watch page canvas, the admin canvas and the email page background all use this one value.
- **A (recommended).** #090909, as live today. The roadmap line is corrected to #090909. Two stray `#0a0a0a` uses in code snap to the token.
- **B.** #0a0a0a. Every surface token moves one step; Phase 6's spec is updated to match.

Answer: A (Koss, 2026-10-20, "all recommended")### Q2. Corner shapes — picture `mockups/04-q2.png`
Example: the "Send code" button on the sign-in screen and the episode card under it.
- **A (recommended).** Keep the live roles: buttons, chips and nav are full pills; fields 8px; cards 12px; thumbnails 11px; sheets and dialogs 16px. "8px base radius" means the field and base value.
- **B.** 8px everywhere: buttons, chips, cards and sheets all become 8px. Every button on the live site changes, and Phase 6's signed pictures would need redoing.

Answer: A (Koss, 2026-10-20, "all recommended")### Q3. Blue-era leftovers on the live site — picture `mockups/04-q3.png`
Example: open a season dropdown — its menu is blue-black #11151d; hover "Browse shows" on /portfolio — it turns indigo with an indigo glow.
- **A (recommended).** Snap all three to the tokens: dropdown menus and toasts to #101010, the hover to the darker yellow #D7AD16 with a soft yellow glow. These are the only visible changes in this phase.
- **B.** Leave them as they are and list them as allowed exceptions.

Answer: A (Koss, 2026-10-20, "all recommended")### Q4. Category colours — picture `mockups/04-q4.png`
The 15 live categories each have a colour the admins picked (for example Health & Wellness #00FFFB). It shows only as the small dot on each category pill. None is a brand colour.
Example: Sports & Gaming keeps its bright green #00FF0D dot.
- **A (recommended).** Category colours are content (like show artwork) and stay free; the colour picker stays. Everything else in the app takes its colours from one brand map (the 6 CIT colours plus their safe tints).
- **B.** Only the 6 brand colours allowed; the 15 live categories are moved to the nearest one (a live write of 15 rows, your word first; several categories end up sharing a colour).

Answer: A (Koss, 2026-10-20, "all recommended")### Q5. The in-app design-system page — picture `mockups/04-q5.png`
Example: Issam opens Admin → Design system and sees the real colours, type, radii and buttons, drawn from the live CSS.
- **A (recommended).** One read-only admin page at `/admin/design-system`, inside the admin area, so the admin guard refuses signed-out visitors and viewers (Phase 5's two-admin TOTP guard covers it automatically later). It is drawn from the live CSS variables, so it cannot drift.
- **B.** No in-app page. The truth is DESIGN.md plus the Claude Design canvas; DS-01 and DS-04 are reworded.

Answer: A (Koss, 2026-10-20, "all recommended")### Q6. Where the Claude Design boards live — picture `mockups/04-q6.png`
Example: Nejib's playlist import preview board sits next to the email-code sign-in board and the email templates.
- **A (recommended).** A new "Clickit Story" Design canvas that installs the UI System design system with Clickit's values. Four groups: Foundations (colour + brand map, type EN + AR, radius + surfaces, components), Viewer (email-code sign-in, home + show, watch page that follows YouTube's rules, Arabic right-to-left), Admin (playlist import preview, inbox), Email (sign-in code, confirm / reset, welcome, new-episodes digest). Phase 6's signed import and player pictures are copied in unchanged.
- **B.** Add the Clickit boards to the existing brand-neutral "UI System" canvas.

Answer: A (Koss, 2026-10-20, "all recommended")### Q7. Email look — picture `mockups/04-q7.png`
One template serves every email. Mail apps cannot load LBC, so the text falls back to the system font; the logo is an image. (The "10 minutes" in the picture is a placeholder: the code expiry is a Phase 5 setting you set.)
Example: a viewer asks for a sign-in code and gets the email in the picture.
- **A (recommended).** Dark, like the site: #090909 page, #101010 card, yellow button with dark ink.
- **B.** Light body with a dark header bar: white card, black header with the logo, yellow button.

Answer: C (Koss, 2026-10-20, via the controller as Phase 5 Q12) — follows the reader's system colour scheme: light by default (black header, white body, yellow button), plus a dark version via `@media (prefers-color-scheme: dark)`, black like the site. Phase 5 owns the templates and their picture.

### Q8. How you sign the canvas (no picture: this is a process choice)
Example: Phase 5 can start coding sign-in as soon as Foundations, Viewer and Email are signed, even if Admin still has a comment open.
- **A (recommended).** Four signatures, one per board group (Foundations, Viewer, Admin, Email), each written in `04-GATE.md` with the date. A phase may start coding a screen once its group is signed.
- **B.** One signature for the whole canvas; nothing in Phases 5-7 starts until all boards are signed.

Answer: A (Koss, 2026-10-20, "all recommended")### Q9. LBC font in Claude Design (no picture: licence question)
The canvas boards look right only if they use LBC. That means uploading the two LBC font files (400 and 700) into the private "Clickit Story" canvas.
Example: the email-code sign-in board renders its title in LBC, as on the site.
- **A (recommended, if the licence allows it).** Yes, the LBC licence allows the upload; the boards use LBC.
- **B.** No upload; the boards use a system font stand-in, and type is checked against the live site instead.

Answer: A — yes (Koss, 2026-10-20, "all recommended")