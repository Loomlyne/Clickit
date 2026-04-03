# Phase 7: Admin Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 07-admin-dashboard
**Areas discussed:** Dashboard navigation, Editing approach, Episode reordering, Artwork upload UX, Admin login & access, Delete confirmation, Dashboard visual style

---

## Dashboard Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Show list → Show detail page | /admin shows list, clicking a show goes to its detail page | ✓ |
| Sidebar with sections | Persistent sidebar for Shows/Now Streaming/Coming Soon | |
| Single-page accordion | All shows expandable on one page | |

**Follow-up: Season organization on show detail page**

| Option | Description | Selected |
|--------|-------------|----------|
| Tabs by season | Season tabs across the top of the show detail page | ✓ |
| Sections stacked vertically | All seasons as collapsible sections | |
| Separate season pages | /admin/shows/[id]/seasons/[season-id] | |

**Follow-up: Show list presentation**

| Option | Description | Selected |
|--------|-------------|----------|
| Table with status badges | Name, genre, status, episode count, broadcast day + actions | ✓ |
| Card grid | Same cards as viewer catalog with edit controls | |
| Minimal list | Just names and status, very dense | |

---

## Editing Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Slide-out drawer | shadcn Sheet from the right, context stays visible behind | ✓ |
| Full edit page | /admin/shows/[id]/edit dedicated page | |
| Modal dialog | Centered overlay | |

**Follow-up: Same approach for episodes/seasons?**

| Option | Description | Selected |
|--------|-------------|----------|
| Same drawer for all | Episodes and seasons also use drawer | ✓ |
| Modal for episodes | Smaller form, modal less overkill | |
| Inline row editing | Click field to edit in place | |

**Follow-up: After save behavior**

| Option | Description | Selected |
|--------|-------------|----------|
| Close drawer + toast confirmation | Drawer closes, list refreshes, sonner toast | ✓ |
| Stay open for continued editing | Drawer stays open after save | |
| Redirect to show detail page | Navigate after creating a show | |

---

## Episode Reordering

| Option | Description | Selected |
|--------|-------------|----------|
| Up/down arrow buttons | ↑↓ buttons on rows, renumbers episode_number | ✓ |
| Drag-and-drop rows | dnd-kit library, polished UX | |
| Editable episode number field | Admin types new number directly | |

---

## Artwork Upload UX

| Option | Description | Selected |
|--------|-------------|----------|
| 3 upload zones in the form | Poster, Hero, Logo zones in the show drawer | ✓ |
| Upload immediately on file pick | Instant upload to Storage on file select | ✓ |
| Upload on save only | Hold file locally until save | |
| Separate artwork management section | Separate page/drawer for images | |

---

## Admin Login & Access

| Option | Description | Selected |
|--------|-------------|----------|
| Just works — shows dashboard | Server check auth.uid() === ADMIN_USER_ID | ✓ |
| Redirect /admin-login page | Separate admin login flow | |
| Admin link in nav dropdown | Conditional link in avatar dropdown | ✓ (also yes) |

**Follow-up: Non-admin visits /admin**

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to home (/) silently | No explanation, security through obscurity | ✓ |
| Show 403 / Not Authorized page | Explicit error page | |
| Redirect to /auth login | Treat as insufficient auth | |

**Follow-up: Admin nav link**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add in Phase 7 | Conditional Admin link in avatar dropdown | ✓ |
| No — admin navigates by URL | Keep Phase 7 self-contained | |

---

## Delete Confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Confirmation dialog before delete | Dialog with Cancel/Delete, warns about cascade | ✓ |
| Immediate delete with undo toast | Soft delete with 5s undo window | |
| Immediate delete, no confirmation | Fast but risky | |

**Follow-up: Cascade behavior for shows**

User's choice: Archive-first pattern
**Notes:** "i beleive better to archive them first them if they really sure of deleting the show they will go archive and then permently delete all that show or episode data and information from everywhere"

This changed the approach from cascade-delete to archive-first-then-permanent-delete.

**Follow-up: Archive storage**

| Option | Description | Selected |
|--------|-------------|----------|
| archived boolean column | Add archived: boolean DEFAULT false to shows + episodes | ✓ |
| Use 'archived' as status value | Add to status CHECK constraint | |

**Follow-up: Archive access location**

| Option | Description | Selected |
|--------|-------------|----------|
| Archive tab/link in dashboard | Shows | Archive navigation | ✓ |
| Archived items with filter toggle | Active/Archived toggle on show list | |

---

## Dashboard Visual Style

| Option | Description | Selected |
|--------|-------------|----------|
| Same dark theme, more functional | Dark CIT background, table-focused, reuses design system | ✓ |
| Lighter admin theme | White/light gray, new color tokens needed | |
| Completely separate design system | Different product entirely | |
