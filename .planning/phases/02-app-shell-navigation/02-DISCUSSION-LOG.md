# Phase 2: App Shell & Navigation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Downstream agents read CONTEXT.md, not this file.

---

**Date:** 2026-03-31
**Phase:** 02 — App Shell & Navigation

---

## Q1: Gray areas selected

**Question:** Which areas do you want to discuss?

**Options presented:** Scroll behavior, Mobile navigation, Page layout width, Logo in nav

**User response:** Clarified verbally — described their vision directly.

---

## Q2: Nav bar vision

**Question:** What should the nav look like?

**User response (freeform):** "I want something stylish like the floating navigation bar on the web that have logo on the left side, and a sign in or sign up on the right side that turn into a logo after finish signing up. Nearly same on mobile for easy use."

**Decision captured:** Logo left + Auth right. Same on mobile.

---

## Q3: Nav links

**Question:** Where do nav links (Series, Coming Soon, My List) go?

**User response:** "No — the pages in the means not needed because everything will be on the same page so the user must scroll and navigate."

**Decision captured:** No nav links. Home page is a single-scroll experience. Nav is logo + auth only.

**Follow-up discussion:** Confirmed that separate pages (series detail, watch page) will still exist — logo acts as home button for navigation between them.

---

## Q4: Final nav confirmation

**User response:** "Still no search. Only [CIT logo] [auth]. Same as mobile. That's it. Clear and efficient."

**Decision captured:** Ultra-minimal nav. No links, no search. Logo left, auth right. Identical on mobile.

---

## Q5: Scroll behavior

**Question:** When the user scrolls down, what does the nav do?

**Options:** Always visible / Hide on scroll down / Transparent at top then glass

**Answer:** Always visible (Recommended)

---

## Q6: Page layout width

**Question:** How wide is the page content?

**Options:** Full bleed / Max-width container / Hybrid

**Answer:** Full bleed (Recommended)

---

## Q7: Auth state after login

**Question:** After signing in, what replaces the Sign In button?

**Options:** Initial letter avatar / Generic person icon / You decide

**Answer:** Initial letter avatar (circle with first letter, dropdown: My List, Profile, Sign Out)

---

## Summary

| Area | Decision |
|------|----------|
| Nav structure | Logo left, Sign In/Avatar right — nothing else |
| Mobile nav | Same as desktop (responsive, not a different pattern) |
| Scroll behavior | Always visible, glass always shown |
| Layout width | Full bleed (edge-to-edge) |
| Auth — unauthenticated | "Sign In" button |
| Auth — authenticated | Initial letter avatar → dropdown (My List, Profile, Sign Out) |
